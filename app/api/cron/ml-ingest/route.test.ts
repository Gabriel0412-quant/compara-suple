import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { runCuratedIngest } = vi.hoisted(() => ({
  runCuratedIngest: vi.fn(),
}))

vi.mock('@/lib/ml/ingest', () => ({ runCuratedIngest }))

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
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'unauthorized' })
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('returns 503 before ingesting when required configuration is missing', async () => {
    vi.stubEnv('ML_CLIENT_SECRET', '')

    const response = await GET(request('GET', 'Bearer cron-secret'))

    expect(response.status).toBe(503)
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
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'configuration_error',
    })
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('runs a configured and authorized ingest', async () => {
    runCuratedIngest.mockResolvedValue({
      catalogIds: 16,
      catalogs_ingested: 16,
      offers_ingested: 451,
      per_catalog: [],
    })

    const response = await GET(request('GET', 'Bearer cron-secret'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        catalogIds: 16,
        catalogs_ingested: 16,
        offers_ingested: 451,
        per_catalog: [],
      },
    })
  })

  it.each([
    ['?simular=1', true],
    ['?simular=true', true],
    ['', false],
    ['?simular=0', false],
    ['?simular=talvez', false],
  ] as const)('reads %s as simular=%s', async (query, esperado) => {
    runCuratedIngest.mockResolvedValue({
      simulado: esperado,
      catalogIds: 0,
      catalogs_ingested: 0,
      per_catalog: [],
    })

    await GET(request('GET', 'Bearer cron-secret', query))

    expect(runCuratedIngest).toHaveBeenCalledWith({ simular: esperado })
  })

  it('does not let an unauthorized caller simulate', async () => {
    const response = await GET(request('GET', undefined, '?simular=1'))

    expect(response.status).toBe(401)
    expect(runCuratedIngest).not.toHaveBeenCalled()
  })

  it('returns a stable error code when authorization must be recovered', async () => {
    runCuratedIngest.mockRejectedValue(
      new Error('access_token ML expirou e não há refresh_token salvo.'),
    )

    const response = await POST(request('POST', 'Bearer cron-secret'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'auth_required',
    })
  })

  it('returns 500 when every curated catalog fails', async () => {
    runCuratedIngest.mockResolvedValue({
      catalogIds: 16,
      catalogs_ingested: 0,
      per_catalog: Array.from({ length: 16 }, () => ({
        status: 'product_error',
      })),
    })

    const response = await POST(request('POST', 'Bearer cron-secret'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'ingestion_failed',
    })
  })

  it('keeps a partial ingest successful and emits an operational warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    runCuratedIngest.mockResolvedValue({
      catalogIds: 2,
      catalogs_ingested: 1,
      per_catalog: [
        { status: 'success' },
        { status: 'product_error' },
      ],
    })

    const response = await POST(request('POST', 'Bearer cron-secret'))

    expect(response.status).toBe(200)
    expect(warn).toHaveBeenCalledWith('ml_ingest_partial_failure', {
      failed_catalogs: 1,
      catalog_ids: 2,
    })
    warn.mockRestore()
  })
})
