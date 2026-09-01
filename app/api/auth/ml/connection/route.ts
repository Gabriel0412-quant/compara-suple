import { NextRequest, NextResponse } from 'next/server'

import { checkMlAdminAuthorization } from '@/lib/ml/admin-auth'
import {
  disconnectMlConnection,
  getMlConnectionMetadata,
} from '@/lib/ml/connection'
import { logMlOAuthEvent } from '@/lib/ml/operational-event'

export const runtime = 'nodejs'

function rejectUnauthorized(req: NextRequest): NextResponse | null {
  const result = checkMlAdminAuthorization(
    req.headers.get('authorization') ?? undefined,
  )
  if (result === 'configuration_error') {
    return NextResponse.json(
      { ok: false, error: 'configuration_error' },
      { status: 503 },
    )
  }
  if (result === 'unauthorized') {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }
  return null
}

export async function GET(req: NextRequest) {
  const rejection = rejectUnauthorized(req)
  if (rejection) return rejection

  try {
    const connection = await getMlConnectionMetadata()
    return NextResponse.json({ ok: true, connection })
  } catch {
    logMlOAuthEvent({
      event: 'connection_status',
      result: 'failure',
      durationMs: 0,
      code: 'status_failed',
    })
    return NextResponse.json(
      { ok: false, error: 'connection_status_failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const rejection = rejectUnauthorized(req)
  if (rejection) return rejection

  const startedAt = Date.now()
  try {
    const changed = await disconnectMlConnection()
    logMlOAuthEvent({
      event: 'disconnected',
      result: 'success',
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({
      ok: true,
      connection: { state: 'disconnected', changed },
    })
  } catch {
    logMlOAuthEvent({
      event: 'disconnected',
      result: 'failure',
      code: 'disconnect_failed',
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(
      { ok: false, error: 'disconnect_failed' },
      { status: 500 },
    )
  }
}
