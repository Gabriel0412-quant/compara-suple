import { supabaseAdmin } from './db-admin'
import {
  getReadinessThresholds,
  type ReadinessThresholds,
} from './readiness-config'

export {
  DEFAULT_READINESS_DEGRADED_AFTER_HOURS,
  DEFAULT_READINESS_TIMEOUT_MS,
  DEFAULT_READINESS_UNAVAILABLE_AFTER_HOURS,
  getReadinessThresholds,
} from './readiness-config'
export type { ReadinessThresholds } from './readiness-config'

export type ReadinessStatus = 'healthy' | 'degraded' | 'unavailable'

export type ReadinessResult = {
  status: ReadinessStatus
}

export type ReadinessStore = {
  getOldestAvailableOfferFetchedAt(): Promise<string | null>
}

const supabaseReadinessStore: ReadinessStore = {
  async getOldestAvailableOfferFetchedAt() {
    const { data, error } = await supabaseAdmin
      .from('offer')
      .select('fetched_at')
      .eq('available', true)
      .order('fetched_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error('READINESS_DATABASE_QUERY_FAILED')
    if (!data || typeof data.fetched_at !== 'string') return null
    return data.fetched_at
  },
}

function timed<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('READINESS_TIMEOUT')), timeoutMs)
  })

  return Promise.race([operation, deadline]).finally(() => {
    if (timeout) clearTimeout(timeout)
  })
}

export function readinessFromSnapshot(
  oldestAvailableOfferFetchedAt: string | null,
  now: Date,
  thresholds: ReadinessThresholds,
): ReadinessResult {
  if (!oldestAvailableOfferFetchedAt) return { status: 'degraded' }

  const fetchedAt = new Date(oldestAvailableOfferFetchedAt)
  if (Number.isNaN(fetchedAt.getTime())) return { status: 'unavailable' }

  const elapsedHours = (now.getTime() - fetchedAt.getTime()) / 3_600_000
  if (elapsedHours > thresholds.unavailableAfterHours) {
    return { status: 'unavailable' }
  }
  if (elapsedHours > thresholds.degradedAfterHours) {
    return { status: 'degraded' }
  }
  return { status: 'healthy' }
}

export async function getReadiness(
  store: ReadinessStore = supabaseReadinessStore,
  now: Date = new Date(),
  thresholds: ReadinessThresholds = getReadinessThresholds(),
): Promise<ReadinessResult> {
  try {
    const snapshot = await timed(
      store.getOldestAvailableOfferFetchedAt(),
      thresholds.timeoutMs,
    )
    return readinessFromSnapshot(snapshot, now, thresholds)
  } catch {
    return { status: 'unavailable' }
  }
}
