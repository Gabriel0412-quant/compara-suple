import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getValidAccessToken } = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
}))

vi.mock('./oauth', () => ({ getValidAccessToken }))

import { getUserProduct, getUserProductItems } from './client'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('user products client', () => {
  beforeEach(() => {
    getValidAccessToken.mockReset()
    getValidAccessToken.mockResolvedValue('access-token-de-teste')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('obtém os metadados pelo endpoint de user products', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      id: 'MLBU3907661448',
      name: 'Daily Whey Protein Zero Lactose 800g',
      user_id: 437089518,
      domain_id: 'MLB-SUPPLEMENTS',
      attributes: [],
    }))

    await expect(getUserProduct('MLBU3907661448')).resolves.toMatchObject({
      id: 'MLBU3907661448',
      user_id: 437089518,
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.mercadolibre.com/user-products/MLBU3907661448',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-de-teste',
        }),
      }),
    )
  })

  it('descobre os anúncios pelo seller e normaliza os detalhes para o snapshot', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        seller_id: 437089518,
        paging: { total: 1, offset: 0, limit: 100 },
        results: ['MLB6620125422'],
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'MLB6620125422',
        site_id: 'MLB',
        seller_id: 437089518,
        price: 147.05,
        original_price: 159.9,
        currency_id: 'BRL',
        category_id: 'MLB264528',
        condition: 'new',
        listing_type_id: 'gold_special',
        official_store_id: null,
        status: 'active',
        available_quantity: 10,
        shipping: { free_shipping: true },
        user_product_id: 'MLBU3907661448',
      }))

    const snapshot = await getUserProductItems('MLBU3907661448', 437089518)

    expect(snapshot.status).toBe('success')
    if (snapshot.status !== 'success') throw new Error('snapshot deveria ser válido')
    expect(snapshot.items).toEqual([
      {
        kind: 'valid',
        mlRank: 0,
        item: expect.objectContaining({
          item_id: 'MLB6620125422',
          seller_id: 437089518,
          price: 147.05,
          user_product_id: 'MLBU3907661448',
        }),
      },
    ])
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      'https://api.mercadolibre.com/users/437089518/items/search?user_product_id=MLBU3907661448&status=active&offset=0&limit=100',
    )
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
      'https://api.mercadolibre.com/items/MLB6620125422',
    )
  })

  it('trata user product sem anúncio ativo como snapshot vazio válido', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      seller_id: 437089518,
      paging: { total: 0, offset: 0, limit: 100 },
      results: [],
    }))

    const snapshot = await getUserProductItems('MLBU3907661448', 437089518)

    expect(snapshot).toMatchObject({
      status: 'success_empty',
      totalReceived: 0,
      pagesFetched: 1,
      items: [],
    })
    expect(fetch).toHaveBeenCalledOnce()
  })
})
