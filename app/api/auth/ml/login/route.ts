import { NextRequest, NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/ml/oauth'
import { randomBytes } from 'node:crypto'

export const runtime = 'nodejs'

/**
 * GET /api/auth/ml/login
 *
 * Inicia o fluxo OAuth do Mercado Livre.
 * Gera um state CSRF, salva em cookie httpOnly e redireciona o usuário pro ML.
 * Após autorizar, o ML chama de volta /api/auth/ml/callback.
 */
export async function GET(_req: NextRequest) {
  try {
    const state = randomBytes(16).toString('hex')
    const authUrl = buildAuthUrl(state)
    const res = NextResponse.redirect(authUrl)
    res.cookies.set('ml_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,    // 10 min — suficiente pra completar o flow
      path: '/',
    })
    return res
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
