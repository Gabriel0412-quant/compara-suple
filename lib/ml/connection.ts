import { supabaseAdmin } from '../db-admin'
import { loadMlTokenSecurityConfig } from './security-config'
import type { MlConnectionState } from './token-vault'

export type MlConnectionMetadata = {
  state: MlConnectionState
  expiresAt: string | null
  lastRefreshedAt: string | null
  lastErrorCode: string | null
  updatedAt: string | null
  refreshInProgress: boolean
}

type MlConnectionMetadataRow = {
  connection_state: MlConnectionState
  expires_at: string
  last_refreshed_at: string | null
  last_error_code: string | null
  updated_at: string
  refresh_lease_expires_at: string | null
}

type StoreResult<T> = {
  data?: T | null
  error: unknown | null
}

export type MlConnectionStore = {
  findByUserId(userId: number): Promise<StoreResult<MlConnectionMetadataRow>>
  disconnect(userId: number): Promise<StoreResult<boolean>>
}

const supabaseConnectionStore: MlConnectionStore = {
  async findByUserId(userId) {
    const { data, error } = await supabaseAdmin
      .from('ml_oauth_tokens')
      .select(
        'connection_state, expires_at, last_refreshed_at, last_error_code, updated_at, refresh_lease_expires_at',
      )
      .eq('ml_user_id', userId)
      .maybeSingle()
    return { data: data as MlConnectionMetadataRow | null, error }
  },
  async disconnect(userId) {
    const { data, error } = await supabaseAdmin.rpc('disconnect_ml_oauth', {
      p_ml_user_id: userId,
    })
    return { data: data === true, error }
  },
}

export async function getMlConnectionMetadata(
  store: MlConnectionStore = supabaseConnectionStore,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MlConnectionMetadata> {
  const { allowedUserId } = loadMlTokenSecurityConfig(env)
  const result = await store.findByUserId(allowedUserId)
  if (result.error) {
    throw new Error('ML_CONNECTION_STATUS_FAILED')
  }
  if (!result.data) {
    return {
      state: 'disconnected',
      expiresAt: null,
      lastRefreshedAt: null,
      lastErrorCode: null,
      updatedAt: null,
      refreshInProgress: false,
    }
  }

  return {
    state: result.data.connection_state,
    expiresAt: result.data.expires_at,
    lastRefreshedAt: result.data.last_refreshed_at,
    lastErrorCode: result.data.last_error_code,
    updatedAt: result.data.updated_at,
    refreshInProgress:
      result.data.connection_state === 'refreshing'
      && result.data.refresh_lease_expires_at !== null,
  }
}

export async function disconnectMlConnection(
  store: MlConnectionStore = supabaseConnectionStore,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const { allowedUserId } = loadMlTokenSecurityConfig(env)
  const result = await store.disconnect(allowedUserId)
  if (result.error) {
    throw new Error('ML_CONNECTION_DISCONNECT_FAILED')
  }
  return result.data === true
}
