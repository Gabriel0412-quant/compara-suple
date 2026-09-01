import { createHash } from 'node:crypto'

import { supabaseAdmin } from '../db-admin'

type StoreResult<T> = {
  data?: T | null
  error: unknown | null
}

type OAuthAttemptWrite = {
  state_hash: string
  expires_at: string
}

export type MlOAuthAttemptStore = {
  insert(attempt: OAuthAttemptWrite): Promise<StoreResult<never>>
  consume(stateHash: string): Promise<StoreResult<boolean>>
}

const supabaseOAuthAttemptStore: MlOAuthAttemptStore = {
  async insert(attempt) {
    const { error } = await supabaseAdmin
      .from('ml_oauth_attempt')
      .insert(attempt)
    return { error }
  },
  async consume(stateHash) {
    const { data, error } = await supabaseAdmin
      .rpc('consume_ml_oauth_attempt', { p_state_hash: stateHash })
    return { data: data === true, error }
  },
}

export function hashOAuthState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex')
}

export async function createOAuthAttempt(
  state: string,
  store: MlOAuthAttemptStore = supabaseOAuthAttemptStore,
  now = new Date(),
): Promise<void> {
  if (!state) {
    throw new Error('ML_OAUTH_STATE_INVALID')
  }
  const result = await store.insert({
    state_hash: hashOAuthState(state),
    expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
  })
  if (result.error) {
    throw new Error('ML_OAUTH_ATTEMPT_WRITE_FAILED')
  }
}

export async function consumeOAuthAttempt(
  state: string,
  store: MlOAuthAttemptStore = supabaseOAuthAttemptStore,
): Promise<boolean> {
  if (!state) return false
  const result = await store.consume(hashOAuthState(state))
  if (result.error) {
    throw new Error('ML_OAUTH_ATTEMPT_CONSUME_FAILED')
  }
  return result.data === true
}
