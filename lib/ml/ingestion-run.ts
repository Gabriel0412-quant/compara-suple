import { supabaseAdmin } from '../db-admin'
import type {
  IngestionOrchestrationStore,
  IngestionRunCounters,
} from './ingestion-orchestrator'

export type IngestionRunState =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'partial_failed'
  | 'failed'
  | 'blocked'

export type IngestionRunItemState =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'retry_scheduled'
  | 'failed'
  | 'skipped'

export type IngestionTriggerSource = 'cron' | 'manual' | 'retry' | 'test'

export type CreateIngestionRunInput = {
  ingestionType: string
  idempotencyKey: string
  triggerSource: IngestionTriggerSource
  itemKeys: string[]
  codeVersion?: string
}

type StoreResult = {
  data: unknown
  error: unknown | null
}

export type IngestionRunStore = {
  create(parameters: Record<string, unknown>): Promise<StoreResult>
}

const supabaseIngestionRunStore: IngestionRunStore = {
  async create(parameters) {
    const { data, error } = await supabaseAdmin.rpc(
      'create_ingestion_run',
      parameters,
    )
    return { data, error }
  },
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function createIngestionRun(
  input: CreateIngestionRunInput,
  store: IngestionRunStore = supabaseIngestionRunStore,
): Promise<string> {
  const result = await store.create({
    p_ingestion_type: input.ingestionType,
    p_idempotency_key: input.idempotencyKey,
    p_trigger_source: input.triggerSource,
    p_item_keys: input.itemKeys,
    p_code_version: input.codeVersion ?? null,
  })

  if (result.error) {
    throw new Error('INGESTION_RUN_CREATE_FAILED')
  }

  if (typeof result.data !== 'string' || !uuidPattern.test(result.data)) {
    throw new Error('INGESTION_RUN_INVALID_ID')
  }

  return result.data
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function oneRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length === 1 ? record(value[0]) : null
  return record(value)
}

function readRunState(value: unknown): IngestionRunState | null {
  return value === 'pending' || value === 'running' || value === 'succeeded'
    || value === 'partial_failed' || value === 'failed' || value === 'blocked'
    ? value
    : null
}

function readCounters(value: Record<string, unknown>): IngestionRunCounters | null {
  const fields = [
    value.item_total,
    value.item_succeeded,
    value.item_failed,
    value.item_skipped,
    value.item_retry_scheduled,
  ]
  if (!fields.every(field => Number.isInteger(field) && Number(field) >= 0)) return null
  return {
    total: Number(value.item_total),
    succeeded: Number(value.item_succeeded),
    failed: Number(value.item_failed),
    skipped: Number(value.item_skipped),
    retryScheduled: Number(value.item_retry_scheduled),
  }
}

async function orchestrationRpc(name: string, parameters: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabaseAdmin.rpc(name, parameters)
  if (error) throw new Error('INGESTION_ORCHESTRATION_STORAGE_FAILED')
  return data
}

export const supabaseIngestionOrchestrationStore: IngestionOrchestrationStore = {
  async acquire(input) {
    const data = await orchestrationRpc('acquire_ingestion_run', {
      p_ingestion_type: input.ingestionType,
      p_idempotency_key: input.idempotencyKey,
      p_trigger_source: input.triggerSource,
      p_item_keys: input.itemKeys,
      p_code_version: input.codeVersion,
      p_worker_id: input.workerId,
      p_now: input.now.toISOString(),
      p_lease_seconds: input.leaseSeconds,
    })
    const row = oneRecord(data)
    const state = readRunState(row?.state)
    const disposition = row?.disposition
    if (!row || typeof row.run_id !== 'string' || !uuidPattern.test(row.run_id) || !state
      || (disposition !== 'acquired' && disposition !== 'busy' && disposition !== 'terminal' && disposition !== 'blocked')) {
      throw new Error('INGESTION_ORCHESTRATION_RESPONSE_INVALID')
    }
    return { disposition, runId: row.run_id, state }
  },

  async claim(input) {
    const data = await orchestrationRpc('claim_ingestion_batch', {
      p_run_id: input.runId,
      p_worker_id: input.workerId,
      p_limit: input.limit,
      p_now: input.now.toISOString(),
      p_lease_seconds: input.leaseSeconds,
    })
    if (!Array.isArray(data)) throw new Error('INGESTION_ORCHESTRATION_RESPONSE_INVALID')
    const rows = data.map(record)
    if (rows.some(row => !row || !Number.isSafeInteger(row.item_id)
      || typeof row.item_key !== 'string'
      || !Number.isSafeInteger(row.attempt_count) || Number(row.attempt_count) < 1)) {
      throw new Error('INGESTION_ORCHESTRATION_RESPONSE_INVALID')
    }
    return {
      items: rows.map(row => ({
        id: Number(row?.item_id),
        key: String(row?.item_key),
        attemptCount: Number(row?.attempt_count),
      })),
    }
  },

  async heartbeat(input) {
    const data = await orchestrationRpc('heartbeat_ingestion_run', {
      p_run_id: input.runId,
      p_worker_id: input.workerId,
      p_now: input.now.toISOString(),
      p_lease_seconds: input.leaseSeconds,
    })
    if (typeof data !== 'boolean') throw new Error('INGESTION_ORCHESTRATION_RESPONSE_INVALID')
    return data
  },

  async completeItem(input) {
    await orchestrationRpc('record_ingestion_item_outcome', {
      p_run_id: input.runId,
      p_item_id: input.itemId,
      p_worker_id: input.workerId,
      p_outcome: input.outcome,
      p_error_code: input.errorCode,
      p_next_retry_at: input.retryAt?.toISOString() ?? null,
      p_now: new Date().toISOString(),
    })
  },

  async block(input) {
    await orchestrationRpc('block_ingestion_run', {
      p_run_id: input.runId,
      p_worker_id: input.workerId,
      p_item_id: input.itemId,
      p_error_code: input.errorCode,
      p_now: input.now.toISOString(),
    })
  },

  async finalize(input) {
    const data = await orchestrationRpc('finalize_ingestion_run', {
      p_run_id: input.runId,
      p_worker_id: input.workerId,
      p_now: input.now.toISOString(),
    })
    const row = oneRecord(data)
    const state = readRunState(row?.state)
    const counters = row ? readCounters(row) : null
    if (!state || !counters) throw new Error('INGESTION_ORCHESTRATION_RESPONSE_INVALID')
    return { state, counters }
  },
}

export type ReplayIngestionRunInput = {
  runId: string
  itemId?: number
  includeCompleted?: boolean
}

export type ReplayIngestionRunStore = {
  replay(parameters: Record<string, unknown>): Promise<StoreResult>
}

const supabaseReplayIngestionRunStore: ReplayIngestionRunStore = {
  async replay(parameters) {
    const { data, error } = await supabaseAdmin.rpc('replay_ingestion_run', parameters)
    return { data, error }
  },
}

export async function replayIngestionRun(
  input: ReplayIngestionRunInput,
  store: ReplayIngestionRunStore = supabaseReplayIngestionRunStore,
): Promise<{ state: IngestionRunState; requeuedCount: number }> {
  const result = await store.replay({
    p_run_id: input.runId,
    p_item_id: input.itemId ?? null,
    p_include_completed: input.includeCompleted ?? false,
    p_now: new Date().toISOString(),
  })
  if (result.error) {
    const error = record(result.error)
    if (error?.message === 'ingestion_replay_scope_invalid') {
      throw new Error('INGESTION_REPLAY_SCOPE_INVALID')
    }
    if (error?.message === 'ingestion_replay_run_busy') {
      throw new Error('INGESTION_REPLAY_RUN_BUSY')
    }
    throw new Error('INGESTION_REPLAY_FAILED')
  }
  const row = oneRecord(result.data)
  const state = readRunState(row?.state)
  if (!row || !state || !Number.isSafeInteger(row.requeued_count) || Number(row.requeued_count) < 0) {
    throw new Error('INGESTION_REPLAY_RESPONSE_INVALID')
  }
  return { state, requeuedCount: Number(row.requeued_count) }
}
