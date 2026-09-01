import { decodeTokenEncryptionKey } from './token-crypto'

export type MlTokenSecurityConfig = {
  allowedUserId: number
  key: Buffer
  keyVersion: number
}

export function loadMlTokenSecurityConfig(
  env: NodeJS.ProcessEnv = process.env,
): MlTokenSecurityConfig {
  try {
    const allowedUserId = Number(env.ML_ALLOWED_USER_ID)
    const keyVersion = Number(env.ML_TOKEN_ENCRYPTION_KEY_VERSION)
    if (
      !Number.isSafeInteger(allowedUserId)
      || allowedUserId <= 0
      || !Number.isSafeInteger(keyVersion)
      || keyVersion <= 0
      || !env.ML_TOKEN_ENCRYPTION_KEY
    ) {
      throw new Error('INVALID_SECURITY_CONFIGURATION')
    }
    return {
      allowedUserId,
      key: decodeTokenEncryptionKey(env.ML_TOKEN_ENCRYPTION_KEY),
      keyVersion,
    }
  } catch {
    throw new Error('ML_OAUTH_SECURITY_CONFIGURATION_INVALID')
  }
}
