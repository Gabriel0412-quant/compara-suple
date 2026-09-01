import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MlProductItemsSnapshot } from './snapshot'

const { rpc, getProduct, getProductItems } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getProduct: vi.fn(),
  getProductItems: vi.fn(),
}))

// Os upserts de brand/product/variant não são o objeto do teste: devolvemos ids
// fixos e olhamos só para o que chega em reconciliar_catalogo.
vi.mock('./client', () => ({ getProduct, getProductItems }))
vi.mock('@/data/items.json', () => ({
  default: { items: ['MLB111', 'MLB222'] },
}))
vi.mock('@/lib/db-admin', () => {
  const single = () => Promise.resolve({ data: { id: 1 }, error: null })
  const chain: Record<string, unknown> = {}
  for (const metodo of ['select', 'eq', 'is', 'upsert', 'insert', 'update']) {
    chain[metodo] = () => chain
  }
  chain.single = single
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
  return { supabaseAdmin: { from: () => chain, rpc } }
})

import { runCuratedIngest } from './ingest'

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
    rpc.mockResolvedValue({ data: contadores, error: null })
    getProduct.mockResolvedValue({
      name: 'Whey Isolado 900g',
      attributes: [{ id: 'BRAND', value_name: 'Growth' }],
      pictures: [{ url: 'https://img/1.jpg' }],
    })
    getProductItems.mockResolvedValue(snapshotOk(item('MLB1', 50, 0), item('MLB2', 60, 1)))
  })

  it('envia o snapshot inteiro numa única chamada por catálogo', async () => {
    await runCuratedIngest()

    const calls = chamadasRpc()
    expect(calls).toHaveLength(2)
    expect(calls[0].fn).toBe('reconciliar_catalogo')
    expect(calls[0].args.p_catalog_id).toBe('MLB111')
    expect(calls[0].args.p_items.map((o: { external_id: string }) => o.external_id))
      .toEqual(['MLB1', 'MLB2'])
    expect(calls[0].args.p_items[0]).toMatchObject({ price: 50, ml_rank: 0 })
  })

  it('reconcilia com lista vazia quando o catálogo não tem mais ofertas', async () => {
    getProductItems.mockResolvedValue(snapshotVazio())
    rpc.mockResolvedValue({ data: contadoresVazios, error: null })

    const resultado = await runCuratedIngest()

    expect(chamadasRpc()[0].args.p_items).toEqual([])
    expect(chamadasRpc()[0].args.p_variant_id).toBeNull()
    expect(resultado.per_catalog[0].status).toBe('success_empty')
    expect(resultado.offers_indisponibilizadas).toBe(10)
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

  it('conta o motivo de cada link e o total sem tag de afiliado', async () => {
    const resultado = await runCuratedIngest()

    expect(resultado.urls).toMatchObject({
      manual: 0,
      fallback_sem_manual: 4,
      fallback_wid: 0,
      sem_tag_de_afiliado: 4,
    })
    expect(resultado.per_catalog[0].urls?.fallback_sem_manual).toBe(2)
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
      catalogs_ingested: 2,
      offers_criadas: 2,
      offers_atualizadas: 2,
      offers_reativadas: 0,
      offers_indisponibilizadas: 6,
      offers_ingested: 4,
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

  it('isola a falha de um catálogo sem derrubar os outros', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'deadlock detected' } })
      .mockResolvedValueOnce({ data: contadores, error: null })

    const resultado = await runCuratedIngest()

    expect(resultado.per_catalog[0]).toMatchObject({
      status: 'product_error',
      reason: 'persistence_failed',
    })
    expect(resultado.per_catalog[1].status).toBe('success')
    expect(resultado.catalogs_ingested).toBe(1)
    expect(resultado.offers_indisponibilizadas).toBe(3)
  })

  it('propaga falhas de conexão em vez de escondê-las por catálogo', async () => {
    getProduct.mockRejectedValue(new Error('ML_TOKEN_KEY_VERSION_UNAVAILABLE'))

    await expect(runCuratedIngest())
      .rejects.toThrowError('ML_TOKEN_KEY_VERSION_UNAVAILABLE')
    expect(getProduct).toHaveBeenCalledOnce()
    expect(rpc).not.toHaveBeenCalled()
  })
})
