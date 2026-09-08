import { describe, expect, it, vi } from 'vitest'

import {
  getIngestionOperationalStatus,
  ingestionStatusFromSnapshot,
  monitorIngestion,
  type IngestionStatusSnapshot,
  type IngestionStatusStore,
} from './ingestion-status'

const now = new Date('2026-09-08T09:00:00.000Z')
const snapshot: IngestionStatusSnapshot = {
  runId: '0199243f-5418-7e26-8d7e-6068e98a5970',
  runState: 'succeeded',
  startedAt: '2026-09-08T08:58:00.000Z',
  completedAt: '2026-09-08T08:59:00.000Z',
  createdAt: '2026-09-08T08:58:00.000Z',
  heartbeatAt: '2026-09-08T08:59:00.000Z',
  leaseExpiresAt: null,
  total: 3,
  succeeded: 3,
  failed: 0,
  retryScheduled: 0,
  skipped: 0,
  lastValidPriceAt: '2026-09-08T08:50:00.000Z',
  leaseExpired: false,
  authBlocked: false,
}

function store(overrides: Partial<IngestionStatusStore> = {}): IngestionStatusStore {
  return {
    get: vi.fn(async () => ({ data: [{
      run_id: snapshot.runId,
      run_state: snapshot.runState,
      started_at: snapshot.startedAt,
      completed_at: snapshot.completedAt,
      created_at: snapshot.createdAt,
      heartbeat_at: snapshot.heartbeatAt,
      lease_expires_at: snapshot.leaseExpiresAt,
      item_total: snapshot.total,
      item_succeeded: snapshot.succeeded,
      item_failed: snapshot.failed,
      item_retry_scheduled: snapshot.retryScheduled,
      item_skipped: snapshot.skipped,
      last_valid_price_at: snapshot.lastValidPriceAt,
      lease_expired: snapshot.leaseExpired,
      auth_blocked: snapshot.authBlocked,
    }], error: null })),
    recordAlert: vi.fn(async () => ({ data: [{ event: 'quiet', emitted: false }], error: null })),
    ...overrides,
  }
}

describe('ingestion operational status', () => {
  it('reports a healthy completed run with fresh prices', () => {
    expect(ingestionStatusFromSnapshot(snapshot, now, 30)).toMatchObject({
      status: 'healthy',
      lastValidPriceAgeMinutes: 10,
      alerts: [],
      run: { durationMs: 60_000, failed: 0, retryScheduled: 0 },
    })
  })

  it('degrades stale prices without exposing an internal failure', () => {
    const result = ingestionStatusFromSnapshot({
      ...snapshot,
      lastValidPriceAt: '2026-09-06T08:00:00.000Z',
    }, now, 30)

    expect(result).toMatchObject({ status: 'degraded', alerts: ['price_stale'] })
  })

  it('marks an expired lease and an OAuth block as unavailable', () => {
    const result = ingestionStatusFromSnapshot({
      ...snapshot,
      runState: 'blocked',
      leaseExpired: true,
      authBlocked: true,
    }, now, 30)

    expect(result).toMatchObject({
      status: 'unavailable',
      alerts: expect.arrayContaining(['run_stuck', 'auth_blocked']),
    })
  })

  it('returns a typed detailed status from the protected read model', async () => {
    await expect(getIngestionOperationalStatus(store(), now, 30)).resolves.toMatchObject({
      status: 'healthy', run: { id: snapshot.runId },
    })
  })

  it('emits only alert transitions supplied by the durable alert store', async () => {
    const recordAlert = vi.fn(async (input: Record<string, unknown>) => ({
      data: [{ event: input.p_alert_key === 'price_stale' ? 'opened' : 'quiet',
        emitted: input.p_alert_key === 'price_stale' }],
      error: null,
    }))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await monitorIngestion(store({
      get: vi.fn(async () => ({ data: [{
        run_id: snapshot.runId, run_state: snapshot.runState,
        started_at: snapshot.startedAt, completed_at: snapshot.completedAt, created_at: snapshot.createdAt,
        heartbeat_at: snapshot.heartbeatAt, lease_expires_at: snapshot.leaseExpiresAt,
        item_total: 3, item_succeeded: 3, item_failed: 0, item_retry_scheduled: 0, item_skipped: 0,
        last_valid_price_at: '2026-09-06T08:00:00.000Z', lease_expired: false, auth_blocked: false,
      }], error: null })),
      recordAlert,
    }), now)

    expect(recordAlert).toHaveBeenCalledTimes(4)
    expect(warning).toHaveBeenCalledWith('ml_ingestion_alert', expect.objectContaining({
      event: 'opened', alert_key: 'price_stale', run_id: snapshot.runId,
    }))
    warning.mockRestore()
  })
})
