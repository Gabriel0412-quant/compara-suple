import { randomUUID } from 'node:crypto'

import {
  acquireRefreshLease,
  completeRefreshLease,
  releaseRefreshLease,
} from './refresh-lease'
import {
  loadEncryptedTokens,
  sealTokens,
  type SealedMlTokens,
} from './token-vault'
import type { MlTokens } from './token-response'

const REFRESH_MARGIN_MS = 5 * 60 * 1000
const REFRESH_WAIT_TIMEOUT_MS = 10 * 1000
const REFRESH_WAIT_INTERVAL_MS = 100

type CompleteLeaseInput = {
  mlUserId: number
  leaseId: string
  tokenPayload: string
  tokenKeyVersion: number
  expiresAt: Date
}

type ReleaseLeaseInput = {
  mlUserId: number
  leaseId: string
  errorCode: string
  reconnectRequired: boolean
}

export type AccessTokenDependencies = {
  loadTokens(): Promise<MlTokens>
  acquireLease(mlUserId: number, leaseId: string): Promise<boolean>
  completeLease(input: CompleteLeaseInput): Promise<boolean>
  releaseLease(input: ReleaseLeaseInput): Promise<boolean>
  sealTokens(tokens: MlTokens): SealedMlTokens
  refreshTokens(refreshToken: string): Promise<MlTokens>
  newLeaseId(): string
  now(): number
  wait(milliseconds: number): Promise<void>
}

export function createAccessTokenDependencies(
  refreshTokens: (refreshToken: string) => Promise<MlTokens>,
): AccessTokenDependencies {
  return {
    loadTokens: loadEncryptedTokens,
    acquireLease: acquireRefreshLease,
    completeLease: completeRefreshLease,
    releaseLease: releaseRefreshLease,
    sealTokens,
    refreshTokens,
    newLeaseId: randomUUID,
    now: Date.now,
    wait: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  }
}

function isUsable(tokens: MlTokens, now: number): boolean {
  return tokens.expires_at.getTime() - now > REFRESH_MARGIN_MS
}

async function waitForLeaseOwner(
  deps: AccessTokenDependencies,
): Promise<string> {
  const deadline = deps.now() + REFRESH_WAIT_TIMEOUT_MS
  while (deps.now() < deadline) {
    await deps.wait(REFRESH_WAIT_INTERVAL_MS)
    const tokens = await deps.loadTokens()
    if (isUsable(tokens, deps.now())) {
      return tokens.access_token
    }
  }
  throw new Error('ML_OAUTH_REFRESH_BUSY')
}

export async function getEncryptedAccessToken(
  deps: AccessTokenDependencies,
): Promise<string> {
  const current = await deps.loadTokens()
  if (isUsable(current, deps.now())) {
    return current.access_token
  }

  const leaseId = deps.newLeaseId()
  const acquired = await deps.acquireLease(current.ml_user_id, leaseId)
  if (!acquired) {
    return waitForLeaseOwner(deps)
  }

  try {
    console.info('ml_oauth_event', { event: 'refresh_started' })
    const fresh = await deps.refreshTokens(current.refresh_token)
    const sealed = deps.sealTokens(fresh)
    const completed = await deps.completeLease({
      mlUserId: current.ml_user_id,
      leaseId,
      tokenPayload: sealed.tokenPayload,
      tokenKeyVersion: sealed.tokenKeyVersion,
      expiresAt: fresh.expires_at,
    })
    if (!completed) {
      throw new Error('ML_OAUTH_REFRESH_LEASE_LOST')
    }
    console.info('ml_oauth_event', { event: 'refresh_succeeded' })
    return fresh.access_token
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const reconnectRequired = message === 'ML_OAUTH_INVALID_GRANT'
    try {
      await deps.releaseLease({
        mlUserId: current.ml_user_id,
        leaseId,
        errorCode: reconnectRequired ? 'invalid_grant' : 'refresh_failed',
        reconnectRequired,
      })
    } catch {
      console.error('ml_oauth_event', { event: 'refresh_lease_release_failed' })
    }
    console.error('ml_oauth_event', {
      event: reconnectRequired ? 'reconnect_required' : 'refresh_failed',
    })
    if (reconnectRequired) {
      throw new Error('ML_OAUTH_RECONNECT_REQUIRED')
    }
    throw error
  }
}
