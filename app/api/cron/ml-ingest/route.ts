import { NextRequest, NextResponse } from 'next/server'
import { runCuratedIngest } from '@/lib/ml/ingest'

// Roda em Node.js runtime (não Edge) — temos chamadas longas e múltiplas
export const runtime = 'nodejs'
// Vercel Pro permite até 300s; Hobby tem 60s. Ajustar se for plano Hobby.
export const maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const got = req.headers.get('authorization')
  return got === `Bearer ${expected}`
}

/**
 * POST /api/cron/ml-ingest
 *
 * Roda a ingestão de todos os IDs em data/items.json.
 * Header obrigatório: `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runCuratedIngest()
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    console.error('ml-ingest error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

/** GET — healthcheck */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'ml-ingest',
    method: 'POST com Authorization: Bearer $CRON_SECRET',
  })
}
