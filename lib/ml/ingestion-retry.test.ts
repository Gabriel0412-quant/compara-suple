import { describe, expect, it } from 'vitest'

import { decideIngestionRetry } from './ingestion-retry'

const now = new Date('2026-09-08T09:00:00.000Z')

describe('ingestion retry policy', () => {
  it('schedules a jittered exponential retry for a transient failure', () => {
    const decision = decideIngestionRetry({
      failure: { classification: 'transient', code: 'ml_rate_limited' },
      attempt: 2,
      maxAttempts: 5,
      now,
      random: () => 0,
    })

    expect(decision).toEqual({
      outcome: 'retry_scheduled',
      code: 'ml_rate_limited',
      retryAt: new Date('2026-09-08T09:00:05.000Z'),
    })
  })

  it('never schedules before the provider Retry-After instant', () => {
    const decision = decideIngestionRetry({
      failure: { classification: 'transient', code: 'ml_rate_limited', retryAfterMs: 60_000 },
      attempt: 1,
      maxAttempts: 5,
      now,
      random: () => 0,
    })

    expect(decision).toEqual(expect.objectContaining({
      outcome: 'retry_scheduled',
      retryAt: new Date('2026-09-08T09:01:00.000Z'),
    }))
  })

  it.each([
    { classification: 'permanent' as const, code: 'ml_not_found' },
    { classification: 'internal' as const, code: 'persistence_failed' },
  ])('does not loop a final failure: $classification', failure => {
    const decision = decideIngestionRetry({
      failure,
      attempt: failure.classification === 'internal' ? 5 : 1,
      maxAttempts: 5,
      now,
    })

    expect(decision).toEqual({ outcome: 'failed', code: failure.code })
  })

  it('blocks instead of retrying an unrecoverable authentication failure', () => {
    expect(decideIngestionRetry({
      failure: { classification: 'auth_blocking', code: 'oauth_reconnect_required' },
      attempt: 1,
      maxAttempts: 5,
      now,
    })).toEqual({ outcome: 'blocked', code: 'oauth_reconnect_required' })
  })
})
