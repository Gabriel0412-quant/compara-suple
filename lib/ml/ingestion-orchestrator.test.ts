import { describe, expect, it, vi } from 'vitest'

import {
  executeIngestionBatch,
  type IngestionOrchestrationStore,
} from './ingestion-orchestrator'

const runId = '0199243f-5418-7e26-8d7e-6068e98a5970'
const workerId = '0199243f-5418-7e26-8d7e-6068e98a5971'

function store(overrides: Partial<IngestionOrchestrationStore> = {}): IngestionOrchestrationStore {
  return {
    acquire: vi.fn(async () => ({ disposition: 'acquired' as const, runId, state: 'running' as const })),
    claim: vi.fn(async () => ({ items: [
      { id: 1, key: 'MLB1', attemptCount: 1 },
      { id: 2, key: 'MLB2', attemptCount: 1 },
    ] })),
    heartbeat: vi.fn(async () => true),
    completeItem: vi.fn(async () => undefined),
    block: vi.fn(async () => undefined),
    finalize: vi.fn(async () => ({ state: 'running' as const, counters: {
      total: 3, succeeded: 2, failed: 0, skipped: 0, retryScheduled: 0,
    } })),
    ...overrides,
  }
}

describe('executeIngestionBatch', () => {
  it('does not claim work when another worker owns a live lease', async () => {
    const ingestionStore = store({
      acquire: vi.fn(async () => ({ disposition: 'busy' as const, runId, state: 'running' as const })),
    })

    const result = await executeIngestionBatch({
      itemKeys: ['MLB1'], workerId, now: () => new Date('2026-09-08T09:00:00Z'),
      processItem: vi.fn(),
    }, ingestionStore)

    expect(result).toMatchObject({ disposition: 'busy', runId, hasContinuation: true })
    expect(ingestionStore.claim).not.toHaveBeenCalled()
  })

  it('claims at most the configured batch and completes only its own items', async () => {
    const ingestionStore = store()
    const processItem = vi.fn(async () => ({ ok: true } as const))

    const result = await executeIngestionBatch({
      itemKeys: ['MLB1', 'MLB2', 'MLB3'], workerId,
      now: () => new Date('2026-09-08T09:00:00Z'), batchSize: 2,
      processItem,
    }, ingestionStore)

    expect(ingestionStore.claim).toHaveBeenCalledWith(expect.objectContaining({
      runId, workerId, limit: 2,
    }))
    expect(processItem).toHaveBeenCalledTimes(2)
    expect(ingestionStore.completeItem).toHaveBeenNthCalledWith(1, {
      runId, workerId, itemId: 1, outcome: 'succeeded', errorCode: null,
      retryAt: null,
    })
    expect(result).toMatchObject({ processed: 2, succeeded: 2, hasContinuation: true })
  })

  it('stops without touching another item after losing its lease', async () => {
    const ingestionStore = store({ heartbeat: vi.fn(async () => false) })
    const processItem = vi.fn(async () => ({ ok: true } as const))

    const result = await executeIngestionBatch({
      itemKeys: ['MLB1', 'MLB2'], workerId, now: () => new Date('2026-09-08T09:00:00Z'),
      processItem,
    }, ingestionStore)

    expect(result).toMatchObject({ disposition: 'lease_lost', processed: 0, hasContinuation: true })
    expect(processItem).not.toHaveBeenCalled()
    expect(ingestionStore.completeItem).not.toHaveBeenCalled()
  })

  it('records a sanitized item failure and keeps the remaining items eligible', async () => {
    const ingestionStore = store()
    const processItem = vi.fn()
      .mockResolvedValueOnce({
        ok: false as const,
        failure: { classification: 'internal' as const, code: 'persistence_failed' },
      })
      .mockResolvedValueOnce({ ok: true } as const)

    const result = await executeIngestionBatch({
      itemKeys: ['MLB1', 'MLB2'], workerId, now: () => new Date('2026-09-08T09:00:00Z'),
      processItem,
    }, ingestionStore)

    expect(ingestionStore.completeItem).toHaveBeenNthCalledWith(1, {
      runId, workerId, itemId: 1, outcome: 'retry_scheduled', errorCode: 'persistence_failed',
      retryAt: expect.any(Date),
    })
    expect(result).toMatchObject({ processed: 2, succeeded: 1, failed: 0, retryScheduled: 1 })
  })

  it('leaves an unstarted item for the next dispatch when the time budget ends', async () => {
    let nowMs = Date.parse('2026-09-08T09:00:00Z')
    const ingestionStore = store()
    const processItem = vi.fn(async () => {
      nowMs += 1_080
      return { ok: true } as const
    })

    const result = await executeIngestionBatch({
      itemKeys: ['MLB1', 'MLB2'], workerId, timeBudgetMs: 1_000,
      now: () => new Date(nowMs), processItem,
    }, ingestionStore)

    expect(processItem).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ processed: 1, hasContinuation: true })
  })

  it('blocks the run on an unrecoverable OAuth failure without processing another item', async () => {
    const ingestionStore = store()
    const processItem = vi.fn(async () => ({
      ok: false as const,
      failure: { classification: 'auth_blocking' as const, code: 'oauth_reconnect_required' },
    }))

    const result = await executeIngestionBatch({
      itemKeys: ['MLB1', 'MLB2'], workerId, now: () => new Date('2026-09-08T09:00:00Z'),
      processItem,
    }, ingestionStore)

    expect(result).toMatchObject({ disposition: 'blocked', state: 'blocked', processed: 1 })
    expect(ingestionStore.block).toHaveBeenCalledWith(expect.objectContaining({
      runId, workerId, itemId: 1, errorCode: 'oauth_reconnect_required',
    }))
    expect(processItem).toHaveBeenCalledOnce()
    expect(ingestionStore.finalize).not.toHaveBeenCalled()
  })
})
