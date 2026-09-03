import { describe, expect, it } from 'vitest'

import {
  getReadiness,
  getReadinessThresholds,
  readinessFromSnapshot,
  type ReadinessStore,
  type ReadinessThresholds,
} from './readiness'

const now = new Date('2026-09-03T12:00:00Z')
const thresholds: ReadinessThresholds = {
  degradedAfterHours: 30,
  unavailableAfterHours: 72,
  timeoutMs: 50,
}

function snapshotHoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString()
}

function storeWith(snapshot: string | null): ReadinessStore {
  return { getOldestAvailableOfferFetchedAt: async () => snapshot }
}

describe('readinessFromSnapshot', () => {
  it('is healthy with available and fresh offers', () => {
    expect(readinessFromSnapshot(snapshotHoursAgo(30), now, thresholds)).toEqual({
      status: 'healthy',
    })
  })

  it('is degraded when the catalog is empty', () => {
    expect(readinessFromSnapshot(null, now, thresholds)).toEqual({
      status: 'degraded',
    })
  })

  it('is degraded after thirty hours without a complete current catalog', () => {
    expect(readinessFromSnapshot(snapshotHoursAgo(31), now, thresholds)).toEqual({
      status: 'degraded',
    })
  })

  it('is unavailable after seventy-two hours', () => {
    expect(readinessFromSnapshot(snapshotHoursAgo(73), now, thresholds)).toEqual({
      status: 'unavailable',
    })
  })

  it('is unavailable when the timestamp is invalid', () => {
    expect(readinessFromSnapshot('invalid', now, thresholds)).toEqual({
      status: 'unavailable',
    })
  })
})

describe('getReadiness', () => {
  it('does not expose database failures', async () => {
    const store: ReadinessStore = {
      getOldestAvailableOfferFetchedAt: async () => {
        throw new Error('database host and credentials')
      },
    }

    await expect(getReadiness(store, now, thresholds)).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('times out a dependency that does not respond', async () => {
    const store: ReadinessStore = {
      getOldestAvailableOfferFetchedAt: () => new Promise<string | null>(() => undefined),
    }

    await expect(getReadiness(store, now, thresholds)).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('reads a fresh snapshot from the store', async () => {
    await expect(getReadiness(storeWith(snapshotHoursAgo(2)), now, thresholds)).resolves.toEqual({
      status: 'healthy',
    })
  })
})

describe('getReadinessThresholds', () => {
  it('uses defaults and accepts valid environment overrides', () => {
    expect(getReadinessThresholds({})).toMatchObject({
      degradedAfterHours: 30,
      unavailableAfterHours: 72,
    })
    expect(getReadinessThresholds({
      READINESS_DEGRADED_AFTER_HOURS: '24',
      READINESS_UNAVAILABLE_AFTER_HOURS: '48',
      READINESS_TIMEOUT_MS: '500',
    })).toEqual({
      degradedAfterHours: 24,
      unavailableAfterHours: 48,
      timeoutMs: 500,
    })
  })

  it('keeps safe defaults for invalid values', () => {
    expect(getReadinessThresholds({
      READINESS_DEGRADED_AFTER_HOURS: '0',
      READINESS_UNAVAILABLE_AFTER_HOURS: '30',
      READINESS_TIMEOUT_MS: 'invalid',
    })).toEqual({
      degradedAfterHours: 30,
      unavailableAfterHours: 72,
      timeoutMs: 2_000,
    })
  })
})
