import { describe, expect, it, vi } from 'vitest'

import { getEncryptedAccessToken, type AccessTokenDependencies } from './access-token'
import type { MlTokens } from './token-response'

const expired: MlTokens = {
  access_token: 'expired-access',
  refresh_token: 'single-use-refresh',
  expires_at: new Date('2026-09-01T00:00:00Z'),
  ml_user_id: 437089518,
}

const fresh: MlTokens = {
  access_token: 'fresh-access',
  refresh_token: 'rotated-refresh',
  expires_at: new Date('2026-09-01T06:00:00Z'),
  ml_user_id: 437089518,
}

function dependencies(
  overrides: Partial<AccessTokenDependencies> = {},
): AccessTokenDependencies {
  return {
    loadTokens: vi.fn(async () => expired),
    acquireLease: vi.fn(async () => true),
    completeLease: vi.fn(async () => true),
    releaseLease: vi.fn(async () => true),
    sealTokens: vi.fn(() => ({
      tokenPayload: 'opaque-ciphertext',
      tokenKeyVersion: 1,
    })),
    refreshTokens: vi.fn(async () => fresh),
    newLeaseId: vi.fn(() => 'lease-id'),
    now: vi.fn(() => new Date('2026-09-01T01:00:00Z').getTime()),
    wait: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('encrypted ML access token provider', () => {
  it('returns a token that is not near expiration without acquiring a lease', async () => {
    const deps = dependencies({ loadTokens: vi.fn(async () => fresh) })

    await expect(getEncryptedAccessToken(deps)).resolves.toBe('fresh-access')
    expect(deps.acquireLease).not.toHaveBeenCalled()
    expect(deps.refreshTokens).not.toHaveBeenCalled()
  })

  it('refreshes and persists the rotated pair through its lease', async () => {
    const deps = dependencies()

    await expect(getEncryptedAccessToken(deps)).resolves.toBe('fresh-access')
    expect(deps.refreshTokens).toHaveBeenCalledWith('single-use-refresh')
    expect(deps.completeLease).toHaveBeenCalledWith({
      mlUserId: 437089518,
      leaseId: 'lease-id',
      tokenPayload: 'opaque-ciphertext',
      tokenKeyVersion: 1,
      expiresAt: fresh.expires_at,
    })
  })

  it('makes twenty concurrent callers share one refresh', async () => {
    let current = expired
    let leaseTaken = false
    let sequence = 0
    let completeWaiters: Array<() => void> = []
    const refreshTokens = vi.fn(async () => fresh)
    const deps = dependencies({
      loadTokens: vi.fn(async () => current),
      acquireLease: vi.fn(async () => {
        if (leaseTaken) return false
        leaseTaken = true
        return true
      }),
      completeLease: vi.fn(async () => {
        current = fresh
        completeWaiters.forEach(resolve => resolve())
        completeWaiters = []
        return true
      }),
      refreshTokens,
      newLeaseId: vi.fn(() => `lease-${++sequence}`),
      wait: vi.fn(() => new Promise<void>(resolve => {
        if (current === fresh) resolve()
        else completeWaiters.push(resolve)
      })),
    })

    const results = await Promise.all(
      Array.from({ length: 20 }, () => getEncryptedAccessToken(deps)),
    )

    expect(results).toEqual(Array(20).fill('fresh-access'))
    expect(refreshTokens).toHaveBeenCalledOnce()
  })

  it('marks invalid_grant as reconnect_required without retrying', async () => {
    const deps = dependencies({
      refreshTokens: vi.fn(async () => {
        throw new Error('ML_OAUTH_INVALID_GRANT')
      }),
    })

    await expect(getEncryptedAccessToken(deps))
      .rejects.toThrowError('ML_OAUTH_RECONNECT_REQUIRED')
    expect(deps.releaseLease).toHaveBeenCalledWith({
      mlUserId: 437089518,
      leaseId: 'lease-id',
      errorCode: 'invalid_grant',
      reconnectRequired: true,
    })
    expect(deps.refreshTokens).toHaveBeenCalledOnce()
  })

  it('fails when the lease is lost before persistence', async () => {
    const deps = dependencies({
      completeLease: vi.fn(async () => false),
    })

    await expect(getEncryptedAccessToken(deps))
      .rejects.toThrowError('ML_OAUTH_REFRESH_LEASE_LOST')
  })
})
