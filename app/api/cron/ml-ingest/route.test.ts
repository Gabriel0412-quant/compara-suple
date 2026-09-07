import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { runCuratedIngest, runOperationalCuratedIngest } = vi.hoisted(() => ({
  runCuratedIngest: vi.fn(),
  runOperationalCuratedIngest: vi.fn(),
}))

vi.mock('@/lib/ml/ingest', () => ({ runCuratedIngest, runOperationalCuratedIngest }))

import { GET, POST } from './route'

const requiredEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  ML_APP_ID: 'app-id',
  ML_CLIENT_SECRET: 'client-secret',
  ML_ALLOWED_USER_ID: '437089518',
  ML_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  ML_TOKEN_ENCRYPTION_KEY_VERSION: '1',
  CRON_SECRET: 'cron-secret',
}

function request(
  method: 'GET' | 'POST',
  authorization?: string,
  query = '',
): NextRequest {
  return new NextRequest(`https://example.com/api/cron/ml-ingest${query}`, {
    method,
    headers: authorization ? { authorization } : undefined,
  })
}

describe('/api/cron/ml-ingest', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(requiredEnv)) {
      vi.stubEnv(name, value)
    }
    runCuratedIngest.mockReset()
    runOperationalCuratedIngest.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('returns 401 for an unauthorized %s', async (method, handler) => {
    const response = await handler(request(method))

    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'unauthorized' })
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('returns 503 before ingesting when required configuration is missing', async () => {
    vi.stubEnv('ML_CLIENT_SECRET', '')

    const response = await GET(request('GET', 'Bearer cron-secret'))

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'configuration_error',
    })
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('returns 503 when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(request('GET'))

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'configuration_error',
    })
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('runs a configured and authorized ingest', async () => {
    runOperationalCuratedIngest.mockResolvedValue({
      runId: '0199243f-5418-7e26-8d7e-6068e98a5970', state: 'running',
      disposition: 'acquired', processed: 12, succeeded: 12, failed: 0,
      hasContinuation: true, durationMs: 12,
    })

    const response = await GET(request('GET', 'Bearer cron-secret'))

    expect(response.status).toBe(202)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        runId: '0199243f-5418-7e26-8d7e-6068e98a5970', state: 'running',
        disposition: 'acquired', processed: 12, succeeded: 12, failed: 0,
        hasContinuation: true, durationMs: 12,
      },
    })
  })

  it('TestCronMlIngest_ShouldExposeFallbackCountersWithoutLegacyAffiliateFields', async () => {
    const result = {
      simulado: false,
      catalogIds: 1,
      catalogs_ingested: 1,
      offers_ingested: 1,
      urls: {
        fallback: 1,
        fallback_absent: 1,
        fallback_unverified: 0,
        fallback_url_invalida: 0,
        fallback_protocolo: 0,
        fallback_dominio: 0,
        fallback_wid: 0,
      },
      per_catalog: [{
        catalog_id: 'MLB54',
        status: 'success',
        urls: {
          fallback: 1,
          fallback_absent: 1,
          fallback_unverified: 0,
          fallback_url_invalida: 0,
          fallback_protocolo: 0,
          fallback_dominio: 0,
          fallback_wid: 0,
        },
      }],
    }
    runCuratedIngest.mockResolvedValue(result)

    for (const [method, handler] of [['GET', GET], ['POST', POST]] as const) {
      const response = await handler(request(method, 'Bearer cron-secret', '?simular=1'))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(body).toEqual({ ok: true, result })
      expect(JSON.stringify(body)).not.toContain('tracked')
      expect(JSON.stringify(body)).not.toContain('sem_tag_de_afiliado')
    }
  })

  it('TestCronMlIngest_ShouldExposeReviewedCountersWithoutSensitiveCuratedData', async () => {
    const result = {
      catalogIds: 1,
      catalogs_ingested: 1,
      offers_ingested: 2,
      urls: {
        affiliate_reviewed: 1,
        fallback: 1,
        reviewed_import: 1,
        fallback_absent: 1,
        fallback_unverified: 0,
        fallback_url_invalida: 0,
        fallback_protocolo: 0,
        fallback_dominio: 0,
        fallback_wid: 0,
        fallback_reviewed_metadata: 0,
        fallback_seller: 0,
        fallback_duplicate: 0,
      },
      per_catalog: [],
    }
    runCuratedIngest.mockResolvedValue(result)

    for (const [method, handler] of [['GET', GET], ['POST', POST]] as const) {
      const response = await handler(request(method, 'Bearer cron-secret', '?simular=1'))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(body).toEqual({ ok: true, result })
      expect(JSON.stringify(body)).not.toContain('https://')
      expect(JSON.stringify(body)).not.toContain('review-ref-secreta')
    }
  })

  it.each(['?simular=1', '?simular=true'] as const)('uses the simulation path for %s', async query => {
    runCuratedIngest.mockResolvedValue({
      simulado: true,
      catalogIds: 0,
      catalogs_ingested: 0,
      per_catalog: [],
    })

    await GET(request('GET', 'Bearer cron-secret', query))

    expect(runCuratedIngest).toHaveBeenCalledWith({ simular: true })
    expect(runOperationalCuratedIngest).not.toHaveBeenCalled()
  })

  it.each(['', '?simular=0', '?simular=talvez'] as const)('uses the durable path for %s', async query => {
    runOperationalCuratedIngest.mockResolvedValue({
      runId: '0199243f-5418-7e26-8d7e-6068e98a5970', state: 'succeeded',
      disposition: 'acquired', processed: 1, succeeded: 1, failed: 0,
      hasContinuation: false, durationMs: 12,
    })

    await GET(request('GET', 'Bearer cron-secret', query))

    expect(runOperationalCuratedIngest).toHaveBeenCalledOnce()
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('does not let an unauthorized caller simulate', async () => {
    const response = await GET(request('GET', undefined, '?simular=1'))

    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('returns a stable error code when authorization must be recovered', async () => {
    runOperationalCuratedIngest.mockRejectedValue(
      new Error('access_token ML expirou e não há refresh_token salvo.'),
    )

    const response = await POST(request('POST', 'Bearer cron-secret'))

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'auth_required',
    })
  })

  it('returns 500 when every curated catalog fails', async () => {
    runOperationalCuratedIngest.mockResolvedValue({
      runId: '0199243f-5418-7e26-8d7e-6068e98a5970', state: 'failed',
      disposition: 'terminal', processed: 0, succeeded: 0, failed: 16,
      hasContinuation: false, durationMs: 12,
    })

    const response = await POST(request('POST', 'Bearer cron-secret'))

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'ingestion_failed',
    })
  })

  it('keeps a partial ingest successful and emits an operational warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    runOperationalCuratedIngest.mockResolvedValue({
      runId: '0199243f-5418-7e26-8d7e-6068e98a5970', state: 'partial_failed',
      disposition: 'acquired', processed: 2, succeeded: 1, failed: 1,
      hasContinuation: false, durationMs: 12,
    })

    const response = await POST(request('POST', 'Bearer cron-secret'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(warn).toHaveBeenCalledWith('ml_ingest_partial_failure', {
      run_id: '0199243f-5418-7e26-8d7e-6068e98a5970',
      failed_items: 1,
    })
    warn.mockRestore()
  })
})
