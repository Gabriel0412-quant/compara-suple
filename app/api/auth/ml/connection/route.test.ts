import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { disconnectMlConnection, getMlConnectionMetadata } = vi.hoisted(() => ({
  disconnectMlConnection: vi.fn(),
  getMlConnectionMetadata: vi.fn(),
}))

vi.mock('@/lib/ml/connection', () => ({
  disconnectMlConnection,
  getMlConnectionMetadata,
}))

import { DELETE, GET } from './route'

const adminSecret = 'a'.repeat(64)

function request(method: 'GET' | 'DELETE', authorized = true): NextRequest {
  return new NextRequest('https://example.com/api/auth/ml/connection', {
    method,
    headers: authorized
      ? { authorization: `Bearer ${adminSecret}` }
      : undefined,
  })
}

describe('/api/auth/ml/connection', () => {
  beforeEach(() => {
    vi.stubEnv('ML_ADMIN_SECRET', adminSecret)
    disconnectMlConnection.mockReset()
    getMlConnectionMetadata.mockReset()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each([
    ['GET', GET],
    ['DELETE', DELETE],
  ] as const)('returns 401 for an unauthorized %s', async (method, handler) => {
    const response = await handler(request(method, false))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    })
  })

  it('returns safe connection metadata', async () => {
    getMlConnectionMetadata.mockResolvedValue({
      state: 'connected',
      expiresAt: '2026-09-01T22:30:40Z',
      lastRefreshedAt: '2026-09-01T16:30:41Z',
      lastErrorCode: null,
      updatedAt: '2026-09-01T16:30:41Z',
      refreshInProgress: false,
    })

    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.connection).toEqual({
      state: 'connected',
      expiresAt: '2026-09-01T22:30:40Z',
      lastRefreshedAt: '2026-09-01T16:30:41Z',
      lastErrorCode: null,
      updatedAt: '2026-09-01T16:30:41Z',
      refreshInProgress: false,
    })
    expect(JSON.stringify(body)).not.toContain('token')
  })

  it('disconnects and clears the encrypted connection', async () => {
    disconnectMlConnection.mockResolvedValue(true)

    const response = await DELETE(request('DELETE'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      connection: { state: 'disconnected', changed: true },
    })
  })
})
