import type { IngestionRunState, IngestionTriggerSource } from './ingestion-run'
import {
  decideIngestionRetry,
  type IngestionFailure,
} from './ingestion-retry'

export type IngestionRunCounters = {
  total: number
  succeeded: number
  failed: number
  skipped: number
  retryScheduled: number
}

export type IngestionOrchestrationStore = {
  acquire(input: {
    ingestionType: string
    idempotencyKey: string
    triggerSource: IngestionTriggerSource
    itemKeys: string[]
    codeVersion: string | null
    workerId: string
    now: Date
    leaseSeconds: number
  }): Promise<{ disposition: 'acquired' | 'busy' | 'terminal' | 'blocked'; runId: string; state: IngestionRunState }>
  claim(input: {
    runId: string
    workerId: string
    limit: number
    now: Date
    leaseSeconds: number
  }): Promise<{ items: Array<{ id: number; key: string; attemptCount: number }> }>
  heartbeat(input: { runId: string; workerId: string; now: Date; leaseSeconds: number }): Promise<boolean>
  completeItem(input: {
    runId: string
    workerId: string
    itemId: number
    outcome: 'succeeded' | 'retry_scheduled' | 'failed'
    errorCode: string | null
    retryAt: Date | null
  }): Promise<void>
  block(input: {
    runId: string
    workerId: string
    itemId: number
    errorCode: string
    now: Date
  }): Promise<void>
  finalize(input: { runId: string; workerId: string; now: Date }): Promise<{
    state: IngestionRunState
    counters: IngestionRunCounters
  }>
}

export type ExecuteIngestionBatchInput = {
  itemKeys: string[]
  workerId: string
  processItem(itemKey: string): Promise<IngestionItemProcessResult>
  now?: () => Date
  ingestionType?: string
  idempotencyKey?: string
  triggerSource?: IngestionTriggerSource
  codeVersion?: string | null
  batchSize?: number
  timeBudgetMs?: number
  leaseSeconds?: number
  maxAttempts?: number
  random?: () => number
}

export type IngestionItemProcessResult =
  | { ok: true }
  | { ok: false; failure: IngestionFailure }

export type IngestionBatchResult = {
  disposition: 'acquired' | 'busy' | 'terminal' | 'blocked' | 'lease_lost'
  runId: string
  state: IngestionRunState
  processed: number
  succeeded: number
  failed: number
  retryScheduled: number
  hasContinuation: boolean
  counters?: IngestionRunCounters
}

const DEFAULT_BATCH_SIZE = 12
const DEFAULT_TIME_BUDGET_MS = 240_000
const DEFAULT_LEASE_SECONDS = 360
const DEFAULT_MAX_ATTEMPTS = 5

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function configuredBatchSize(value: number | undefined): number {
  const size = value ?? DEFAULT_BATCH_SIZE
  if (!Number.isInteger(size) || size < 1 || size > 50) throw new Error('INGEST_BATCH_SIZE_INVALID')
  return size
}

function configuredBudget(value: number | undefined): number {
  const budget = value ?? DEFAULT_TIME_BUDGET_MS
  if (!Number.isSafeInteger(budget) || budget < 1_000 || budget > 290_000) {
    throw new Error('INGEST_TIME_BUDGET_INVALID')
  }
  return budget
}

function configuredMaxAttempts(value: number | undefined): number {
  const attempts = value ?? DEFAULT_MAX_ATTEMPTS
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
    throw new Error('INGEST_MAX_ATTEMPTS_INVALID')
  }
  return attempts
}

function logMetric(event: 'attempt' | 'recovered' | 'final_failure' | 'retry_scheduled' | 'blocked', input: {
  runId: string
  itemId: number
  attempt: number
  code?: string
}): void {
  console.info('ml_ingestion_metric', {
    event,
    run_id: input.runId,
    item_id: input.itemId,
    attempt: input.attempt,
    ...(input.code ? { code: input.code } : {}),
  })
}

export async function executeIngestionBatch(
  input: ExecuteIngestionBatchInput,
  store: IngestionOrchestrationStore,
): Promise<IngestionBatchResult> {
  const now = input.now ?? (() => new Date())
  const startedAt = now()
  const batchSize = configuredBatchSize(input.batchSize)
  const timeBudgetMs = configuredBudget(input.timeBudgetMs)
  const leaseSeconds = input.leaseSeconds ?? DEFAULT_LEASE_SECONDS
  const maxAttempts = configuredMaxAttempts(input.maxAttempts)
  const acquired = await store.acquire({
    ingestionType: input.ingestionType ?? 'ml_catalog',
    idempotencyKey: input.idempotencyKey ?? utcDay(startedAt),
    triggerSource: input.triggerSource ?? 'cron',
    itemKeys: input.itemKeys,
    codeVersion: input.codeVersion ?? null,
    workerId: input.workerId,
    now: startedAt,
    leaseSeconds,
  })

  if (acquired.disposition !== 'acquired') {
    return {
      disposition: acquired.disposition,
      runId: acquired.runId,
      state: acquired.state,
      processed: 0,
      succeeded: 0,
      failed: 0,
      retryScheduled: 0,
      hasContinuation: acquired.disposition === 'busy',
    }
  }

  const claimed = await store.claim({
    runId: acquired.runId,
    workerId: input.workerId,
    limit: batchSize,
    now: now(),
    leaseSeconds,
  })
  let processed = 0
  let succeeded = 0
  let failed = 0

  let retryScheduled = 0

  for (const item of claimed.items) {
    if (now().getTime() - startedAt.getTime() >= timeBudgetMs) break
    const ownsLease = await store.heartbeat({
      runId: acquired.runId, workerId: input.workerId, now: now(), leaseSeconds,
    })
    if (!ownsLease) {
      return {
        disposition: 'lease_lost', runId: acquired.runId, state: 'running',
        processed, succeeded, failed, retryScheduled, hasContinuation: true,
      }
    }
    logMetric('attempt', {
      runId: acquired.runId, itemId: item.id, attempt: item.attemptCount,
    })
    let outcome: IngestionItemProcessResult
    try {
      outcome = await input.processItem(item.key)
    } catch {
      outcome = {
        ok: false,
        failure: { classification: 'internal', code: 'item_processing_failed' },
      }
    }
    if (outcome.ok) {
      await store.completeItem({
        runId: acquired.runId, workerId: input.workerId, itemId: item.id,
        outcome: 'succeeded', errorCode: null, retryAt: null,
      })
      succeeded++
      if (item.attemptCount > 1) {
        logMetric('recovered', {
          runId: acquired.runId, itemId: item.id, attempt: item.attemptCount,
        })
      }
    } else {
      const decision = decideIngestionRetry({
        failure: outcome.failure,
        attempt: item.attemptCount,
        maxAttempts,
        now: now(),
        random: input.random,
      })
      if (decision.outcome === 'blocked') {
        await store.block({
          runId: acquired.runId,
          workerId: input.workerId,
          itemId: item.id,
          errorCode: decision.code,
          now: now(),
        })
        logMetric('blocked', {
          runId: acquired.runId, itemId: item.id, attempt: item.attemptCount, code: decision.code,
        })
        return {
          disposition: 'blocked', runId: acquired.runId, state: 'blocked',
          processed: processed + 1, succeeded, failed, retryScheduled,
          hasContinuation: false,
        }
      }
      await store.completeItem({
        runId: acquired.runId,
        workerId: input.workerId,
        itemId: item.id,
        outcome: decision.outcome,
        errorCode: decision.code,
        retryAt: decision.outcome === 'retry_scheduled' ? decision.retryAt : null,
      })
      if (decision.outcome === 'retry_scheduled') {
        retryScheduled++
        logMetric('retry_scheduled', {
          runId: acquired.runId, itemId: item.id, attempt: item.attemptCount, code: decision.code,
        })
      } else {
        failed++
        logMetric('final_failure', {
          runId: acquired.runId, itemId: item.id, attempt: item.attemptCount, code: decision.code,
        })
      }
    }
    processed++
  }

  const final = await store.finalize({ runId: acquired.runId, workerId: input.workerId, now: now() })
  return {
    disposition: 'acquired', runId: acquired.runId, state: final.state,
    processed, succeeded, failed, retryScheduled,
    hasContinuation: final.state === 'running', counters: final.counters,
  }
}
