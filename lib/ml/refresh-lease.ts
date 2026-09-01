import { supabaseAdmin } from '../db-admin'

type RefreshLeaseFunction =
  | 'acquire_ml_refresh_lease'
  | 'complete_ml_token_refresh'
  | 'release_ml_refresh_lease'

type StoreResult = {
  data: boolean | null
  error: unknown | null
}

export type MlRefreshLeaseStore = {
  call(
    functionName: RefreshLeaseFunction,
    parameters: Record<string, unknown>,
  ): Promise<StoreResult>
}

const supabaseRefreshLeaseStore: MlRefreshLeaseStore = {
  async call(functionName, parameters) {
    const { data, error } = await supabaseAdmin.rpc(functionName, parameters)
    return { data: data === true, error }
  },
}

export async function acquireRefreshLease(
  mlUserId: number,
  leaseId: string,
  store: MlRefreshLeaseStore = supabaseRefreshLeaseStore,
): Promise<boolean> {
  const result = await store.call('acquire_ml_refresh_lease', {
    p_ml_user_id: mlUserId,
    p_lease_id: leaseId,
    p_ttl_seconds: 30,
  })
  if (result.error) {
    throw new Error('ML_REFRESH_LEASE_ACQUIRE_FAILED')
  }
  return result.data === true
}

type CompleteRefreshLeaseInput = {
  mlUserId: number
  leaseId: string
  tokenPayload: string
  tokenKeyVersion: number
  expiresAt: Date
}

export async function completeRefreshLease(
  input: CompleteRefreshLeaseInput,
  store: MlRefreshLeaseStore = supabaseRefreshLeaseStore,
): Promise<boolean> {
  const result = await store.call('complete_ml_token_refresh', {
    p_ml_user_id: input.mlUserId,
    p_lease_id: input.leaseId,
    p_token_payload: input.tokenPayload,
    p_token_key_version: input.tokenKeyVersion,
    p_expires_at: input.expiresAt.toISOString(),
  })
  if (result.error) {
    throw new Error('ML_REFRESH_LEASE_COMPLETE_FAILED')
  }
  return result.data === true
}

type ReleaseRefreshLeaseInput = {
  mlUserId: number
  leaseId: string
  errorCode: string
  reconnectRequired: boolean
}

export async function releaseRefreshLease(
  input: ReleaseRefreshLeaseInput,
  store: MlRefreshLeaseStore = supabaseRefreshLeaseStore,
): Promise<boolean> {
  const result = await store.call('release_ml_refresh_lease', {
    p_ml_user_id: input.mlUserId,
    p_lease_id: input.leaseId,
    p_error_code: input.errorCode,
    p_reconnect_required: input.reconnectRequired,
  })
  if (result.error) {
    throw new Error('ML_REFRESH_LEASE_RELEASE_FAILED')
  }
  return result.data === true
}
