export type IngestionFailureClass =
  | 'transient'
  | 'auth_blocking'
  | 'permanent'
  | 'internal'

export type IngestionFailure = {
  classification: IngestionFailureClass
  code: string
  retryAfterMs?: number
}

export type RetryDecision =
  | { outcome: 'retry_scheduled'; retryAt: Date; code: string }
  | { outcome: 'failed'; code: string }
  | { outcome: 'blocked'; code: string }

const BASE_DELAY_MS = 5_000
const MAX_BACKOFF_MS = 15 * 60_000

export function decideIngestionRetry(input: {
  failure: IngestionFailure
  attempt: number
  maxAttempts: number
  now: Date
  random?: () => number
}): RetryDecision {
  if (input.failure.classification === 'auth_blocking') {
    return { outcome: 'blocked', code: input.failure.code }
  }
  if (input.failure.classification === 'permanent' || input.attempt >= input.maxAttempts) {
    return { outcome: 'failed', code: input.failure.code }
  }

  const random = input.random ?? Math.random
  const cappedBackoff = Math.min(
    MAX_BACKOFF_MS,
    BASE_DELAY_MS * 2 ** Math.max(0, input.attempt - 1),
  )
  const jitteredBackoff = Math.floor(cappedBackoff / 2 + random() * cappedBackoff / 2)
  const retryAfterMs = Math.max(0, input.failure.retryAfterMs ?? 0)

  return {
    outcome: 'retry_scheduled',
    code: input.failure.code,
    retryAt: new Date(input.now.getTime() + Math.max(jitteredBackoff, retryAfterMs)),
  }
}
