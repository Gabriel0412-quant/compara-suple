import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getIngestionOperationalStatus } = vi.hoisted(() => ({ getIngestionOperationalStatus: vi.fn() }))
vi.mock('@/lib/ml/ingestion-status', () => ({ getIngestionOperationalStatus }))
import { GET } from './route'

const secret = 'a'.repeat(64)

function request(authorized = true): NextRequest {
  return new NextRequest('https://example.com/api/admin/ml-ingest/status', {
    headers: authorized ? { authorization: `Bearer ${secret}` } : undefined,
  })
}

describe('/api/admin/ml-ingest/status', () => {
  beforeEach(() => {
    vi.stubEnv('ML_ADMIN_SECRET', secret)
    getIngestionOperationalStatus.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('rejects an unauthorized detailed diagnostic without querying it', async () => {
    const response = await GET(request(false))
    expect(response.status).toBe(401)
    expect(getIngestionOperationalStatus).not.toHaveBeenCalled()
  })

  it('returns the administrative run id and counters only to the admin secret', async () => {
    getIngestionOperationalStatus.mockResolvedValue({
      status: 'degraded', lastValidPriceAt: '2026-09-08T08:00:00.000Z', lastValidPriceAgeMinutes: 60,
      authBlocked: false, alerts: ['run_failed'],
      run: { id: '0199243f-5418-7e26-8d7e-6068e98a5970', state: 'partial_failed',
        startedAt: null, completedAt: null, durationMs: null, heartbeatAt: null, leaseExpiresAt: null,
        leaseExpired: false, total: 2, succeeded: 1, failed: 1, retryScheduled: 0, skipped: 0 },
    })

    const response = await GET(request())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      ok: true,
      status: expect.objectContaining({ run: expect.objectContaining({ id: '0199243f-5418-7e26-8d7e-6068e98a5970' }) }),
    }))
  })
})
