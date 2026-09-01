import { describe, expect, it, vi } from 'vitest'

import {
  acquireRefreshLease,
  completeRefreshLease,
  releaseRefreshLease,
  type MlRefreshLeaseStore,
} from './refresh-lease'

describe('ML refresh lease repository', () => {
  it('acquires a lease atomically for the configured account', async () => {
    const call = vi.fn(async () => ({ data: true, error: null }))
    const store: MlRefreshLeaseStore = { call }

    await expect(acquireRefreshLease(437089518, 'lease-id', store))
      .resolves.toBe(true)
    expect(call).toHaveBeenCalledWith('acquire_ml_refresh_lease', {
      p_ml_user_id: 437089518,
      p_lease_id: 'lease-id',
      p_ttl_seconds: 30,
    })
  })

  it('persists refreshed ciphertext only through the lease owner', async () => {
    const call = vi.fn(async () => ({ data: true, error: null }))
    const store: MlRefreshLeaseStore = { call }

    await expect(completeRefreshLease({
      mlUserId: 437089518,
      leaseId: 'lease-id',
      tokenPayload: 'opaque-ciphertext',
      tokenKeyVersion: 1,
      expiresAt: new Date('2026-09-01T12:00:00Z'),
    }, store)).resolves.toBe(true)
    expect(call).toHaveBeenCalledWith('complete_ml_token_refresh', {
      p_ml_user_id: 437089518,
      p_lease_id: 'lease-id',
      p_token_payload: 'opaque-ciphertext',
      p_token_key_version: 1,
      p_expires_at: '2026-09-01T12:00:00.000Z',
    })
  })

  it('marks invalid_grant as reconnect_required when releasing', async () => {
    const call = vi.fn(async () => ({ data: true, error: null }))
    const store: MlRefreshLeaseStore = { call }

    await releaseRefreshLease({
      mlUserId: 437089518,
      leaseId: 'lease-id',
      errorCode: 'invalid_grant',
      reconnectRequired: true,
    }, store)

    expect(call).toHaveBeenCalledWith('release_ml_refresh_lease', {
      p_ml_user_id: 437089518,
      p_lease_id: 'lease-id',
      p_error_code: 'invalid_grant',
      p_reconnect_required: true,
    })
  })

  it('sanitizes RPC errors', async () => {
    const store: MlRefreshLeaseStore = {
      call: vi.fn(async () => ({
        data: null,
        error: new Error('refresh-secret-must-not-leak'),
      })),
    }

    await expect(acquireRefreshLease(437089518, 'lease-id', store))
      .rejects.toThrowError('ML_REFRESH_LEASE_ACQUIRE_FAILED')
  })
})
