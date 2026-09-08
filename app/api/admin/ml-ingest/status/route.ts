import { NextRequest, NextResponse } from 'next/server'

import { checkMlAdminAuthorization } from '@/lib/ml/admin-auth'
import { getIngestionOperationalStatus } from '@/lib/ml/ingestion-status'

export const runtime = 'nodejs'

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

export async function GET(req: NextRequest) {
  const rejection = authorize(req)
  if (rejection) return rejection
  try {
    const status = await getIngestionOperationalStatus()
    return NextResponse.json({ ok: status.status !== 'unavailable', status }, {
      status: status.status === 'unavailable' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    console.error('ml_ingestion_status_failed', { error: 'status_failed' })
    return NextResponse.json({ ok: false, error: 'status_failed' }, { status: 503 })
  }
}
