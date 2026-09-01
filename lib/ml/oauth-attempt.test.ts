import { describe, expect, it, vi } from 'vitest'

import {
  consumeOAuthAttempt,
  createOAuthAttempt,
  hashOAuthState,
  type MlOAuthAttemptStore,
} from './oauth-attempt'

describe('ML OAuth attempts', () => {
  it('persists only the hash with a ten-minute expiration', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const store: MlOAuthAttemptStore = {
      insert,
      consume: vi.fn(),
    }
    const now = new Date('2026-09-01T00:00:00Z')

    await createOAuthAttempt('state-must-not-be-stored', store, now)

    expect(insert).toHaveBeenCalledWith({
      state_hash: hashOAuthState('state-must-not-be-stored'),
      expires_at: '2026-09-01T00:10:00.000Z',
    })
    expect(JSON.stringify(insert.mock.calls)).not.toContain('state-must-not-be-stored')
  })

  it('consumes an attempt by hash', async () => {
    const consume = vi.fn(async () => ({ data: true, error: null }))
    const store: MlOAuthAttemptStore = {
      insert: vi.fn(),
      consume,
    }

    await expect(consumeOAuthAttempt('single-use-state', store)).resolves.toBe(true)
    expect(consume).toHaveBeenCalledWith(hashOAuthState('single-use-state'))
  })

  it('returns false for an expired or reused attempt', async () => {
    const store: MlOAuthAttemptStore = {
      insert: vi.fn(),
      consume: vi.fn(async () => ({ data: false, error: null })),
    }

    await expect(consumeOAuthAttempt('expired-state', store)).resolves.toBe(false)
  })

  it('sanitizes database failures', async () => {
    const store: MlOAuthAttemptStore = {
      insert: vi.fn(async () => ({ error: new Error('state-must-not-leak') })),
      consume: vi.fn(),
    }

    await expect(createOAuthAttempt('state-must-not-leak', store))
      .rejects.toThrowError('ML_OAUTH_ATTEMPT_WRITE_FAILED')
  })
})
