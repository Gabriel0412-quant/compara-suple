import { supabaseAdmin } from '../db-admin'

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

