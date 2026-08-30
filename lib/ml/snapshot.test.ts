import { describe, expect, it } from 'vitest'

import {
  collectMlProductItemsSnapshot,
  ML_PRODUCT_ITEMS_MAX_TOTAL,
  ML_PRODUCT_ITEMS_PAGE_LIMIT,
} from './snapshot'
import type { MlProductItem, MlProductItemsResponse } from './types'

function offer(index: number, overrides: Partial<MlProductItem> = {}): MlProductItem {
  return {
    item_id: `MLB${String(index).padStart(7, '0')}`,
    site_id: 'MLB',
    seller_id: index + 1,
    price: 100 + index,
    original_price: null,
    currency_id: 'BRL',
    category_id: 'MLB1234',
    condition: 'new',
    listing_type_id: 'gold_special',
    official_store_id: null,
    ...overrides,
  }
}

function page(
  total: number,
  offset: number,
  results: MlProductItem[],
  limit = ML_PRODUCT_ITEMS_PAGE_LIMIT,
): MlProductItemsResponse {
  return { paging: { total, offset, limit }, results }
}

describe('collectMlProductItemsSnapshot', () => {
  it('percorre todas as páginas e preserva a ordem global dos ranks', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => offer(index))
    const secondPage = Array.from({ length: 50 }, (_, index) => offer(index + 100))
    const requested: Array<{ offset: number; limit: number }> = []

    const snapshot = await collectMlProductItemsSnapshot('MLB123456', async (_catalogId, options) => {
      requested.push(options)
      return options.offset === 0
        ? page(150, 0, firstPage)
        : page(150, 100, secondPage)
    })

    expect(snapshot.status).toBe('success')
    if (snapshot.status !== 'success') throw new Error('snapshot deveria ser válido')
    expect(requested).toEqual([
      { offset: 0, limit: 100 },
      { offset: 100, limit: 100 },
    ])
    expect(snapshot.totalReceived).toBe(150)
    expect(snapshot.pagesFetched).toBe(2)
    expect(snapshot.items).toHaveLength(150)
    expect(snapshot.items.map(item => item.mlRank)).toEqual(Array.from({ length: 150 }, (_, index) => index))
  })

  it('classifica total zero como snapshot vazio válido', async () => {
    const snapshot = await collectMlProductItemsSnapshot(
      'MLB123456',
      async () => page(0, 0, []),
    )

    expect(snapshot.status).toBe('success_empty')
    if (snapshot.status !== 'success_empty') throw new Error('snapshot deveria estar vazio')
    expect(snapshot.totalReceived).toBe(0)
    expect(snapshot.pagesFetched).toBe(1)
    expect(snapshot.items).toEqual([])
  })

  it('rejeita snapshots acima do limite de volume antes de aceitar itens', async () => {
    const snapshot = await collectMlProductItemsSnapshot(
      'MLB123456',
      async () => page(ML_PRODUCT_ITEMS_MAX_TOTAL + 1, 0, []),
    )

    expect(snapshot.status).toBe('snapshot_invalid')
    if (snapshot.status !== 'snapshot_invalid') throw new Error('snapshot deveria ser inválido')
    expect(snapshot.reason).toBe('snapshot_too_large')
    expect(snapshot.totalReceived).toBe(0)
  })

  it('descarta o snapshot inteiro quando uma página intermediária falha', async () => {
    const snapshot = await collectMlProductItemsSnapshot('MLB123456', async (_catalogId, options) => {
      if (options.offset === 100) throw new Error('upstream failure')
      return page(150, 0, Array.from({ length: 100 }, (_, index) => offer(index)))
    })

    expect(snapshot.status).toBe('upstream_error')
    if (snapshot.status !== 'upstream_error') throw new Error('snapshot deveria falhar')
    expect(snapshot.reason).toBe('request_failed')
    expect(snapshot.totalReceived).toBe(100)
    expect(snapshot.pagesFetched).toBe(1)
    expect('items' in snapshot).toBe(false)
  })

  it('consolida duplicatas idênticas', async () => {
    const duplicate = offer(1)
    const snapshot = await collectMlProductItemsSnapshot(
      'MLB123456',
      async () => page(2, 0, [duplicate, { ...duplicate }]),
    )

    expect(snapshot.status).toBe('success')
    if (snapshot.status !== 'success') throw new Error('snapshot deveria ser válido')
    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.items[0]).toMatchObject({ kind: 'valid', mlRank: 0 })
  })

  it('invalida todo o snapshot quando duplicatas entram em conflito', async () => {
    const duplicate = offer(1)
    const snapshot = await collectMlProductItemsSnapshot(
      'MLB123456',
      async () => page(2, 0, [duplicate, { ...duplicate, price: 109.9 }]),
    )

    expect(snapshot.status).toBe('snapshot_invalid')
    if (snapshot.status !== 'snapshot_invalid') throw new Error('snapshot deveria ser inválido')
    expect(snapshot.reason).toBe('duplicate_conflict')
    expect('items' in snapshot).toBe(false)
  })

  it('rejeita identidade inválida e preserva itens identificáveis com dados comerciais inválidos', async () => {
    const invalidIdentity = { ...offer(1), item_id: 'MLA1234567' } as unknown as MlProductItem
    const invalidSeller = offer(2, { seller_id: 0 })
    const invalidPrice = offer(3, { price: Number.NaN })
    const invalidCurrency = offer(4, { currency_id: 'USD' })
    const invalidCondition = offer(5, { condition: 'used' })

    const snapshot = await collectMlProductItemsSnapshot(
      'MLB123456',
      async () => page(6, 0, [invalidIdentity, invalidSeller, invalidPrice, invalidCurrency, invalidCondition, offer(6)]),
    )

    expect(snapshot.status).toBe('success')
    if (snapshot.status !== 'success') throw new Error('snapshot deveria ser válido')
    expect(snapshot.rejectedByReason).toEqual({
      invalid_item_id: 1,
      invalid_seller_id: 1,
      invalid_price: 1,
      invalid_currency: 1,
      invalid_condition: 1,
    })
    expect(snapshot.items).toEqual([
      { kind: 'invalid', itemId: invalidSeller.item_id, mlRank: 1, reason: 'invalid_seller_id' },
      { kind: 'invalid', itemId: invalidPrice.item_id, mlRank: 2, reason: 'invalid_price' },
      { kind: 'invalid', itemId: invalidCurrency.item_id, mlRank: 3, reason: 'invalid_currency' },
      { kind: 'invalid', itemId: invalidCondition.item_id, mlRank: 4, reason: 'invalid_condition' },
      { kind: 'valid', item: offer(6), mlRank: 5 },
    ])
  })
})
