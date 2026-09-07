import type { IngestionRunState, IngestionTriggerSource } from './ingestion-run'

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
  }): Promise<{ itemIds: number[]; itemKeys: string[] }>
  heartbeat(input: { runId: string; workerId: string; now: Date; leaseSeconds: number }): Promise<boolean>
  completeItem(input: {
    runId: string
    workerId: string
    itemId: number
    outcome: 'succeeded' | 'failed'
    errorCode: string | null
  }): Promise<void>
  finalize(input: { runId: string; workerId: string; now: Date }): Promise<{
    state: IngestionRunState
    counters: IngestionRunCounters
  }>
}

export type ExecuteIngestionBatchInput = {
  itemKeys: string[]
  workerId: string
  processItem(itemKey: string): Promise<{ ok: boolean }>
  now?: () => Date
  ingestionType?: string
  idempotencyKey?: string
  triggerSource?: IngestionTriggerSource
  codeVersion?: string | null
  batchSize?: number
  timeBudgetMs?: number
  leaseSeconds?: number
}

export type IngestionBatchResult = {
  disposition: 'acquired' | 'busy' | 'terminal' | 'blocked' | 'lease_lost'
  runId: string
  state: IngestionRunState
  processed: number
  succeeded: number
  failed: number
  hasContinuation: boolean
  counters?: IngestionRunCounters
}

const DEFAULT_BATCH_SIZE = 12
const DEFAULT_TIME_BUDGET_MS = 240_000
const DEFAULT_LEASE_SECONDS = 360

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

export async function executeIngestionBatch(
  input: ExecuteIngestionBatchInput,
  store: IngestionOrchestrationStore,
): Promise<IngestionBatchResult> {
  const now = input.now ?? (() => new Date())
  const startedAt = now()
  const batchSize = configuredBatchSize(input.batchSize)
  const timeBudgetMs = configuredBudget(input.timeBudgetMs)
  const leaseSeconds = input.leaseSeconds ?? DEFAULT_LEASE_SECONDS
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

  for (let index = 0; index < claimed.itemKeys.length; index++) {
    if (now().getTime() - startedAt.getTime() >= timeBudgetMs) break
    const ownsLease = await store.heartbeat({
      runId: acquired.runId, workerId: input.workerId, now: now(), leaseSeconds,
    })
    if (!ownsLease) {
      return {
        disposition: 'lease_lost', runId: acquired.runId, state: 'running',
        processed, succeeded, failed, hasContinuation: true,
      }
    }
    const itemId = claimed.itemIds[index]
    try {
      const outcome = await input.processItem(claimed.itemKeys[index])
      if (!outcome.ok) throw new Error('item_processing_failed')
      await store.completeItem({
        runId: acquired.runId, workerId: input.workerId, itemId,
        outcome: 'succeeded', errorCode: null,
      })
      succeeded++
    } catch {
      await store.completeItem({
        runId: acquired.runId, workerId: input.workerId, itemId,
        outcome: 'failed', errorCode: 'item_processing_failed',
      })
      failed++
    }
    processed++
  }

  const final = await store.finalize({ runId: acquired.runId, workerId: input.workerId, now: now() })
  return {
    disposition: 'acquired', runId: acquired.runId, state: final.state,
    processed, succeeded, failed,
    hasContinuation: final.state === 'running', counters: final.counters,
  }
}
