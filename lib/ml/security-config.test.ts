import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { loadMlTokenSecurityConfig } from './security-config'

const completeEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  ML_ALLOWED_USER_ID: '437089518',
  ML_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  ML_TOKEN_ENCRYPTION_KEY_VERSION: '1',
}

describe('ML token security configuration', () => {
  it('loads the allowed account and versioned key', () => {
    const config = loadMlTokenSecurityConfig(completeEnv)

    expect(config.allowedUserId).toBe(437089518)
    expect(config.key).toHaveLength(32)
    expect(config.keyVersion).toBe(1)
  })

  it.each([
    ['ML_ALLOWED_USER_ID', ''],
    ['ML_ALLOWED_USER_ID', 'not-a-number'],
    ['ML_TOKEN_ENCRYPTION_KEY', 'invalid'],
    ['ML_TOKEN_ENCRYPTION_KEY_VERSION', '0'],
  ])('fails closed for invalid %s', (name, value) => {
    expect(() => loadMlTokenSecurityConfig({
      ...completeEnv,
      [name]: value,
    })).toThrowError('ML_OAUTH_SECURITY_CONFIGURATION_INVALID')
  })
})
