import { NextRequest, NextResponse } from 'next/server'

import { checkMlAdminAuthorization } from '@/lib/ml/admin-auth'
import { replayIngestionRun } from '@/lib/ml/ingestion-run'

export const runtime = 'nodejs'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReplayRequest = {
  runId: string
  itemId?: number
  includeCompleted: boolean
}

function authorize(req: NextRequest): NextResponse | null {
  const result = checkMlAdminAuthorization(req.headers.get('authorization') ?? undefined)
  if (result === 'configuration_error') {
    return NextResponse.json({ ok: false, error: 'configuration_error' }, { status: 503 })
  }
  if (result === 'unauthorized') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return null
}

function parseReplayRequest(value: unknown): ReplayRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (typeof body.runId !== 'string' || !uuidPattern.test(body.runId)) return null
  if (body.itemId !== undefined && (!Number.isSafeInteger(body.itemId) || Number(body.itemId) < 1)) {
    return null
  }
  if (body.includeCompleted !== undefined && typeof body.includeCompleted !== 'boolean') return null
  return {
    runId: body.runId,
    ...(body.itemId === undefined ? {} : { itemId: Number(body.itemId) }),
    includeCompleted: body.includeCompleted === true,
  }
}

export async function POST(req: NextRequest) {
  const rejection = authorize(req)
  if (rejection) return rejection

  const request = parseReplayRequest(await req.json().catch(() => null))
  if (!request) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }

  try {
    const replay = await replayIngestionRun(request)
    console.info('ml_ingestion_replay', {
      run_id: request.runId,
      ...(request.itemId === undefined ? {} : { item_id: request.itemId }),
      include_completed: request.includeCompleted,
      requeued_count: replay.requeuedCount,
      state: replay.state,
    })
    return NextResponse.json({ ok: true, replay: {
      runId: request.runId,
      ...(request.itemId === undefined ? {} : { itemId: request.itemId }),
      includeCompleted: request.includeCompleted,
      requeuedCount: replay.requeuedCount,
      state: replay.state,
    } })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'INGESTION_REPLAY_SCOPE_INVALID') {
      return NextResponse.json({ ok: false, error: 'replay_scope_not_found' }, { status: 404 })
    }
    if (code === 'INGESTION_REPLAY_RUN_BUSY') {
      return NextResponse.json({ ok: false, error: 'replay_run_busy' }, { status: 409 })
    }
    console.error('ml_ingestion_replay_failed', { error: 'replay_failed' })
    return NextResponse.json({ ok: false, error: 'replay_failed' }, { status: 500 })
  }
}
