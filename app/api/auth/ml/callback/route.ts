import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/ml/oauth'
import { consumeOAuthAttempt } from '@/lib/ml/oauth-attempt'
import { persistEncryptedTokens } from '@/lib/ml/token-vault'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!state) {
    return NextResponse.json(
      { ok: false, error: 'invalid_state' },
      { status: 400 },
    )
  }

  let validAttempt: boolean
  try {
    validAttempt = await consumeOAuthAttempt(state)
  } catch {
    console.error('ml_oauth_event', { event: 'attempt_consume_failed' })
    return NextResponse.json(
      { ok: false, error: 'authorization_failed' },
      { status: 500 },
    )
  }
  if (!validAttempt) {
    return NextResponse.json(
      { ok: false, error: 'invalid_state' },
      { status: 400 },
    )
  }
  if (!code) {
    return NextResponse.json(
      { ok: false, error: 'authorization_denied' },
      { status: 400 },
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await persistEncryptedTokens(tokens)
    console.info('ml_oauth_event', { event: 'connected' })
    return NextResponse.json({
      ok: true,
      ml_user_id: tokens.ml_user_id,
      expires_at: tokens.expires_at.toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === 'ML_OAUTH_USER_NOT_ALLOWED') {
      console.info('ml_oauth_event', { event: 'authorization_rejected' })
      return NextResponse.json(
        { ok: false, error: 'account_not_allowed' },
        { status: 403 },
      )
    }
    if (message === 'ML_OAUTH_SECURITY_CONFIGURATION_INVALID') {
      console.error('ml_oauth_event', { event: 'configuration_error' })
      return NextResponse.json(
        { ok: false, error: 'configuration_error' },
        { status: 503 },
      )
    }
    console.error('ml_oauth_event', { event: 'authorization_failed' })
    return NextResponse.json(
      { ok: false, error: 'authorization_failed' },
      { status: 500 },
    )
  }
}
