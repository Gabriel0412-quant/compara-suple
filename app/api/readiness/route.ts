import { NextResponse } from 'next/server'

import { getReadiness } from '@/lib/readiness'

export const runtime = 'nodejs'

export async function GET() {
  const readiness = await getReadiness()
  const unavailable = readiness.status === 'unavailable'

  return NextResponse.json(
    {
      ok: !unavailable,
      status: readiness.status,
    },
    {
      status: unavailable ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
