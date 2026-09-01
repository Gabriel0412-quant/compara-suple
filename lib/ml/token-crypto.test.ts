import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  decodeTokenEncryptionKey,
  decryptTokenPair,
  encryptTokenPair,
} from './token-crypto'

const pair = {
  accessToken: 'access-secret-must-not-leak',
  refreshToken: 'refresh-secret-must-not-leak',
}

describe('ML token encryption', () => {
  it('round-trips a token pair with a 256-bit key', () => {
    const key = randomBytes(32)
    const encrypted = encryptTokenPair(pair, key)

    expect(decryptTokenPair(encrypted, key)).toEqual(pair)
    expect(encrypted).not.toContain(pair.accessToken)
    expect(encrypted).not.toContain(pair.refreshToken)
  })

  it('uses a unique nonce for every encryption', () => {
    const key = randomBytes(32)

    expect(encryptTokenPair(pair, key)).not.toBe(encryptTokenPair(pair, key))
  })

  it('fails closed when the authenticated payload is changed', () => {
    const key = randomBytes(32)
    const encrypted = encryptTokenPair(pair, key)
    const envelope = JSON.parse(encrypted) as Record<string, string>
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`

    expect(() => decryptTokenPair(JSON.stringify(envelope), key))
      .toThrowError('ML_TOKEN_DECRYPTION_FAILED')
  })

  it.each(['', 'not-base64', randomBytes(16).toString('base64')])(
    'rejects an invalid encryption key',
    encoded => {
      expect(() => decodeTokenEncryptionKey(encoded))
        .toThrowError('ML_TOKEN_ENCRYPTION_KEY_INVALID')
    },
  )
})
