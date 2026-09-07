import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MlProductItemsSnapshot } from './snapshot'

const { rpc, getProduct, getProductItems, getUserProduct, getUserProductItems } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getProduct: vi.fn(),
  getProductItems: vi.fn(),
  getUserProduct: vi.fn(),
  getUserProductItems: vi.fn(),
}))

// Os upserts de brand/product/variant não são o objeto do teste: devolvemos ids
// fixos e olhamos só para o que chega em reconciliar_catalogo.
vi.mock('./client', () => ({
  getProduct,
  getProductItems,
  getUserProduct,
  getUserProductItems,
}))
vi.mock('@/data/items.json', () => ({
  default: {
    items: [
      { catalog_id: 'MLB111', affiliate_urls: {} },
      {
        catalog_id: 'MLB222',
        affiliate_urls: {
          MLB1: {
            url: 'https://www.mercadolivre.com.br/social/revisao-mlb1?wid=MLB1&token=token-canary',
            seller_id: 9,
            reviewed_at: '2026-09-05',
            review_ref: 'review-ref-secret-canary',
          },
          MLB2: 'https://www.mercadolivre.com.br/p/MLB222?wid=MLB2',
          MLB3: { url: 'https://www.mercadolivre.com.br/social/incompleta' },
        },
      },
      { catalog_id: 'MLBU333', affiliate_urls: {} },
    ],
  },
}))
vi.mock('@/lib/db-admin', () => {
  const ids: Record<string, number> = {
    store: 101,
    brand: 202,
    product: 303,
    variant: 404,
  }
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const metodo of ['select', 'eq', 'is', 'upsert', 'insert', 'update']) {
      chain[metodo] = () => chain
    }
    chain.single = () => Promise.resolve({ data: { id: ids[table] }, error: null })
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    return chain
  }
  return { supabaseAdmin: { from, rpc } }
})

import { runCuratedIngest } from './ingest'
import { newOfferUrlCounters } from './offer-url'

const contadores = {
  simulado: false,
  recebidas: 2,
  criadas: 1,
  atualizadas: 1,
  reativadas: 0,
  indisponibilizadas: 3,
  observado_em: '2026-08-31',
}

const contadoresVazios = { ...contadores, recebidas: 0, criadas: 0, atualizadas: 0, indisponibilizadas: 5 }

function item(itemId: string, price: number, rank: number) {
  return {
    kind: 'valid' as const,
    mlRank: rank,
    item: { item_id: itemId, seller_id: 9, price, currency_id: 'BRL', condition: 'new' },
  }
}

function snapshotOk(...items: ReturnType<typeof item>[]): MlProductItemsSnapshot {
  return {
    status: 'success',
    items,
    totalReceived: items.length,
    pagesFetched: 1,
    rejectedByReason: {
      invalid_item_id: 0, invalid_seller_id: 0, invalid_price: 0,
      invalid_currency: 0, invalid_condition: 0,
    },
  } as MlProductItemsSnapshot
}

function snapshotVazio(): MlProductItemsSnapshot {
  return { ...snapshotOk(), status: 'success_empty', items: [], totalReceived: 0 } as MlProductItemsSnapshot
}

function chamadasRpc() {
  return rpc.mock.calls.map(([fn, args]) => ({ fn, args }))
}

describe('runCuratedIngest', () => {
  beforeEach(() => {
    rpc.mockReset()
    getProduct.mockReset()
    getProductItems.mockReset()
    getUserProduct.mockReset()
    getUserProductItems.mockReset()
    rpc.mockResolvedValue({ data: contadores, error: null })
    getProduct.mockResolvedValue({
      name: 'Whey Isolado 900g',
      attributes: [{ id: 'BRAND', value_name: 'Growth' }],
      pictures: [{ url: 'https://img/1.jpg' }],
    })
    getProductItems.mockImplementation(async catalogId => snapshotOk(
      item('MLB1', 50, 0),
      item('MLB2', 60, 1),
      ...(catalogId === 'MLB222' ? [item('MLB3', 70, 2)] : []),
    ))
    getUserProduct.mockResolvedValue({
      id: 'MLBU333',
      name: 'Daily Whey 800g',
      user_id: 437089518,
      domain_id: 'MLB-SUPPLEMENTS',
      attributes: [{ id: 'BRAND', value_name: 'Growth' }],
      pictures: [{ url: 'https://img/up.jpg' }],
    })
    getUserProductItems.mockResolvedValue(snapshotOk(item('MLB3', 70, 0), item('MLB4', 80, 1)))
  })

  it('envia o snapshot inteiro numa única chamada por catálogo', async () => {
    await runCuratedIngest()

    const calls = chamadasRpc()
    expect(calls).toHaveLength(3)
    expect(calls[0].fn).toBe('reconciliar_catalogo')
    expect(calls[0].args.p_catalog_id).toBe('MLB111')
    expect(calls[0].args.p_items.map((o: { external_id: string }) => o.external_id))
      .toEqual(['MLB1', 'MLB2'])
    expect(calls[0].args.p_items[0]).toMatchObject({ price: 50, ml_rank: 0 })
  })

  it('reconcilia com lista vazia quando o catálogo não tem mais ofertas', async () => {
    getProductItems.mockResolvedValue(snapshotVazio())
    getUserProductItems.mockResolvedValue(snapshotVazio())
    rpc.mockResolvedValue({ data: contadoresVazios, error: null })

    const resultado = await runCuratedIngest()

    expect(chamadasRpc()[0].args.p_items).toEqual([])
    expect(chamadasRpc()[0].args.p_variant_id).toBeNull()
    expect(resultado.per_catalog[0].status).toBe('success_empty')
    expect(resultado.offers_indisponibilizadas).toBe(15)
  })

  it.each([
    ['upstream_error', 'request_failed'],
    ['snapshot_invalid', 'incomplete_page'],
  ] as const)('não escreve nada quando o snapshot é %s', async (status, reason) => {
    getProductItems.mockResolvedValue({
      status, reason, totalReceived: 0, pagesFetched: 1,
      rejectedByReason: {
        invalid_item_id: 0, invalid_seller_id: 0, invalid_price: 0,
        invalid_currency: 0, invalid_condition: 0,
      },
    } as MlProductItemsSnapshot)
    getUserProductItems.mockResolvedValue({
      status, reason, totalReceived: 0, pagesFetched: 1,
      rejectedByReason: {
        invalid_item_id: 0, invalid_seller_id: 0, invalid_price: 0,
        invalid_currency: 0, invalid_condition: 0,
      },
    } as MlProductItemsSnapshot)

    const resultado = await runCuratedIngest()

    expect(rpc).not.toHaveBeenCalled()
    expect(resultado.per_catalog.every(c => c.status === status)).toBe(true)
    expect(resultado.catalogs_ingested).toBe(0)
  })

  it('descarta os itens rejeitados antes de reconciliar', async () => {
    getProductItems.mockResolvedValue(snapshotOk(
      item('MLB1', 50, 0),
      { kind: 'invalid', itemId: 'MLB2', mlRank: 1, reason: 'invalid_price' } as never,
      item('MLB3', 70, 2),
    ))

    await runCuratedIngest()

    expect(chamadasRpc()[0].args.p_items.map((o: { external_id: string }) => o.external_id))
      .toEqual(['MLB1', 'MLB3'])
  })

  it('dá a cada oferta o link do seu próprio anúncio', async () => {
    await runCuratedIngest()

    const urls = chamadasRpc()[0].args.p_items.map((o: { url: string }) => o.url)
    expect(new Set(urls).size).toBe(2)
    expect(new URL(urls[0]).searchParams.get('wid')).toBe('MLB1')
    expect(new URL(urls[1]).searchParams.get('wid')).toBe('MLB2')
  })

  it('repetir o mesmo snapshot produz exatamente o mesmo payload', async () => {
    await runCuratedIngest()
    const primeira = JSON.stringify(chamadasRpc()[0].args.p_items)
    rpc.mockClear()

    await runCuratedIngest()

    expect(JSON.stringify(chamadasRpc()[0].args.p_items)).toBe(primeira)
  })

  it('agrega os contadores devolvidos pela reconciliação', async () => {
    const resultado = await runCuratedIngest()

    expect(resultado).toMatchObject({
      catalogs_ingested: 3,
      offers_criadas: 3,
      offers_atualizadas: 3,
      offers_reativadas: 0,
      offers_indisponibilizadas: 9,
      offers_ingested: 6,
    })
    expect(resultado.per_catalog[0].reconciliacao).toEqual(contadores)
  })

  it('propaga a simulação para todos os catálogos e marca o resultado', async () => {
    rpc.mockResolvedValue({ data: { ...contadores, simulado: true }, error: null })

    const resultado = await runCuratedIngest({ simular: true })

    expect(resultado.simulado).toBe(true)
    expect(chamadasRpc().every(c => c.args.p_simular === true)).toBe(true)
    expect(resultado.per_catalog[0].reconciliacao?.simulado).toBe(true)
  })

  it('não simula quando ninguém pediu', async () => {
    const resultado = await runCuratedIngest()

    expect(resultado.simulado).toBe(false)
    expect(chamadasRpc().every(c => c.args.p_simular === false)).toBe(true)
  })

  it('simula com o mesmo payload que enviaria de verdade', async () => {
    await runCuratedIngest()
    const real = JSON.stringify(chamadasRpc()[0].args.p_items)
    rpc.mockClear()

    await runCuratedIngest({ simular: true })

    expect(JSON.stringify(chamadasRpc()[0].args.p_items)).toBe(real)
  })

  it('TestRunCuratedIngest_ShouldContinueOtherCatalogsWhenOneCatalogPersistenceFails', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'deadlock detected' } })
      .mockResolvedValueOnce({ data: contadores, error: null })

    const resultado = await runCuratedIngest()

    expect(resultado.per_catalog[0]).toMatchObject({
      status: 'product_error',
      reason: 'persistence_failed',
    })
    expect(resultado.per_catalog[1].status).toBe('success')
    expect(resultado.catalogs_ingested).toBe(2)
    expect(resultado.offers_indisponibilizadas).toBe(6)
  })

  it('TestRunCuratedIngest_ShouldCloseReviewedAndFallbackCountersPerCatalog', async () => {
    vi.stubEnv('ML_AFFILIATE_TAG', 'tag-configurada-sem-efeito')

    const resultado = await runCuratedIngest()

    expect(resultado.urls).toStrictEqual({
      affiliate_reviewed: 1, fallback: 6, reviewed_import: 1,
      fallback_absent: 4, fallback_unverified: 1, fallback_url_invalida: 0,
      fallback_protocolo: 0, fallback_dominio: 0, fallback_wid: 0,
      fallback_reviewed_metadata: 1, fallback_seller: 0, fallback_duplicate: 0,
    })
    expect(resultado.per_catalog.map(catalog => catalog.urls)).toStrictEqual([
      {
        affiliate_reviewed: 0, fallback: 2, reviewed_import: 0,
        fallback_absent: 2, fallback_unverified: 0, fallback_url_invalida: 0,
        fallback_protocolo: 0, fallback_dominio: 0, fallback_wid: 0,
        fallback_reviewed_metadata: 0, fallback_seller: 0, fallback_duplicate: 0,
      },
      {
        affiliate_reviewed: 1, fallback: 2, reviewed_import: 1,
        fallback_absent: 0, fallback_unverified: 1, fallback_url_invalida: 0,
        fallback_protocolo: 0, fallback_dominio: 0, fallback_wid: 0,
        fallback_reviewed_metadata: 1, fallback_seller: 0, fallback_duplicate: 0,
      },
      {
        affiliate_reviewed: 0, fallback: 2, reviewed_import: 0,
        fallback_absent: 2, fallback_unverified: 0, fallback_url_invalida: 0,
        fallback_protocolo: 0, fallback_dominio: 0, fallback_wid: 0,
        fallback_reviewed_metadata: 0, fallback_seller: 0, fallback_duplicate: 0,
      },
    ])
    expect(resultado.urls.affiliate_reviewed + resultado.urls.fallback).toBe(7)
    expect(JSON.stringify(resultado.urls)).not.toContain('tracked')
    expect(JSON.stringify(resultado.urls)).not.toContain('sem_tag_de_afiliado')
    const urls = chamadasRpc().flatMap(call => call.args.p_items.map((offer: { url: string }) => offer.url))
    expect(urls).toHaveLength(7)
    expect(chamadasRpc()[1].args.p_items[0]).toMatchObject({
      external_id: 'MLB1',
      url: 'https://www.mercadolivre.com.br/social/revisao-mlb1?wid=MLB1&token=token-canary',
      raw: {
        affiliate_link: {
          destination: 'affiliate_link',
          origin: 'reviewed_import',
          validation: 'reviewed',
          reason: 'reviewed_import',
          seller_id: 9,
          reviewed_at: '2026-09-05',
          review_ref: 'review-ref-secret-canary',
        },
      },
    })
    expect(JSON.stringify(chamadasRpc()[1].args.p_items[0].raw.affiliate_link)).not.toContain('https://')
    expect(chamadasRpc()[0].args.p_items[0].raw.affiliate_link).toStrictEqual({
      origin: 'none',
      validation: 'absent',
      destination: 'untracked_fallback',
      reason: 'fallback_absent',
    })
    expect(chamadasRpc()[1].args.p_items[1].raw.affiliate_link).toStrictEqual({
      origin: 'legacy_manual',
      validation: 'unverified',
      destination: 'untracked_fallback',
      reason: 'fallback_unverified',
    })
    expect(chamadasRpc()[1].args.p_items[2].raw.affiliate_link).toStrictEqual({
      origin: 'reviewed_import',
      validation: 'rejected',
      destination: 'untracked_fallback',
      reason: 'fallback_reviewed_metadata',
    })

    getProductItems
      .mockResolvedValueOnce(snapshotVazio())
      .mockResolvedValueOnce({
        status: 'upstream_error', reason: 'request_failed', totalReceived: 0, pagesFetched: 1,
        rejectedByReason: {
          invalid_item_id: 0, invalid_seller_id: 0, invalid_price: 0,
          invalid_currency: 0, invalid_condition: 0,
        },
      } as MlProductItemsSnapshot)
    getUserProductItems.mockResolvedValueOnce(snapshotVazio())

    const semOfertasOuFalho = await runCuratedIngest()

    expect(semOfertasOuFalho.urls).toStrictEqual(newOfferUrlCounters())
    expect(semOfertasOuFalho.per_catalog.map(catalog => catalog.status)).toStrictEqual([
      'success_empty', 'upstream_error', 'success_empty',
    ])
  })

  it('does not warn about fallback when no offer was resolved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    getProductItems.mockResolvedValue(snapshotVazio())
    getUserProductItems.mockResolvedValue(snapshotVazio())
    rpc.mockResolvedValue({ data: contadoresVazios, error: null })

    const result = await runCuratedIngest()

    expect(result.urls.fallback).toBe(0)
    expect(warn).not.toHaveBeenCalledWith('ml_url_fallback_ativo', expect.anything())
    warn.mockRestore()
  })

  it('TestRunCuratedIngest_ShouldSanitizeReviewedLinkLogsAndPublicResult', async () => {
    vi.stubEnv('ML_AFFILIATE_TAG', 'tag-canary')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    getProduct.mockRejectedValueOnce(new Error('erro-externo-canary'))

    const resultado = await runCuratedIngest()
    const logs = JSON.stringify([...info.mock.calls, ...warn.mock.calls, ...error.mock.calls])
    const result = JSON.stringify(resultado)

    expect(logs).not.toContain('https://www.mercadolivre.com.br/social/revisao-mlb1?wid=MLB1&token=token-canary')
    expect(logs).not.toContain('review-ref-secret-canary')
    expect(result).not.toContain('https://www.mercadolivre.com.br/social/revisao-mlb1?wid=MLB1&token=token-canary')
    expect(result).not.toContain('review-ref-secret-canary')
    expect(resultado.per_catalog[0]).toStrictEqual({
      catalog_id: 'MLB111', status: 'product_error', reason: 'product_request_failed',
      total_received: undefined, pages_fetched: undefined, rejected_by_reason: undefined,
    })
    expect(resultado.per_catalog[1]).toMatchObject({ catalog_id: 'MLB222', status: 'success' })
    expect(chamadasRpc()[0].args.p_items[0]).toMatchObject({
      url: 'https://www.mercadolivre.com.br/social/revisao-mlb1?wid=MLB1&token=token-canary',
      raw: { affiliate_link: { review_ref: 'review-ref-secret-canary' } },
    })
    for (const canary of ['token-canary', 'tag-canary', 'secret-canary', 'erro-externo-canary', 'affiliate_link']) {
      expect(logs).not.toContain(canary)
      expect(result).not.toContain(canary)
    }

    info.mockRestore()
    warn.mockRestore()
    error.mockRestore()
  })

  it('TestRunCuratedIngest_ShouldSanitizeFallbackLogsAndKeepCommercialFieldsIndependent', async () => {
    vi.stubEnv('ML_AFFILIATE_TAG', 'tag-secreta')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const resultado = await runCuratedIngest()
    const logText = JSON.stringify(info.mock.calls)
    const resultText = JSON.stringify(resultado)
    const firstOffer = chamadasRpc()[0].args.p_items[0]
    const fallbackLogs = info.mock.calls.filter(([event]) => event === 'ml_url_fallback')

    expect(logText).not.toContain('https://www.mercadolivre.com.br/p/MLB222?wid=MLB1&campaign=legado')
    expect(logText).not.toContain('tag-secreta')
    expect(resultText).not.toContain('https://www.mercadolivre.com.br/p/MLB222?wid=MLB1&campaign=legado')
    expect(firstOffer).toMatchObject({
      external_id: 'MLB1',
      price: 50,
      ml_rank: 0,
      raw: { seller_id: 9 },
    })
    expect(firstOffer.url).toBe('https://www.mercadolivre.com.br/p/MLB111?wid=MLB1')
    expect(chamadasRpc()[0].args).toMatchObject({
      p_store_id: 101,
      p_variant_id: 404,
      p_catalog_id: 'MLB111',
    })
    expect(fallbackLogs).toEqual([
      ['ml_url_fallback', {
        catalogId: 'MLB111', affiliate_reviewed: 0, fallback: 2, reviewed_import: 0, fallback_absent: 2, fallback_unverified: 0,
        fallback_url_invalida: 0, fallback_protocolo: 0, fallback_dominio: 0, fallback_wid: 0,
        fallback_reviewed_metadata: 0, fallback_seller: 0, fallback_duplicate: 0,
      }],
      ['ml_url_fallback', {
        catalogId: 'MLB222', affiliate_reviewed: 1, fallback: 2, reviewed_import: 1, fallback_absent: 0, fallback_unverified: 1,
        fallback_url_invalida: 0, fallback_protocolo: 0, fallback_dominio: 0, fallback_wid: 0,
        fallback_reviewed_metadata: 1, fallback_seller: 0, fallback_duplicate: 0,
      }],
      ['ml_url_fallback', {
        catalogId: 'MLBU333', affiliate_reviewed: 0, fallback: 2, reviewed_import: 0, fallback_absent: 2, fallback_unverified: 0,
        fallback_url_invalida: 0, fallback_protocolo: 0, fallback_dominio: 0, fallback_wid: 0,
        fallback_reviewed_metadata: 0, fallback_seller: 0, fallback_duplicate: 0,
      }],
    ])
    expect(warn.mock.calls).toEqual([
      ['ml_url_fallback_ativo', { destino: 'untracked_fallback', fallback: 6 }],
    ])

    info.mockRestore()
    warn.mockRestore()
  })

  it('propaga falhas de conexão em vez de escondê-las por catálogo', async () => {
    getProduct.mockRejectedValue(new Error('ML_TOKEN_KEY_VERSION_UNAVAILABLE'))

    await expect(runCuratedIngest())
      .rejects.toThrowError('ML_TOKEN_KEY_VERSION_UNAVAILABLE')
    expect(getProduct).toHaveBeenCalledOnce()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('usa o fluxo próprio para user product', async () => {
    await runCuratedIngest()

    expect(getUserProduct).toHaveBeenCalledWith('MLBU333')
    expect(getUserProductItems).toHaveBeenCalledWith('MLBU333', 437089518)
    expect(getProduct).not.toHaveBeenCalledWith('MLBU333')
    expect(chamadasRpc()[2].args).toMatchObject({
      p_catalog_id: 'MLBU333',
    })
    expect(chamadasRpc()[2].args.p_items.map((offer: { external_id: string }) => offer.external_id))
      .toEqual(['MLB3', 'MLB4'])
  })
})
