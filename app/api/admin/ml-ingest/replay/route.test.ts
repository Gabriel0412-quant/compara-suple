import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { replayIngestionRun } = vi.hoisted(() => ({ replayIngestionRun: vi.fn() }))

vi.mock('@/lib/ml/ingestion-run', () => ({ replayIngestionRun }))

import { POST } from './route'

const secret = 'a'.repeat(64)
const runId = '0199243f-5418-7e26-8d7e-6068e98a5970'

function request(body: unknown, authorization?: string): NextRequest {
  return new NextRequest('https://example.com/api/admin/ml-ingest/replay', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/ml-ingest/replay', () => {
  beforeEach(() => {
    vi.stubEnv('ML_ADMIN_SECRET', secret)
    replayIngestionRun.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects a replay without administrative authorization before changing state', async () => {
    const response = await POST(request({ runId }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'unauthorized' })
    expect(replayIngestionRun).not.toHaveBeenCalled()
  })

  it('replays only the requested item and keeps completed items closed by default', async () => {
    replayIngestionRun.mockResolvedValue({ state: 'pending', requeuedCount: 1 })

    const response = await POST(request({ runId, itemId: 42 }, `Bearer ${secret}`))

    expect(response.status).toBe(200)
    expect(replayIngestionRun).toHaveBeenCalledWith({
      runId, itemId: 42, includeCompleted: false,
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      replay: { runId, itemId: 42, includeCompleted: false, requeuedCount: 1, state: 'pending' },
    })
  })

  it('requires an explicit flag to requeue completed items', async () => {
    replayIngestionRun.mockResolvedValue({ state: 'pending', requeuedCount: 2 })

    await POST(request({ runId, includeCompleted: true }, `Bearer ${secret}`))

    expect(replayIngestionRun).toHaveBeenCalledWith({
      runId, includeCompleted: true,
    })
  })

  it('does not expose storage details for a missing replay scope', async () => {
    replayIngestionRun.mockRejectedValue(new Error('INGESTION_REPLAY_SCOPE_INVALID'))

    const response = await POST(request({ runId, itemId: 42 }, `Bearer ${secret}`))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'replay_scope_not_found' })
  })
})
