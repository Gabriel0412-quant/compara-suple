import { describe, expect, it } from 'vitest'

import { classifyMlIngestError, getMissingMlIngestConfig } from './runtime'

const completeEnv: NodeJS.ProcessEnv = {
  // NodeJS.ProcessEnv exige NODE_ENV. Sem ele o objeto não satisfaz o tipo e
  // `tsc --noEmit` falha — o build e o vitest não pegam porque nenhum dos dois
  // faz checagem de tipos deste arquivo.
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  ML_APP_ID: 'app-id',
  ML_CLIENT_SECRET: 'client-secret',
  CRON_SECRET: 'cron-secret',
}

describe('getMissingMlIngestConfig', () => {
  it('returns no missing variables for a complete runtime', () => {
    expect(getMissingMlIngestConfig(completeEnv)).toEqual([])
  })

  it('returns variable names without their values', () => {
    expect(getMissingMlIngestConfig({
      ...completeEnv,
      ML_APP_ID: '',
      ML_CLIENT_SECRET: undefined,
    })).toEqual(['ML_APP_ID', 'ML_CLIENT_SECRET'])
  })
})

describe('classifyMlIngestError', () => {
  it('classifies an expired access token without refresh token', () => {
    expect(classifyMlIngestError(
      new Error('access_token ML expirou e não há refresh_token salvo.'),
    )).toBe('auth_required')
  })

  it.each([
    'ML_OAUTH_REFRESH_TOKEN_MISSING',
    'ML_OAUTH_REQUEST_FAILED_401',
  ])('classifies %s as an authorization error', message => {
    expect(classifyMlIngestError(new Error(message))).toBe('auth_required')
  })

  it('does not report a provider outage as an authorization error', () => {
    expect(classifyMlIngestError(new Error('ML_OAUTH_REQUEST_FAILED_500')))
      .toBe('ingestion_failed')
  })

  it('uses a generic code for an unknown upstream failure', () => {
    expect(classifyMlIngestError(new Error('sensitive upstream payload')))
      .toBe('ingestion_failed')
  })
})
