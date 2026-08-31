export type MlTokens = {
  access_token: string
  refresh_token: string
  expires_at: Date
  ml_user_id: number
}

export function parseMlTokenResponse(
  input: unknown,
  now = Date.now(),
): MlTokens {
  if (typeof input !== 'object' || input === null) {
    throw new Error('ML_OAUTH_RESPONSE_INCOMPLETE')
  }

  const data = input as Record<string, unknown>
  const accessToken = typeof data.access_token === 'string' ? data.access_token : ''
  const refreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : ''
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 0
  const userId = typeof data.user_id === 'number' ? data.user_id : 0

  if (!accessToken || !expiresIn || !userId) {
    throw new Error('ML_OAUTH_RESPONSE_INCOMPLETE')
  }
  if (!refreshToken) {
    throw new Error('ML_OAUTH_REFRESH_TOKEN_MISSING')
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: new Date(now + expiresIn * 1000),
    ml_user_id: userId,
  }
}
