import { randomBytes } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import {
  disconnectMlConnection,
  getMlConnectionMetadata,
  type MlConnectionStore,
} from './connection'

const env: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  ML_ALLOWED_USER_ID: '437089518',
  ML_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  ML_TOKEN_ENCRYPTION_KEY_VERSION: '1',
}

describe('ML connection operations', () => {
  it('returns only safe operational metadata', async () => {
    const store: MlConnectionStore = {
      findByUserId: vi.fn(async () => ({
        data: {
          connection_state: 'connected' as const,
          expires_at: '2026-09-01T22:30:40Z',
          last_refreshed_at: '2026-09-01T16:30:41Z',
          last_error_code: null,
          updated_at: '2026-09-01T16:30:41Z',
          refresh_lease_expires_at: null,
        },
        error: null,
      })),
      disconnect: vi.fn(),
    }

    await expect(getMlConnectionMetadata(store, env)).resolves.toEqual({
      state: 'connected',
      expiresAt: '2026-09-01T22:30:40Z',
      lastRefreshedAt: '2026-09-01T16:30:41Z',
      lastErrorCode: null,
      updatedAt: '2026-09-01T16:30:41Z',
      refreshInProgress: false,
    })
    expect(store.findByUserId).toHaveBeenCalledWith(437089518)
  })

  it('returns disconnected metadata when no row exists', async () => {
    const store: MlConnectionStore = {
      findByUserId: vi.fn(async () => ({ data: null, error: null })),
      disconnect: vi.fn(),
    }

    await expect(getMlConnectionMetadata(store, env)).resolves.toMatchObject({
      state: 'disconnected',
      expiresAt: null,
      refreshInProgress: false,
    })
  })

  it('disconnects only the configured account through the atomic function', async () => {
    const store: MlConnectionStore = {
      findByUserId: vi.fn(),
      disconnect: vi.fn(async () => ({ data: true, error: null })),
    }

    await expect(disconnectMlConnection(store, env)).resolves.toBe(true)
    expect(store.disconnect).toHaveBeenCalledWith(437089518)
  })

  it('sanitizes database errors', async () => {
    const store: MlConnectionStore = {
      findByUserId: vi.fn(),
      disconnect: vi.fn(async () => ({
        data: null,
        error: new Error('token-payload-must-not-leak'),
      })),
    }

    await expect(disconnectMlConnection(store, env))
      .rejects.toThrowError('ML_CONNECTION_DISCONNECT_FAILED')
  })
})
