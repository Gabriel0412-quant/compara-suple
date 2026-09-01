import { describe, expect, it } from 'vitest'

import { checkMlAdminAuthorization } from './admin-auth'

const secret = 'a'.repeat(64)

describe('ML administrative authorization', () => {
  it('accepts the configured bearer secret', () => {
    expect(checkMlAdminAuthorization(`Bearer ${secret}`, {
      NODE_ENV: 'test',
      ML_ADMIN_SECRET: secret,
    })).toBe('authorized')
  })

  it.each([undefined, '', 'Bearer wrong', `Basic ${secret}`])(
    'rejects an invalid authorization header',
    authorization => {
      expect(checkMlAdminAuthorization(authorization, {
        NODE_ENV: 'test',
        ML_ADMIN_SECRET: secret,
      })).toBe('unauthorized')
    },
  )

  it.each([undefined, '', 'short'])('fails for invalid server configuration', value => {
    expect(checkMlAdminAuthorization(undefined, {
      NODE_ENV: 'test',
      ML_ADMIN_SECRET: value,
    })).toBe('configuration_error')
  })
})
