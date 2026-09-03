import { describe, expect, it, vi } from 'vitest'

const { getReadiness } = vi.hoisted(() => ({
  getReadiness: vi.fn(),
}))

vi.mock('@/lib/readiness', () => ({ getReadiness }))

import { GET } from './route'

describe('/api/readiness', () => {
  it.each([
    ['healthy', 200, true],
    ['degraded', 200, true],
    ['unavailable', 503, false],
  ] as const)('returns sanitized %s readiness', async (status, expectedStatus, ok) => {
    getReadiness.mockResolvedValueOnce({ status })

    const response = await GET()

    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ ok, status })
  })
})
