import { NextRequest, NextResponse } from 'next/server'
import { runCuratedIngest } from '@/lib/ml/ingest'
import { classifyMlIngestError, getMissingMlIngestConfig } from '@/lib/ml/runtime'

// Roda em Node.js runtime (não Edge) — temos chamadas longas e múltiplas
export const runtime = 'nodejs'
// Vercel Pro permite até 300s; Hobby tem 60s. Ajustar se for plano Hobby.
export const maxDuration = 300

function authorize(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('ml_ingest_configuration_error', { missing: ['CRON_SECRET'] })
    return NextResponse.json(
      { ok: false, error: 'configuration_error' },
      { status: 503 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  const missing = getMissingMlIngestConfig().filter(name => name !== 'CRON_SECRET')
  if (missing.length > 0) {
    console.error('ml_ingest_configuration_error', { missing })
    return NextResponse.json(
      { ok: false, error: 'configuration_error' },
      { status: 503 },
    )
  }
  return null
}

/**
 * `?simular=1` executa a reconciliação e desfaz o efeito, devolvendo os
 * mesmos contadores. Serve para ver o que a coleta faria antes que ela faça —
 * e fica atrás da mesma autorização, porque a simulação bate no Mercado Livre
 * e no banco como a execução real.
 */
function querSimular(req: NextRequest): boolean {
  const valor = req.nextUrl.searchParams.get('simular')
  return valor === '1' || valor === 'true'
}

/**
 * POST /api/cron/ml-ingest
 *
 * Roda a ingestão de todos os IDs em data/items.json.
 * Header obrigatório: `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function POST(req: NextRequest) {
  const rejection = authorize(req)
  if (rejection) return rejection
  return runIngest(querSimular(req))
}

async function runIngest(simular: boolean) {
  try {
    const result = await runCuratedIngest({ simular })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const error = classifyMlIngestError(e)
    console.error('ml_ingest_failed', { error })
    return NextResponse.json(
      { ok: false, error },
      { status: error === 'ingestion_failed' ? 500 : 503 },
    )
  }
}

export async function GET(req: NextRequest) {
  const rejection = authorize(req)
  if (rejection) return rejection
  return runIngest(querSimular(req))
}
