import { supabaseAdmin } from '../db-admin'
import { loadMlTokenSecurityConfig } from './security-config'
import { decryptTokenPair, encryptTokenPair } from './token-crypto'
import type { MlTokens } from './token-response'

export type MlConnectionState =
  | 'disconnected'
  | 'connected'
  | 'refreshing'
  | 'reconnect_required'

export type MlTokenWriteRow = {
  ml_user_id: number
  token_payload: string
  token_key_version: number
  connection_state: 'connected'
  expires_at: string
  last_error_code: null
  refresh_lease_id: null
  refresh_lease_expires_at: null
  updated_at: string
  access_token: null
  refresh_token: null
}

export type MlTokenConnectionRow = {
  ml_user_id: number
  token_payload: string | null
  token_key_version: number | null
  connection_state: MlConnectionState
  expires_at: string
}

export type SealedMlTokens = {
  tokenPayload: string
  tokenKeyVersion: number
}

type StoreResult<T> = {
  data?: T | null
  error: unknown | null
}

export type MlTokenVaultStore = {
  upsert(row: MlTokenWriteRow): Promise<StoreResult<never>>
  findByUserId(userId: number): Promise<StoreResult<MlTokenConnectionRow>>
}

const supabaseTokenVaultStore: MlTokenVaultStore = {
  async upsert(row) {
    const { error } = await supabaseAdmin
      .from('ml_oauth_tokens')
      .upsert(row, { onConflict: 'ml_user_id' })
    return { error }
  },
  async findByUserId(userId) {
    const { data, error } = await supabaseAdmin
      .from('ml_oauth_tokens')
      .select(
        'ml_user_id, token_payload, token_key_version, connection_state, expires_at',
      )
      .eq('ml_user_id', userId)
      .maybeSingle()
    return { data: data as MlTokenConnectionRow | null, error }
  },
}

export async function persistEncryptedTokens(
  tokens: MlTokens,
  store: MlTokenVaultStore = supabaseTokenVaultStore,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const sealed = sealTokens(tokens, env)

  const result = await store.upsert({
    ml_user_id: tokens.ml_user_id,
    token_payload: sealed.tokenPayload,
    token_key_version: sealed.tokenKeyVersion,
    connection_state: 'connected',
    expires_at: tokens.expires_at.toISOString(),
    last_error_code: null,
    refresh_lease_id: null,
    refresh_lease_expires_at: null,
    updated_at: new Date().toISOString(),
    access_token: null,
    refresh_token: null,
  })
  if (result.error) {
    throw new Error('ML_TOKEN_STORE_WRITE_FAILED')
  }
}

export function sealTokens(
  tokens: MlTokens,
  env: NodeJS.ProcessEnv = process.env,
): SealedMlTokens {
  if (!tokens.access_token || !tokens.refresh_token || !tokens.ml_user_id) {
    throw new Error('ML_OAUTH_TOKENS_INCOMPLETE')
  }

  const config = loadMlTokenSecurityConfig(env)
  if (tokens.ml_user_id !== config.allowedUserId) {
    throw new Error('ML_OAUTH_USER_NOT_ALLOWED')
  }

  return {
    tokenPayload: encryptTokenPair({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    }, config.key),
    tokenKeyVersion: config.keyVersion,
  }
}

export async function loadEncryptedTokens(
  store: MlTokenVaultStore = supabaseTokenVaultStore,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MlTokens> {
  const config = loadMlTokenSecurityConfig(env)
  const result = await store.findByUserId(config.allowedUserId)
  if (result.error) {
    throw new Error('ML_TOKEN_STORE_READ_FAILED')
  }
  if (!result.data) {
    throw new Error('ML_OAUTH_CONNECTION_NOT_FOUND')
  }
  if (result.data.connection_state === 'reconnect_required') {
    throw new Error('ML_OAUTH_RECONNECT_REQUIRED')
  }
  if (result.data.connection_state === 'disconnected') {
    throw new Error('ML_OAUTH_CONNECTION_NOT_FOUND')
  }
  if (
    !result.data.token_payload
    || result.data.token_key_version !== config.keyVersion
  ) {
    throw new Error('ML_TOKEN_KEY_VERSION_UNAVAILABLE')
  }

  const expiresAt = new Date(result.data.expires_at)
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error('ML_OAUTH_CONNECTION_INVALID')
  }
  const pair = decryptTokenPair(result.data.token_payload, config.key)
  return {
    access_token: pair.accessToken,
    refresh_token: pair.refreshToken,
    expires_at: expiresAt,
    ml_user_id: result.data.ml_user_id,
  }
}
