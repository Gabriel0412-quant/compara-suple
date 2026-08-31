import { supabaseAdmin } from '../db-admin'
import { parseMlTokenResponse, type MlTokens } from './token-response'

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

const REFRESH_MARGIN_MS = 5 * 60 * 1000  // refresh se faltar menos de 5min

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
  if (!tokens.ml_user_id || !tokens.access_token || !tokens.refresh_token) {
    throw new Error('ML_OAUTH_TOKENS_INCOMPLETE')
  }
  const { error } = await supabaseAdmin
    .from('ml_oauth_tokens')
    .upsert(
      {
        ml_user_id: tokens.ml_user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ml_user_id' },
    )
  if (error) {
    throw new Error(
      `Supabase upsert ml_oauth_tokens falhou: ${error.message} ` +
      `(code=${error.code}, details=${error.details ?? 'n/a'})`,
    )
  }
}

/**
 * Retorna um access_token válido — refresha automaticamente se faltar < 5min
 * pra expirar. Falha se não houver nenhum token salvo (precisa fazer login
 * via /api/auth/ml/login antes).
 */
export async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('ml_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error(
      'Nenhum token ML salvo no Supabase. Faça login em /api/auth/ml/login primeiro.',
    )
  }

  const expiresAt = new Date(data.expires_at as string)
  const now = Date.now()
  if (expiresAt.getTime() - now > REFRESH_MARGIN_MS) {
    return data.access_token as string
  }

  // Token expirado ou perto de expirar — refresha
  const rt = data.refresh_token as string
  if (!rt) {
    throw new Error(
      'access_token ML expirou e não há refresh_token salvo. ' +
      'Faça login novamente em /api/auth/ml/login.',
    )
  }
  const fresh = await refreshTokens(rt)
  await saveTokens(fresh)
  return fresh.access_token
}
