import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const ADDITIONAL_DATA = Buffer.from('compara-suple:ml-oauth:v1', 'utf8')

export type MlTokenPair = {
  accessToken: string
  refreshToken: string
}

type TokenEnvelope = {
  algorithm: 'A256GCM'
  iv: string
  ciphertext: string
  tag: string
}

function decodeBase64(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64')
  if (!value || decoded.toString('base64') !== value) {
    throw new Error('INVALID_BASE64')
  }
  return decoded
}

export function decodeTokenEncryptionKey(encoded: string): Buffer {
  try {
    const key = decodeBase64(encoded)
    if (key.length !== 32) {
      throw new Error('INVALID_KEY_LENGTH')
    }
    return key
  } catch {
    throw new Error('ML_TOKEN_ENCRYPTION_KEY_INVALID')
  }
}

export function encryptTokenPair(pair: MlTokenPair, key: Buffer): string {
  if (key.length !== 32 || !pair.accessToken || !pair.refreshToken) {
    throw new Error('ML_TOKEN_ENCRYPTION_INPUT_INVALID')
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(ADDITIONAL_DATA)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(pair), 'utf8'),
    cipher.final(),
  ])
  const envelope: TokenEnvelope = {
    algorithm: 'A256GCM',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
  return JSON.stringify(envelope)
}

export function decryptTokenPair(payload: string, key: Buffer): MlTokenPair {
  try {
    if (key.length !== 32) {
      throw new Error('INVALID_KEY_LENGTH')
    }
    const envelope = JSON.parse(payload) as Partial<TokenEnvelope>
    if (
      envelope.algorithm !== 'A256GCM'
      || typeof envelope.iv !== 'string'
      || typeof envelope.ciphertext !== 'string'
      || typeof envelope.tag !== 'string'
    ) {
      throw new Error('INVALID_ENVELOPE')
    }

    const iv = decodeBase64(envelope.iv)
    const ciphertext = decodeBase64(envelope.ciphertext)
    const tag = decodeBase64(envelope.tag)
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error('INVALID_ENVELOPE_LENGTH')
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAAD(ADDITIONAL_DATA)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
    const pair = JSON.parse(plaintext) as Partial<MlTokenPair>
    if (!pair.accessToken || !pair.refreshToken) {
      throw new Error('INVALID_TOKEN_PAIR')
    }
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    }
  } catch {
    throw new Error('ML_TOKEN_DECRYPTION_FAILED')
  }
}
