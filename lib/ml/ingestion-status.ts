import { supabaseAdmin } from '../db-admin'

export type IngestionHealth = 'healthy' | 'degraded' | 'unavailable'
export type IngestionAlertKey = 'price_stale' | 'run_stuck' | 'auth_blocked' | 'run_failed'

export type IngestionStatusSnapshot = {
  runId: string | null
  runState: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string | null
  heartbeatAt: string | null
  leaseExpiresAt: string | null
  total: number
  succeeded: number
  failed: number
  retryScheduled: number
  skipped: number
  lastValidPriceAt: string | null
  leaseExpired: boolean
  authBlocked: boolean
}

export type IngestionOperationalStatus = {
  status: IngestionHealth
  run: {
    id: string | null
    state: string | null
    startedAt: string | null
    completedAt: string | null
    durationMs: number | null
    heartbeatAt: string | null
    leaseExpiresAt: string | null
    leaseExpired: boolean
    total: number
    succeeded: number
    failed: number
    retryScheduled: number
    skipped: number
  }
  lastValidPriceAt: string | null
  lastValidPriceAgeMinutes: number | null
  authBlocked: boolean
  alerts: IngestionAlertKey[]
}

export type IngestionStatusStore = {
  get(parameters: Record<string, unknown>): Promise<{ data: unknown; error: unknown | null }>
  recordAlert(parameters: Record<string, unknown>): Promise<{ data: unknown; error: unknown | null }>
}

const DEFAULT_STALE_AFTER_HOURS = 30
const DEFAULT_ALERT_DEDUP_MINUTES = 60

function positiveInteger(value: string | undefined, fallback: number, minimum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback
}

export function getIngestionStatusThresholds(env: NodeJS.ProcessEnv = process.env): {
  staleAfterHours: number
  alertDedupMinutes: number
} {
  return {
    staleAfterHours: positiveInteger(
      env.INGEST_STATUS_STALE_AFTER_HOURS,
      DEFAULT_STALE_AFTER_HOURS,
      1,
    ),
    alertDedupMinutes: positiveInteger(
      env.INGEST_ALERT_DEDUP_MINUTES,
      DEFAULT_ALERT_DEDUP_MINUTES,
      1,
    ),
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function oneRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length === 1 ? record(value[0]) : null
  return record(value)
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null
}

function readSnapshot(value: unknown): IngestionStatusSnapshot | null {
  const row = oneRecord(value)
  if (!row) return null
  const counters = [
    row.item_total,
    row.item_succeeded,
    row.item_failed,
    row.item_retry_scheduled,
    row.item_skipped,
  ].map(nonNegativeInteger)
  if (counters.some(counter => counter === null)
    || typeof row.lease_expired !== 'boolean' || typeof row.auth_blocked !== 'boolean') {
    return null
  }
  return {
    runId: nullableString(row.run_id),
    runState: nullableString(row.run_state),
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    createdAt: nullableString(row.created_at),
    heartbeatAt: nullableString(row.heartbeat_at),
    leaseExpiresAt: nullableString(row.lease_expires_at),
    total: counters[0]!,
    succeeded: counters[1]!,
    failed: counters[2]!,
    retryScheduled: counters[3]!,
    skipped: counters[4]!,
    lastValidPriceAt: nullableString(row.last_valid_price_at),
    leaseExpired: row.lease_expired,
    authBlocked: row.auth_blocked,
  }
}

function validTime(value: string | null): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

export function ingestionStatusFromSnapshot(
  snapshot: IngestionStatusSnapshot,
  now: Date,
  staleAfterHours: number,
): IngestionOperationalStatus {
  const start = validTime(snapshot.startedAt)
  const end = validTime(snapshot.completedAt) ?? now.getTime()
  const priceTime = validTime(snapshot.lastValidPriceAt)
  const lastValidPriceAgeMinutes = priceTime === null
    ? null
    : Math.max(0, Math.floor((now.getTime() - priceTime) / 60_000))
  const priceStale = lastValidPriceAgeMinutes === null
    || lastValidPriceAgeMinutes > staleAfterHours * 60
  const runFailed = snapshot.runState === 'failed' || snapshot.runState === 'partial_failed'
  const alerts: IngestionAlertKey[] = [
    ...(priceStale ? ['price_stale' as const] : []),
    ...(snapshot.leaseExpired ? ['run_stuck' as const] : []),
    ...(snapshot.authBlocked ? ['auth_blocked' as const] : []),
    ...(runFailed ? ['run_failed' as const] : []),
  ]
  const status: IngestionHealth = snapshot.leaseExpired || snapshot.authBlocked
    ? 'unavailable'
    : alerts.length > 0 ? 'degraded' : 'healthy'

  return {
    status,
    run: {
      id: snapshot.runId,
      state: snapshot.runState,
      startedAt: snapshot.startedAt,
      completedAt: snapshot.completedAt,
      durationMs: start === null ? null : Math.max(0, end - start),
      heartbeatAt: snapshot.heartbeatAt,
      leaseExpiresAt: snapshot.leaseExpiresAt,
      leaseExpired: snapshot.leaseExpired,
      total: snapshot.total,
      succeeded: snapshot.succeeded,
      failed: snapshot.failed,
      retryScheduled: snapshot.retryScheduled,
      skipped: snapshot.skipped,
    },
    lastValidPriceAt: snapshot.lastValidPriceAt,
    lastValidPriceAgeMinutes,
    authBlocked: snapshot.authBlocked,
    alerts,
  }
}

const supabaseIngestionStatusStore: IngestionStatusStore = {
  async get(parameters) {
    const { data, error } = await supabaseAdmin.rpc('get_ingestion_operational_status', parameters)
    return { data, error }
  },
  async recordAlert(parameters) {
    const { data, error } = await supabaseAdmin.rpc('record_ingestion_alert', parameters)
    return { data, error }
  },
}

export async function getIngestionOperationalStatus(
  store: IngestionStatusStore = supabaseIngestionStatusStore,
  now: Date = new Date(),
  staleAfterHours = getIngestionStatusThresholds().staleAfterHours,
): Promise<IngestionOperationalStatus> {
  const { data, error } = await store.get({
    p_ingestion_type: 'ml_catalog',
    p_now: now.toISOString(),
  })
  if (error) throw new Error('INGESTION_STATUS_QUERY_FAILED')
  const snapshot = readSnapshot(data)
  if (!snapshot) throw new Error('INGESTION_STATUS_RESPONSE_INVALID')
  return ingestionStatusFromSnapshot(snapshot, now, staleAfterHours)
}

export async function monitorIngestion(
  store: IngestionStatusStore = supabaseIngestionStatusStore,
  now: Date = new Date(),
): Promise<IngestionOperationalStatus> {
  const thresholds = getIngestionStatusThresholds()
  const status = await getIngestionOperationalStatus(store, now, thresholds.staleAfterHours)
  const activeAlerts = new Set(status.alerts)
  for (const key of ['price_stale', 'run_stuck', 'auth_blocked', 'run_failed'] as const) {
    const { data, error } = await store.recordAlert({
      p_alert_key: key,
      p_active: activeAlerts.has(key),
      p_run_id: status.run.id,
      p_now: now.toISOString(),
      p_dedup_minutes: thresholds.alertDedupMinutes,
    })
    if (error) throw new Error('INGESTION_ALERT_RECORD_FAILED')
    const outcome = oneRecord(data)
    if (!outcome || typeof outcome.emitted !== 'boolean' || typeof outcome.event !== 'string') {
      throw new Error('INGESTION_ALERT_RESPONSE_INVALID')
    }
    if (outcome.emitted) {
      console.warn('ml_ingestion_alert', {
        event: outcome.event,
        alert_key: key,
        ...(status.run.id ? { run_id: status.run.id } : {}),
        status: status.status,
      })
    }
  }
  return status
}
