import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { checkMlAdminAuthorization } from '@/lib/ml/admin-auth'
import { buildAuthUrl } from '@/lib/ml/oauth'
import { createOAuthAttempt } from '@/lib/ml/oauth-attempt'
import { loadMlTokenSecurityConfig } from '@/lib/ml/security-config'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const authorization = checkMlAdminAuthorization(
    req.headers.get('authorization') ?? undefined,
  )
  if (authorization === 'configuration_error') {
    return NextResponse.json(
      { ok: false, error: 'configuration_error' },
      { status: 503 },
    )
  }
  if (authorization === 'unauthorized') {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  try {
    loadMlTokenSecurityConfig()
    const state = randomBytes(32).toString('base64url')
    const authUrl = buildAuthUrl(state)
    await createOAuthAttempt(state)
    console.info('ml_oauth_event', { event: 'authorization_started' })
    return NextResponse.json(
      { ok: true, authorization_url: authUrl },
      { status: 201 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const configurationError =
      message === 'ML_OAUTH_SECURITY_CONFIGURATION_INVALID'
      || message.includes('ausentes no env')
    const error = configurationError
      ? 'configuration_error'
      : 'authorization_start_failed'
    console.error('ml_oauth_event', { event: error })
    return NextResponse.json(
      { ok: false, error },
      { status: configurationError ? 503 : 500 },
    )
  }
}
