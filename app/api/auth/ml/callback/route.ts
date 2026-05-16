import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, saveTokens } from '@/lib/ml/oauth'

export const runtime = 'nodejs'

/**
 * GET /api/auth/ml/callback?code=...&state=...
 *
 * Endpoint que o ML chama de volta após o usuário autorizar.
 * Valida CSRF state, troca code por tokens, salva no Supabase.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('ml_oauth_state')?.value

  if (!code) {
    const mlError = url.searchParams.get('error') ?? 'desconhecido'
    return NextResponse.json(
      { ok: false, error: 'code ausente', ml_error: mlError },
      { status: 400 },
    )
  }

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      { ok: false, error: 'state inválido (possível CSRF)' },
      { status: 400 },
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveTokens(tokens)
    const res = NextResponse.json({
      ok: true,
      message: 'OAuth concluído. Tokens salvos no Supabase. Pode rodar a ingestão agora.',
      ml_user_id: tokens.ml_user_id,
      expires_at: tokens.expires_at.toISOString(),
    })
    res.cookies.delete('ml_oauth_state')
    return res
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
