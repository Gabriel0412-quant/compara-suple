import { NextRequest, NextResponse } from 'next/server'
import { runDefaultIngest, ingestKeyword } from '@/lib/ml/ingest'

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
 * Sem body  → roda a lista DEFAULT_KEYWORDS.
 * Body JSON `{ "keyword": "...", "category": "..." }` → roda só essa keyword.
 *
 * Header obrigatório: `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: { keyword?: string; category?: string } = {}
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      payload = await req.json()
    }
  } catch {
    // body inválido ou vazio — segue com defaults
  }

  try {
    if (payload.keyword) {
      const result = await ingestKeyword(payload.keyword, payload.category)
      return NextResponse.json({ ok: true, mode: 'single', result })
    }
    const result = await runDefaultIngest()
    return NextResponse.json({ ok: true, mode: 'default', result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

/** GET serve apenas para healthcheck — não roda ingest. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'ml-ingest',
    method: 'POST com Authorization: Bearer $CRON_SECRET',
  })
}
