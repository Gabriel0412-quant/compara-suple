import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createOAuthAttempt, buildAuthUrl } = vi.hoisted(() => ({
  createOAuthAttempt: vi.fn(),
  buildAuthUrl: vi.fn(),
}))

vi.mock('@/lib/ml/oauth-attempt', () => ({ createOAuthAttempt }))
vi.mock('@/lib/ml/oauth', () => ({ buildAuthUrl }))

import { POST } from './route'

const adminSecret = 'a'.repeat(64)

function request(authorization?: string): NextRequest {
  return new NextRequest('https://example.com/api/auth/ml/login', {
    method: 'POST',
    headers: authorization ? { authorization } : undefined,
  })
}

describe('POST /api/auth/ml/login', () => {
  beforeEach(() => {
    vi.stubEnv('ML_ADMIN_SECRET', adminSecret)
    vi.stubEnv('ML_ALLOWED_USER_ID', '437089518')
    vi.stubEnv('ML_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'))
    vi.stubEnv('ML_TOKEN_ENCRYPTION_KEY_VERSION', '1')
    createOAuthAttempt.mockReset()
    buildAuthUrl.mockReset()
    buildAuthUrl.mockReturnValue('https://auth.example/authorize')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 without the administrative secret', async () => {
    const response = await POST(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    })
    expect(createOAuthAttempt).not.toHaveBeenCalled()
  })

  it('returns 503 for an invalid security configuration', async () => {
    vi.stubEnv('ML_TOKEN_ENCRYPTION_KEY', '')

    const response = await POST(request(`Bearer ${adminSecret}`))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'configuration_error',
    })
    expect(createOAuthAttempt).not.toHaveBeenCalled()
  })

  it('creates a single-use attempt and returns the authorization destination', async () => {
    const response = await POST(request(`Bearer ${adminSecret}`))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      authorization_url: 'https://auth.example/authorize',
    })
    expect(createOAuthAttempt).toHaveBeenCalledOnce()
    expect(buildAuthUrl).toHaveBeenCalledOnce()
    expect(createOAuthAttempt.mock.calls[0][0]).toBe(buildAuthUrl.mock.calls[0][0])
  })
})
