import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MlTokens } from './token-response'
import {
  loadEncryptedTokens,
  persistEncryptedTokens,
  type MlTokenConnectionRow,
  type MlTokenVaultStore,
  type MlTokenWriteRow,
} from './token-vault'

const env: NodeJS.ProcessEnv = {
  ML_ALLOWED_USER_ID: '437089518',
  ML_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  ML_TOKEN_ENCRYPTION_KEY_VERSION: '1',
}

const tokens: MlTokens = {
  access_token: 'access-secret-must-not-leak',
  refresh_token: 'refresh-secret-must-not-leak',
  expires_at: new Date('2026-09-01T06:00:00Z'),
  ml_user_id: 437089518,
}

describe('ML token vault', () => {
  let written: MlTokenWriteRow | undefined
  let stored: MlTokenConnectionRow | null
  let store: MlTokenVaultStore

  beforeEach(() => {
    written = undefined
    stored = null
    store = {
      upsert: vi.fn(async row => {
        written = row
        return { error: null }
      }),
      findByUserId: vi.fn(async () => ({ data: stored, error: null })),
    }
  })

  it('persists only encrypted token material for the allowed account', async () => {
    await persistEncryptedTokens(tokens, store, env)

    expect(written).toMatchObject({
      ml_user_id: 437089518,
      token_key_version: 1,
      connection_state: 'connected',
      access_token: null,
      refresh_token: null,
    })
    expect(written?.token_payload).not.toContain(tokens.access_token)
    expect(written?.token_payload).not.toContain(tokens.refresh_token)
  })

  it('rejects another account before writing', async () => {
    await expect(persistEncryptedTokens({
      ...tokens,
      ml_user_id: 999,
    }, store, env)).rejects.toThrowError('ML_OAUTH_USER_NOT_ALLOWED')

    expect(store.upsert).not.toHaveBeenCalled()
  })

  it('loads and decrypts only the configured account', async () => {
    await persistEncryptedTokens(tokens, store, env)
    stored = {
      ml_user_id: written!.ml_user_id,
      token_payload: written!.token_payload,
      token_key_version: written!.token_key_version,
      connection_state: 'connected',
      expires_at: written!.expires_at,
    }

    await expect(loadEncryptedTokens(store, env)).resolves.toEqual(tokens)
    expect(store.findByUserId).toHaveBeenCalledWith(437089518)
  })

  it('requires reconnection without attempting decryption', async () => {
    stored = {
      ml_user_id: 437089518,
      token_payload: 'opaque',
      token_key_version: 1,
      connection_state: 'reconnect_required',
      expires_at: '2026-09-01T06:00:00Z',
    }

    await expect(loadEncryptedTokens(store, env))
      .rejects.toThrowError('ML_OAUTH_RECONNECT_REQUIRED')
  })

  it('fails closed for a key version that is unavailable', async () => {
    stored = {
      ml_user_id: 437089518,
      token_payload: 'opaque',
      token_key_version: 2,
      connection_state: 'connected',
      expires_at: '2026-09-01T06:00:00Z',
    }

    await expect(loadEncryptedTokens(store, env))
      .rejects.toThrowError('ML_TOKEN_KEY_VERSION_UNAVAILABLE')
  })

  it('does not include database details in errors', async () => {
    store.upsert = vi.fn(async () => ({
      error: new Error('refresh-secret-must-not-leak'),
    }))

    await expect(persistEncryptedTokens(tokens, store, env))
      .rejects.toThrowError('ML_TOKEN_STORE_WRITE_FAILED')
  })
})
