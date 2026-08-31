import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../db-admin', () => ({ supabaseAdmin: { from } }))

import { exchangeCodeForTokens, saveTokens } from './oauth'

describe('Mercado Livre OAuth', () => {
  beforeEach(() => {
    vi.stubEnv('ML_APP_ID', 'app-id')
    vi.stubEnv('ML_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('ML_REDIRECT_URI', 'https://example.com/api/auth/ml/callback')
    from.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('rejects an authorization response without refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-must-not-leak',
      expires_in: 21_600,
      user_id: 12345,
    }), { status: 200 })))

    await expect(exchangeCodeForTokens('authorization-code'))
      .rejects.toThrowError('ML_OAUTH_REFRESH_TOKEN_MISSING')
  })

  it('does not persist an incomplete token pair', async () => {
    await expect(saveTokens({
      access_token: 'access-token',
      refresh_token: '',
      expires_at: new Date(Date.now() + 21_600_000),
      ml_user_id: 12345,
    })).rejects.toThrowError('ML_OAUTH_TOKENS_INCOMPLETE')

    expect(from).not.toHaveBeenCalled()
  })

  it('does not include the provider response body in request errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      'access_token=access-must-not-leak',
      { status: 401 },
    )))

    await expect(exchangeCodeForTokens('authorization-code'))
      .rejects.toThrowError('ML_OAUTH_REQUEST_FAILED_401')
  })
})
