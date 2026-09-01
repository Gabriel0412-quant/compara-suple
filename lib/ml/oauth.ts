import {
  createAccessTokenDependencies,
  getEncryptedAccessToken,
} from './access-token'
import { parseMlTokenResponse, type MlTokens } from './token-response'
import { persistEncryptedTokens } from './token-vault'

/**
 * Authorization Code flow do Mercado Livre.
 *
 * Fluxo:
 *   1. App → GET /api/auth/ml/login → 302 pro ML auth URL (com state CSRF)
 *   2. Usuário autoriza no ML
 *   3. ML → GET /api/auth/ml/callback?code=...&state=...
 *   4. Callback exchange code por (access_token, refresh_token) → salva no Supabase
 *   5. Ingest pega access_token via getValidAccessToken (auto-refresh se expirado)
 */

const AUTH_URL  = 'https://auth.mercadolivre.com.br/authorization'
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'

export type { MlTokens } from './token-response'

// ---------- URL builders ----------

export function buildAuthUrl(state: string): string {
  const appId    = process.env.ML_APP_ID
  const redirect = process.env.ML_REDIRECT_URI
  if (!appId || !redirect) {
    throw new Error('ML_APP_ID ou ML_REDIRECT_URI ausentes no env')
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: appId,
    redirect_uri: redirect,
    state,
    // offline_access é necessário pra ML devolver refresh_token
    scope: 'offline_access',
  })
  return `${AUTH_URL}?${params.toString()}`
}

// ---------- OAuth flow ----------

async function postToken(body: URLSearchParams): Promise<MlTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => null) as Record<string, unknown> | null
    if (payload?.error === 'invalid_grant') {
      throw new Error('ML_OAUTH_INVALID_GRANT')
    }
    throw new Error(`ML_OAUTH_REQUEST_FAILED_${res.status}`)
  }
  return parseMlTokenResponse(await res.json())
}

export async function exchangeCodeForTokens(code: string): Promise<MlTokens> {
  const appId    = process.env.ML_APP_ID
  const secret   = process.env.ML_CLIENT_SECRET
  const redirect = process.env.ML_REDIRECT_URI
  if (!appId || !secret || !redirect) {
    throw new Error('ML_APP_ID / ML_CLIENT_SECRET / ML_REDIRECT_URI ausentes no env')
  }
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: appId,
      client_secret: secret,
      code,
      redirect_uri: redirect,
    }),
  )
}

export async function refreshTokens(refreshToken: string): Promise<MlTokens> {
  const appId  = process.env.ML_APP_ID
  const secret = process.env.ML_CLIENT_SECRET
  if (!appId || !secret) {
    throw new Error('ML_APP_ID / ML_CLIENT_SECRET ausentes no env')
  }
  return postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: appId,
      client_secret: secret,
      refresh_token: refreshToken,
    }),
  )
}

// ---------- Persistência ----------

export async function saveTokens(tokens: MlTokens): Promise<void> {
  return persistEncryptedTokens(tokens)
}

/**
 * Retorna um access_token válido — refresha automaticamente se faltar < 5min
 * pra expirar. Falha se não houver nenhum token salvo (precisa fazer login
 * via /api/auth/ml/login antes).
 */
export async function getValidAccessToken(): Promise<string> {
  return getEncryptedAccessToken(createAccessTokenDependencies(refreshTokens))
}
