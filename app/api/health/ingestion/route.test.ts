import { afterEach, describe, expect, it, vi } from 'vitest'

const { getIngestionOperationalStatus } = vi.hoisted(() => ({ getIngestionOperationalStatus: vi.fn() }))
vi.mock('@/lib/ml/ingestion-status', () => ({ getIngestionOperationalStatus }))
import { GET } from './route'

describe('/api/health/ingestion', () => {
  afterEach(() => getIngestionOperationalStatus.mockReset())

  it('exposes only the aggregate public status', async () => {
    getIngestionOperationalStatus.mockResolvedValue({
      status: 'degraded', run: { id: 'internal-run-id' }, alerts: ['run_failed'],
    })
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, status: 'degraded' })
    expect(JSON.stringify(body)).not.toContain('internal-run-id')
  })

  it('fails closed when the diagnostic query is unavailable', async () => {
    getIngestionOperationalStatus.mockRejectedValue(new Error('database details'))
    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ ok: false, status: 'unavailable' })
  })
})
