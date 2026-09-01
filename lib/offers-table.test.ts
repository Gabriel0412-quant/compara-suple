import { describe, expect, it } from 'vitest'
import type { Offer } from './products'
import {
  filtrarRows,
  menorPrecoRow,
  offerToRow,
  ordenarRows,
  rotuloFrete,
} from './offers-table'

function offer(over: Partial<Offer> & { id: number; price: number }): Offer {
  return {
    external_id: `MLB${over.id}`,
    url: `https://exemplo/${over.id}`,
    available: true,
    fetched_at: '2026-08-31T00:00:00Z',
    ml_rank: null,
    raw: {},
    ...over,
  } as Offer
}

// Caso real do catálogo: o ML destaca uma oferta mais cara que outra na tabela.
const DESTAQUE_CARO = offer({
  id: 1, price: 59.5, ml_rank: 0,
  raw: { official_store_id: 7, shipping: { free_shipping: true } },
})
const MAIS_BARATA = offer({
  id: 2, price: 35.91, ml_rank: 3,
  raw: { seller_id: 4, seller_address: { city: { name: 'Curitiba' } } },
})
const INTERMEDIARIA = offer({ id: 3, price: 42, ml_rank: 1, raw: { seller_id: 5 } })

const linhas = [DESTAQUE_CARO, MAIS_BARATA, INTERMEDIARIA].map(offerToRow)

describe('menorPrecoRow', () => {
  it('aponta a mais barata mesmo quando o destaque do ML é mais caro', () => {
    expect(menorPrecoRow(linhas)?.offerId).toBe(2)
  })

  it.each(['featured', 'preco', 'discount'] as const)(
    'não muda ao ordenar por %s',
    sortBy => {
      expect(menorPrecoRow(ordenarRows(linhas, sortBy))?.offerId).toBe(2)
    },
  )

  it('acompanha o filtro, que é escolha do usuário sobre o que comparar', () => {
    const soOficial = filtrarRows(linhas, {
      onlyFreeShipping: false, onlyOfficial: true, onlyFull: false,
    })

    expect(menorPrecoRow(soOficial)?.offerId).toBe(1)
  })

  it('devolve null quando nenhuma linha sobrou', () => {
    expect(menorPrecoRow([])).toBeNull()
  })
})

describe('ordenarRows', () => {
  it('preserva a ordem do servidor em "featured"', () => {
    expect(ordenarRows(linhas, 'featured').map(r => r.offerId)).toEqual([1, 2, 3])
  })

  it('ordena por preço do item, não por um total inventado', () => {
    expect(ordenarRows(linhas, 'preco').map(r => r.offerId)).toEqual([2, 3, 1])
  })

  it('não muta o array recebido', () => {
    const antes = linhas.map(r => r.offerId)
    ordenarRows(linhas, 'preco')
    expect(linhas.map(r => r.offerId)).toEqual(antes)
  })
})

describe('rotuloFrete', () => {
  it('afirma frete grátis só quando o Mercado Livre afirma', () => {
    expect(rotuloFrete({ freeShipping: true })).toBe('frete grátis')
  })

  it('promete soma nenhuma quando o frete depende do CEP', () => {
    expect(rotuloFrete({ freeShipping: false })).toBe('+ frete')
  })
})

describe('offerToRow', () => {
  it('lê frete grátis e loja oficial do payload do Mercado Livre', () => {
    const row = offerToRow(DESTAQUE_CARO)

    expect(row).toMatchObject({ isOfficial: true, freeShipping: true, preco: 59.5 })
  })

  it('não inventa frete grátis quando o payload não traz shipping', () => {
    expect(offerToRow(INTERMEDIARIA).freeShipping).toBe(false)
  })

  it('identifica o vendedor pela cidade quando ela existe', () => {
    expect(offerToRow(MAIS_BARATA).nome).toBe('Vendedor em Curitiba')
  })
})
