import { describe, expect, it } from 'vitest'
import type { Offer } from './products'
import {
  filtrarRows,
  linhasVisiveis,
  menorPrecoRow,
  ofertasOcultas,
  offerToRow,
  ordenarRows,
  rotuloDeMaisOfertas,
  rotuloFrete,
  OFERTAS_VISIVEIS,
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

describe('a linha de oferta não afirma o que não sabe', () => {
  it('não carrega estoque', () => {
    // `offerToRow` devolvia `estoque: 'Em estoque'` fixo, em verde, para toda
    // oferta — a tabela afirmava disponibilidade para 6 lojas sem nenhum campo
    // por trás. A API do Mercado Livre não devolve esse dado no snapshot que
    // coletamos; então a linha não deve ter onde guardá-lo.
    const row = offerToRow(offer({ id: 1, price: 100 })) as Record<string, unknown>
    expect(row).not.toHaveProperty('estoque')
    expect(row).not.toHaveProperty('estoqueColor')
  })

  it('só marca frete grátis quando o campo diz isso', () => {
    expect(offerToRow(offer({ id: 1, price: 100 })).freeShipping).toBe(false)
    expect(
      offerToRow(offer({ id: 2, price: 100, raw: { shipping: { free_shipping: true } } })).freeShipping,
    ).toBe(true)
  })

  it('só marca loja oficial quando há official_store_id', () => {
    expect(offerToRow(offer({ id: 1, price: 100 })).isOfficial).toBe(false)
    expect(
      offerToRow(offer({ id: 2, price: 100, raw: { official_store_id: 7 } })).isOfficial,
    ).toBe(true)
  })

  it('não carrega cor de avatar', () => {
    // Era uma das seis cores da paleta padrão do Tailwind, sorteada por
    // `seller_id % 6`: identidade visual de vendedor nenhum, no cartão que é
    // nosso. Saiu no #163 junto com o redesenho da página.
    const row = offerToRow(offer({ id: 1, price: 100 })) as Record<string, unknown>
    expect(row).not.toHaveProperty('avatarColor')
  })
})

describe('o teto de linhas da tabela', () => {
  /*
    Fila em ordem do Mercado Livre, com a mais barata FORA das dez primeiras.
    É o caso que importa: uma fixture em que a mais barata já é a primeira não
    distingue `linhasVisiveis` de um `slice` simples.
  */
  const fila = (n: number, posicaoDaBarata = n - 1) =>
    Array.from({ length: n }, (_, i) =>
      offerToRow(offer({ id: 100 + i, price: i === posicaoDaBarata ? 1 : 50 + i })),
    )

  it('mostra o teto, mais a mais barata quando ela ficaria de fora', () => {
    const visiveis = linhasVisiveis(fila(13), 10)
    expect(visiveis).toHaveLength(11)
    expect(visiveis.at(-1)!.preco).toBe(1)
  })

  it('não duplica a mais barata quando ela já está nas primeiras', () => {
    const visiveis = linhasVisiveis(fila(13, 0), 10)
    expect(visiveis).toHaveLength(10)
    expect(visiveis.filter(r => r.preco === 1)).toHaveLength(1)
  })

  it('cabendo todas, o teto não corta nada', () => {
    expect(linhasVisiveis(fila(10), 10)).toHaveLength(10)
    expect(linhasVisiveis(fila(2), 10)).toHaveLength(2)
  })

  it('lista vazia não estoura', () => {
    expect(linhasVisiveis([], 10)).toEqual([])
    expect(ofertasOcultas([], 10)).toBe(0)
  })

  it('o número escondido desconta a linha extra da mais barata', () => {
    // 13 linhas, 11 na tela: sobram 2, não 3. Dizer 3 seria contar duas vezes
    // a oferta que já está visível.
    expect(ofertasOcultas(fila(13), 10)).toBe(2)
    expect(ofertasOcultas(fila(13, 0), 10)).toBe(3)
  })

  it('nada escondido quando cabem todas', () => {
    expect(ofertasOcultas(fila(10), 10)).toBe(0)
    expect(ofertasOcultas(fila(2), 10)).toBe(0)
  })

  it('o rótulo do botão diz quantas faltam, e no plural certo', () => {
    expect(rotuloDeMaisOfertas(121, false)).toBe('Ver as outras 121 ofertas')
    expect(rotuloDeMaisOfertas(1, false)).toBe('Ver mais 1 oferta')
  })

  it('aberto, o botão passa a fechar', () => {
    expect(rotuloDeMaisOfertas(121, true)).toBe('Mostrar menos')
    expect(rotuloDeMaisOfertas(1, true)).toBe('Mostrar menos')
  })

  it('o número grande vem separado por milhar', () => {
    // 534 ofertas escondidas é o caso real da creatina da Integralmédica.
    expect(rotuloDeMaisOfertas(1534, false)).toBe('Ver as outras 1.534 ofertas')
  })

  it('o teto é dez, que é o que cobre a mediana do catálogo', () => {
    // Medido em 13/09/2026: 8 dos 15 produtos com oferta ativa têm 10 ou
    // menos. Mexer aqui muda quantos produtos ganham botão.
    expect(OFERTAS_VISIVEIS).toBe(10)
  })
})
