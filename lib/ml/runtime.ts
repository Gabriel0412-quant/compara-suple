const REQUIRED_ML_INGEST_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ML_APP_ID',
  'ML_CLIENT_SECRET',
  'ML_ALLOWED_USER_ID',
  'ML_TOKEN_ENCRYPTION_KEY',
  'ML_TOKEN_ENCRYPTION_KEY_VERSION',
  'CRON_SECRET',
] as const

export type MlIngestErrorCode =
  | 'auth_required'
  | 'configuration_error'
  | 'ingestion_failed'

export function getMissingMlIngestConfig(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return REQUIRED_ML_INGEST_ENV.filter(name => !env[name])
}

export function classifyMlIngestError(error: unknown): MlIngestErrorCode {
  const message = error instanceof Error ? error.message : String(error)

  if (
    message.includes('ML_OAUTH_SECURITY_CONFIGURATION_INVALID')
    || message.includes('ML_TOKEN_KEY_VERSION_UNAVAILABLE')
  ) {
    return 'configuration_error'
  }
  if (
    message.includes('ML_OAUTH_REFRESH_TOKEN_MISSING') ||
    message.includes('ML_OAUTH_RESPONSE_INCOMPLETE') ||
    message.includes('ML_OAUTH_TOKENS_INCOMPLETE') ||
    message.includes('ML_OAUTH_REQUEST_FAILED_401') ||
    message.includes('ML_OAUTH_REQUEST_FAILED_403') ||
    message.includes('ML_OAUTH_CONNECTION_NOT_FOUND') ||
    message.includes('ML_OAUTH_RECONNECT_REQUIRED') ||
    message.includes('Nenhum token ML') ||
    message.includes('refresh_token') ||
    message.includes('ML OAuth 401') ||
    message.includes('ML OAuth 403')
  ) {
    return 'auth_required'
  }
  if (message.includes('ausente') || message.includes('configuration')) {
    return 'configuration_error'
  }
  return 'ingestion_failed'
}
