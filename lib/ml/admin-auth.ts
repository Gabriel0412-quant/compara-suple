import { timingSafeEqual } from 'node:crypto'

export type MlAdminAuthorizationResult =
  | 'authorized'
  | 'unauthorized'
  | 'configuration_error'

export function checkMlAdminAuthorization(
  authorization: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): MlAdminAuthorizationResult {
  const secret = env.ML_ADMIN_SECRET
  if (!secret || secret.length < 32) {
    return 'configuration_error'
  }
  if (!authorization?.startsWith('Bearer ')) {
    return 'unauthorized'
  }

  const candidate = Buffer.from(authorization.slice('Bearer '.length), 'utf8')
  const expected = Buffer.from(secret, 'utf8')
  if (candidate.length !== expected.length) {
    return 'unauthorized'
  }
  return timingSafeEqual(candidate, expected) ? 'authorized' : 'unauthorized'
}
