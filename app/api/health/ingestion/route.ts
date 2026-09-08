import { NextResponse } from 'next/server'

import { getIngestionOperationalStatus } from '@/lib/ml/ingestion-status'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const status = await getIngestionOperationalStatus()
    const unavailable = status.status === 'unavailable'
    return NextResponse.json({ ok: !unavailable, status: status.status }, {
      status: unavailable ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ ok: false, status: 'unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
