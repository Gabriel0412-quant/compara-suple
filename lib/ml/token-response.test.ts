import { describe, expect, it } from 'vitest'

import { parseMlTokenResponse } from './token-response'

const validResponse = {
  access_token: 'access-secret',
  refresh_token: 'refresh-secret',
  expires_in: 21_600,
  user_id: 12345,
}

describe('parseMlTokenResponse', () => {
  it('accepts a complete token pair', () => {
    const tokens = parseMlTokenResponse(validResponse, 1_000)

    expect(tokens).toEqual({
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      expires_at: new Date(21_601_000),
      ml_user_id: 12345,
    })
  })

  it('rejects a response without refresh token', () => {
    expect(() => parseMlTokenResponse({
      ...validResponse,
      refresh_token: undefined,
    })).toThrowError('ML_OAUTH_REFRESH_TOKEN_MISSING')
  })

  it('rejects an incomplete response without including credentials in the error', () => {
    let message = ''

    try {
      parseMlTokenResponse({
        access_token: 'access-must-not-leak',
        refresh_token: 'refresh-must-not-leak',
        expires_in: 21_600,
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toBe('ML_OAUTH_RESPONSE_INCOMPLETE')
    expect(message).not.toContain('access-must-not-leak')
    expect(message).not.toContain('refresh-must-not-leak')
  })
})
