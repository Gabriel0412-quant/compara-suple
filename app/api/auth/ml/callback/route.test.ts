import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { consumeOAuthAttempt, exchangeCodeForTokens, persistEncryptedTokens } = vi.hoisted(
  () => ({
    consumeOAuthAttempt: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    persistEncryptedTokens: vi.fn(),
  }),
)

vi.mock('@/lib/ml/oauth-attempt', () => ({ consumeOAuthAttempt }))
vi.mock('@/lib/ml/oauth', () => ({ exchangeCodeForTokens }))
vi.mock('@/lib/ml/token-vault', () => ({ persistEncryptedTokens }))

import { GET } from './route'

function request(params: string): NextRequest {
  return new NextRequest(`https://example.com/api/auth/ml/callback?${params}`)
}

const tokens = {
  access_token: 'access-secret',
  refresh_token: 'refresh-secret',
  expires_at: new Date('2026-09-01T06:00:00Z'),
  ml_user_id: 437089518,
}

describe('GET /api/auth/ml/callback', () => {
  beforeEach(() => {
    consumeOAuthAttempt.mockReset()
    exchangeCodeForTokens.mockReset()
    persistEncryptedTokens.mockReset()
    consumeOAuthAttempt.mockResolvedValue(true)
    exchangeCodeForTokens.mockResolvedValue(tokens)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects an expired or reused state before exchanging the code', async () => {
    consumeOAuthAttempt.mockResolvedValue(false)

    const response = await GET(request('code=code&state=expired'))

    expect(response.status).toBe(400)
    expect(exchangeCodeForTokens).not.toHaveBeenCalled()
    expect(persistEncryptedTokens).not.toHaveBeenCalled()
  })

  it('persists the allowed account in the encrypted vault', async () => {
    const response = await GET(request('code=code&state=single-use'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ml_user_id: 437089518,
      expires_at: '2026-09-01T06:00:00.000Z',
    })
    expect(persistEncryptedTokens).toHaveBeenCalledWith(tokens)
  })

  it('rejects another Mercado Livre account with 403', async () => {
    persistEncryptedTokens.mockRejectedValue(new Error('ML_OAUTH_USER_NOT_ALLOWED'))

    const response = await GET(request('code=code&state=single-use'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'account_not_allowed',
    })
  })

  it('does not expose provider details in callback failures', async () => {
    exchangeCodeForTokens.mockRejectedValue(
      new Error('access-secret-must-not-leak'),
    )

    const response = await GET(request('code=code&state=single-use'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'authorization_failed',
    })
  })
})
