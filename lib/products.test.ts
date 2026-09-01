import { describe, expect, it } from 'vitest'

import { featuredOffer, flattenOffers, lowestPriceOffer } from './products'
import type { Offer, ProductDetail } from './products'

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 1,
    external_id: 'MLB1',
    url: 'https://www.mercadolivre.com.br/p/MLB1',
    price: 100,
    available: true,
    fetched_at: '2026-08-31T00:00:00Z',
    ml_rank: 0,
    raw: null,
    ...overrides,
  } as Offer
}

function product(offers: Offer[]): ProductDetail {
  return {
    id: 1,
    slug: 'produto',
    name: 'Produto',
    brand: null,
    variants: [{ id: 1, flavor: null, size_grams: null, servings: null, offers }],
  } as unknown as ProductDetail
}

describe('flattenOffers', () => {
  it('exclui ofertas indisponíveis', () => {
    const p = product([
      offer({ id: 1, price: 100, available: true }),
      offer({ id: 2, price: 50, available: false }),
    ])
    expect(flattenOffers(p).map(o => o.id)).toEqual([1])
  })

  it('devolve lista vazia quando nenhuma oferta está ativa', () => {
    const p = product([offer({ id: 1, available: false })])
    expect(flattenOffers(p)).toEqual([])
  })
})

describe('lowestPriceOffer', () => {
  it('ignora a mais barata quando ela está indisponível', () => {
    const escolhida = lowestPriceOffer([
      offer({ id: 1, price: 100, available: true }),
      offer({ id: 2, price: 35.91, available: false }),
    ])
    expect(escolhida?.id).toBe(1)
  })

  it('encontra o menor preço mesmo quando o ML destaca outra oferta', () => {
    // O caso real que originou a correção: destaque em R$ 59,50 com uma
    // oferta de R$ 35,91 na mesma página.
    const escolhida = lowestPriceOffer([
      offer({ id: 1, price: 59.5, ml_rank: 0 }),
      offer({ id: 2, price: 35.91, ml_rank: 3 }),
    ])
    expect(escolhida?.price).toBe(35.91)
  })

  it('desempata por ml_rank e depois por id, de forma estável', () => {
    const escolhida = lowestPriceOffer([
      offer({ id: 9, price: 50, ml_rank: 2 }),
      offer({ id: 4, price: 50, ml_rank: 1 }),
      offer({ id: 7, price: 50, ml_rank: 1 }),
    ])
    expect(escolhida?.id).toBe(4)
  })

  it('devolve null sem ofertas disponíveis', () => {
    expect(lowestPriceOffer([offer({ available: false })])).toBeNull()
  })
})

describe('featuredOffer', () => {
  it('respeita a ordem do ML, não o preço', () => {
    const escolhida = featuredOffer([
      offer({ id: 1, price: 59.5, ml_rank: 0 }),
      offer({ id: 2, price: 35.91, ml_rank: 3 }),
    ])
    expect(escolhida?.id).toBe(1)
  })

  it('ignora indisponíveis mesmo com ml_rank melhor', () => {
    const escolhida = featuredOffer([
      offer({ id: 1, price: 59.5, ml_rank: 0, available: false }),
      offer({ id: 2, price: 80, ml_rank: 3, available: true }),
    ])
    expect(escolhida?.id).toBe(2)
  })
})
