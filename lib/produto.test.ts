import { describe, expect, it } from 'vitest'

import type { CategoryProduct } from './categories'
import {
  estadoDoProduto,
  linhaDeEmbalagem,
  metricasDoProduto,
  pesoLegivel,
  relacionadosPorDose,
  textoDaEconomia,
  ultimaColetaDe,
  vendedorDaOferta,
} from './produto'
import type { Offer, OfferRaw } from './products'

/**
 * As fixtures existem para DISCORDAR do acaso.
 *
 * A regra deste repositório, paga em 45 mutantes sobreviventes num módulo cujos
 * testes passavam: se a ordem esperada coincide com a ordem de entrada, o teste
 * não distingue a regra de `return lista`. Aqui a mais barata nunca é a
 * primeira da lista, o menor R$/dose nunca é o primeiro card, e o desempate por
 * nome só é exercitado com os nomes fora de ordem alfabética.
 */

function oferta(
  id: number,
  price: number,
  { ml_rank = 1, raw = {}, fetched_at = '2026-09-08T12:07:00Z' }: {
    ml_rank?: number | null
    raw?: OfferRaw
    fetched_at?: string
  } = {},
): Offer {
  return {
    id,
    external_id: `MLB${id}`,
    url: `https://exemplo.test/${id}`,
    price,
    available: true,
    fetched_at,
    ml_rank,
    raw,
  }
}

describe('pesoLegivel', () => {
  it('mostra quilo a partir de 1000 g', () => {
    expect(pesoLegivel(1000)).toBe('1 kg')
    expect(pesoLegivel(2500)).toBe('2.5 kg')
  })

  it('mostra grama abaixo de 1000', () => {
    // 999 e não 900: é a borda que separa as duas unidades.
    expect(pesoLegivel(999)).toBe('999 g')
    expect(pesoLegivel(300)).toBe('300 g')
  })

  it('sem peso e peso zero são a mesma ausência', () => {
    expect(pesoLegivel(null)).toBeNull()
    expect(pesoLegivel(0)).toBeNull()
    expect(pesoLegivel(-1)).toBeNull()
  })
})

describe('linhaDeEmbalagem', () => {
  it('junta doses e peso da dose quando tem os dois', () => {
    // 1000/33 = 30,3 — arredonda ao grama, como a maquete escreve.
    expect(linhaDeEmbalagem(33, 1000)).toBe('33 doses de 30 g')
  })

  it('arredonda para cima quando passa da metade', () => {
    // 900/29 = 31,03; 900/28 = 32,14; 1000/31 = 32,26. Este arredonda: 950/29 = 32,75.
    expect(linhaDeEmbalagem(29, 950)).toBe('29 doses de 33 g')
  })

  it('só as doses quando o anúncio não informa o peso', () => {
    expect(linhaDeEmbalagem(30, null)).toBe('30 doses')
  })

  it('só o peso quando o anúncio não informa as doses', () => {
    expect(linhaDeEmbalagem(null, 900)).toBe('900 g')
    // Zero doses é ausência, não uma embalagem de zero porções.
    expect(linhaDeEmbalagem(0, 900)).toBe('900 g')
  })

  it('nada quando o anúncio não informa nem um nem outro', () => {
    expect(linhaDeEmbalagem(null, null)).toBeNull()
  })
})

describe('metricasDoProduto', () => {
  it('R$/dose vem primeiro e é o azulejo quente', () => {
    const m = metricasDoProduto(59.9, 30, 1000)
    expect(m.map(x => x.rotulo)).toEqual(['R$ / dose', 'R$ / kg'])
    expect(m.map(x => x.destaque)).toEqual([true, false])
  })

  it('os valores saem sem o sufixo, que já está no rótulo', () => {
    const m = metricasDoProduto(60, 30, 1000)
    expect(m[0].valor).toBe('R$ 2,00')
    expect(m[1].valor).toBe('R$ 60,00')
  })

  it('sem doses, o R$/kg assume o destaque', () => {
    const m = metricasDoProduto(60, null, 1000)
    expect(m).toEqual([{ rotulo: 'R$ / kg', valor: 'R$ 60,00', destaque: true }])
  })

  it('sem dose e sem peso não há azulejo nenhum', () => {
    expect(metricasDoProduto(60, null, null)).toEqual([])
  })
})

describe('ultimaColetaDe', () => {
  it('devolve a mais recente, esteja onde estiver na lista', () => {
    // A mais nova no meio: primeira ou última passariam por acaso.
    const offers = [
      oferta(1, 10, { fetched_at: '2026-09-01T00:00:00Z' }),
      oferta(2, 10, { fetched_at: '2026-09-08T12:07:00Z' }),
      oferta(3, 10, { fetched_at: '2026-09-05T00:00:00Z' }),
    ]
    expect(ultimaColetaDe(offers)?.toISOString()).toBe('2026-09-08T12:07:00.000Z')
  })

  it('ignora data inválida em vez de travar o acumulador', () => {
    // `NaN > data` e `data > NaN` são ambos false: sem a guarda, uma data
    // inválida na frente sequestraria o resultado para sempre.
    const offers = [
      oferta(1, 10, { fetched_at: 'não é data' }),
      oferta(2, 10, { fetched_at: '2026-09-08T12:07:00Z' }),
    ]
    expect(ultimaColetaDe(offers)?.toISOString()).toBe('2026-09-08T12:07:00.000Z')
  })

  it('sem oferta nenhuma, não há coleta', () => {
    expect(ultimaColetaDe([])).toBeNull()
    expect(ultimaColetaDe([oferta(1, 10, { fetched_at: 'inválida' })])).toBeNull()
  })
})

describe('vendedorDaOferta', () => {
  it('loja oficial tem precedência sobre a cidade', () => {
    const o = oferta(1, 10, {
      raw: { official_store_id: 42, seller_address: { city: { name: 'Curitiba' } } },
    })
    expect(vendedorDaOferta(o)).toBe('Loja oficial no Mercado Livre')
  })

  it('sem loja oficial, diz de onde despacha', () => {
    const o = oferta(1, 10, { raw: { seller_address: { city: { name: 'Curitiba' } } } })
    expect(vendedorDaOferta(o)).toBe('Vendedor em Curitiba')
  })

  it('sem nada, não inventa nome de loja', () => {
    expect(vendedorDaOferta(oferta(1, 10, { raw: null }))).toBe('Vendedor no Mercado Livre')
    expect(vendedorDaOferta(oferta(1, 10, { raw: { official_store_id: null } }))).toBe(
      'Vendedor no Mercado Livre',
    )
  })

  it('endereço sem cidade não estoura', () => {
    // O snapshot do ML traz `seller_address` com campos faltando. Sem o `?.`
    // em `city`, esta linha derruba a página inteira do produto.
    expect(vendedorDaOferta(oferta(1, 10, { raw: { seller_address: {} } }))).toBe(
      'Vendedor no Mercado Livre',
    )
  })
})

describe('textoDaEconomia', () => {
  it('nomeia o número em reais', () => {
    expect(textoDaEconomia(30)).toBe('Economiza R$ 30,00')
  })

  it('sem desconto não há texto', () => {
    expect(textoDaEconomia(null)).toBeNull()
  })
})

describe('estadoDoProduto', () => {
  /*
    A lista chega ordenada por `compareOffers`, ou seja pela ordem do ML — e
    aqui ela DISCORDA do preço de propósito: o ML promove a de R$ 89,90 e a
    mais barata é a terceira. Uma fixture já ordenada por preço não
    distinguiria `maisBarata` de `offers[0]`.
  */
  const OFERTAS = [
    oferta(101, 89.9, { ml_rank: 1, raw: { thumbnail: 'https://exemplo.test/101.jpg' } }),
    oferta(102, 84.5, { ml_rank: 2 }),
    oferta(103, 59.9, { ml_rank: 3, raw: { original_price: 79.9 } }),
  ]

  it('a caixa fixa mostra a mais barata, não a promovida', () => {
    const e = estadoDoProduto(OFERTAS, { servings: 30, sizeGrams: 1000 })!
    expect(e.menor.id).toBe(103)
    expect(e.menor.price).toBe(59.9)
  })

  it('nomeia a promovida quando o ML destaca outra', () => {
    const e = estadoDoProduto(OFERTAS, { servings: 30, sizeGrams: 1000 })!
    expect(e.destaque?.id).toBe(101)
  })

  it('não repete a mesma oferta como contradição de si mesma', () => {
    const so = [oferta(101, 59.9, { ml_rank: 1 }), oferta(102, 84.5, { ml_rank: 2 })]
    expect(estadoDoProduto(so, { servings: 30, sizeGrams: 1000 })!.destaque).toBeNull()
  })

  it('o desconto sai da mais barata, não da promovida', () => {
    const e = estadoDoProduto(OFERTAS, { servings: 30, sizeGrams: 1000 })!
    expect(e.temDesconto).toBe(true)
    expect(e.precoOriginal).toBe(79.9)
    // 1 - 59,90/79,90 = 25,03% → 25
    expect(e.percentualDesconto).toBe(25)
    expect(e.economia).toBeCloseTo(20, 2)
  })

  it('original_price igual ao preço não é desconto', () => {
    const iguais = [oferta(101, 59.9, { raw: { original_price: 59.9 } })]
    const e = estadoDoProduto(iguais, { servings: null, sizeGrams: null })!
    expect(e.temDesconto).toBe(false)
    expect(e.percentualDesconto).toBe(0)
    expect(e.economia).toBeNull()
  })

  it('as métricas saem do preço da caixa, não do preço promovido', () => {
    const e = estadoDoProduto(OFERTAS, { servings: 30, sizeGrams: 1000 })!
    // 59,90/30 = 2,00 (a promovida daria 3,00) e 59,90/kg (daria 89,90).
    expect(e.metricas.map(m => m.valor)).toEqual(['R$ 2,00', 'R$ 59,90'])
  })

  it('conta todas as ofertas, não só a exibida', () => {
    expect(estadoDoProduto(OFERTAS, { servings: null, sizeGrams: null })!.totalOfertas).toBe(3)
  })

  it('a foto cai para a promovida quando a mais barata não tem', () => {
    // A mais barata (103) não traz thumbnail; a promovida (101) traz.
    const e = estadoDoProduto(OFERTAS, { servings: null, sizeGrams: null })!
    expect(e.thumbnail).toBe('https://exemplo.test/101.jpg')
  })

  it('a foto é a da mais barata quando ela tem a sua', () => {
    const comFoto = [
      oferta(101, 89.9, { ml_rank: 1, raw: { thumbnail: 'https://exemplo.test/promovida.jpg' } }),
      oferta(103, 59.9, { ml_rank: 3, raw: { thumbnail: 'https://exemplo.test/barata.jpg' } }),
    ]
    expect(estadoDoProduto(comFoto, { servings: null, sizeGrams: null })!.thumbnail).toBe(
      'https://exemplo.test/barata.jpg',
    )
  })

  it('sem foto em nenhuma oferta, é ausência e não string vazia', () => {
    const semFoto = [oferta(101, 89.9, { raw: null }), oferta(103, 59.9, { raw: null })]
    expect(estadoDoProduto(semFoto, { servings: null, sizeGrams: null })!.thumbnail).toBeNull()
  })

  it('sem oferta disponível não há estado', () => {
    expect(estadoDoProduto([], { servings: 30, sizeGrams: 1000 })).toBeNull()
  })

  describe('desempate da mais barata', () => {
    it('preço igual: vence a que o ML põe na frente', () => {
      // A de rank melhor vem DEPOIS na lista, senão `reduce` acertaria sozinho.
      const empate = [oferta(1, 59.9, { ml_rank: 5 }), oferta(2, 59.9, { ml_rank: 2 })]
      expect(estadoDoProduto(empate, { servings: null, sizeGrams: null })!.menor.id).toBe(2)
    })

    it('preço e rank iguais: vence o id menor, venha na ordem que vier', () => {
      const empate = [oferta(9, 59.9, { ml_rank: 3 }), oferta(4, 59.9, { ml_rank: 3 })]
      expect(estadoDoProduto(empate, { servings: null, sizeGrams: null })!.menor.id).toBe(4)
    })

    it('oferta sem rank perde para oferta com rank', () => {
      const empate = [oferta(1, 59.9, { ml_rank: null }), oferta(2, 59.9, { ml_rank: 9 })]
      expect(estadoDoProduto(empate, { servings: null, sizeGrams: null })!.menor.id).toBe(2)
    })

    /*
      Os dois casos abaixo são o espelho dos dois de cima, e existem porque um
      desempate só está testado quando o vencedor aparece nas DUAS posições.
      Com o vencedor sempre em segundo, "o segundo sempre vence" passaria em
      todos eles — foi o que o Stryker acusou.
    */
    it('preço igual: o melhor rank vence mesmo vindo primeiro', () => {
      const empate = [oferta(1, 59.9, { ml_rank: 2 }), oferta(2, 59.9, { ml_rank: 5 })]
      expect(estadoDoProduto(empate, { servings: null, sizeGrams: null })!.menor.id).toBe(1)
    })

    it('preço e rank iguais: o id menor vence mesmo vindo primeiro', () => {
      const empate = [oferta(4, 59.9, { ml_rank: 3 }), oferta(9, 59.9, { ml_rank: 3 })]
      expect(estadoDoProduto(empate, { servings: null, sizeGrams: null })!.menor.id).toBe(4)
    })
  })
})

describe('relacionadosPorDose', () => {
  function card(
    id: number,
    slug: string,
    name: string,
    featuredPerDose: number | null,
  ): CategoryProduct {
    return {
      id,
      slug,
      name,
      brand: null,
      thumbnail: null,
      offerCount: 1,
      featuredPrice: 100,
      featuredOriginalPrice: null,
      lowestPrice: 100,
      lowestOfferId: id,
      featuredOfferId: id,
      servings: 30,
      sizeGrams: 1000,
      featuredPerDose,
      flavor: null,
    }
  }

  /*
    A ordem de entrada é o inverso da esperada, e o produto atual está no meio:
    qualquer implementação que devolva a lista como veio, ou que corte antes de
    ordenar, sai diferente.
  */
  const CATALOGO = [
    card(1, 'caro', 'Zeta Whey', 9.5),
    card(2, 'atual', 'Este Produto', 5),
    card(3, 'medio', 'Beta Whey', 4),
    card(4, 'barato', 'Alfa Whey', 1.5),
    card(5, 'sem-dose', 'Whey sem dose informada', null),
  ]

  it('ordena por R$/dose crescente', () => {
    expect(relacionadosPorDose(CATALOGO, 'atual', 10).map(c => c.slug)).toEqual([
      'barato',
      'medio',
      'caro',
    ])
  })

  it('não sugere o produto que já está na tela', () => {
    expect(relacionadosPorDose(CATALOGO, 'atual', 10).map(c => c.slug)).not.toContain('atual')
  })

  it('produto sem dose informada fica de fora da fileira ordenada por dose', () => {
    expect(relacionadosPorDose(CATALOGO, 'atual', 10).map(c => c.slug)).not.toContain('sem-dose')
  })

  it('corta depois de ordenar, e não antes', () => {
    // Cortando antes, o primeiro da entrada ('caro') sobreviveria.
    expect(relacionadosPorDose(CATALOGO, 'atual', 1).map(c => c.slug)).toEqual(['barato'])
  })

  it('empate de dose desempata por nome, não pela ordem do banco', () => {
    const empate = [
      card(1, 'z', 'Zeta Whey', 3),
      card(2, 'a', 'Alfa Whey', 3),
      card(3, 'atual', 'Este', 1),
    ]
    expect(relacionadosPorDose(empate, 'atual', 10).map(c => c.slug)).toEqual(['a', 'z'])
  })

  it('categoria sem outro produto com dose devolve fileira vazia', () => {
    expect(relacionadosPorDose([card(2, 'atual', 'Este', 5)], 'atual', 4)).toEqual([])
  })
})
