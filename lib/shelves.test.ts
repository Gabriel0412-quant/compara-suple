import { describe, expect, it } from 'vitest'

import type { CategoryProduct } from './categories'
import {
  CATEGORIAS_DA_HOME,
  compararPorPrecoDestacado,
  montarPrateleiras,
  PRODUTOS_POR_PRATELEIRA,
} from './shelves'

function card(over: Partial<CategoryProduct> = {}): CategoryProduct {
  return {
    id: 1,
    slug: 'whey-growth',
    name: 'Whey Protein Concentrado Growth',
    brand: 'Growth Supplements',
    thumbnail: null,
    offerCount: 3,
    featuredPrice: 100,
    featuredOriginalPrice: null,
    featuredOfferId: 10,
    lowestPrice: null,
    lowestOfferId: null,
    servings: 30,
    sizeGrams: 1000,
    featuredPerDose: 100 / 30,
    ...over,
  }
}

/** Nomes que casam as keywords de cada categoria da home. */
const whey = (over: Partial<CategoryProduct> = {}) =>
  card({ name: 'Whey Protein Concentrado', ...over })
const creatina = (over: Partial<CategoryProduct> = {}) =>
  card({ name: 'Creatina Monohidratada', ...over })
const preTreino = (over: Partial<CategoryProduct> = {}) =>
  card({ name: 'Pré-treino Insano', ...over })

describe('ordem da prateleira', () => {
  it('põe o menor preço destacado primeiro', () => {
    const ordenados = [card({ featuredPrice: 200 }), card({ featuredPrice: 50 }), card({ featuredPrice: 120 })]
      .sort(compararPorPrecoDestacado)
      .map(p => p.featuredPrice)
    expect(ordenados).toEqual([50, 120, 200])
  })

  it('empate de preço vai para quem tem mais ofertas', () => {
    const ordenados = [
      card({ id: 1, name: 'A', featuredPrice: 100, offerCount: 1 }),
      card({ id: 2, name: 'B', featuredPrice: 100, offerCount: 9 }),
    ]
      .sort(compararPorPrecoDestacado)
      .map(p => p.name)
    expect(ordenados).toEqual(['B', 'A'])
  })

  it('empate de preço e de ofertas vai para o nome', () => {
    const ordenados = [
      card({ id: 1, name: 'Zinco', featuredPrice: 100, offerCount: 2 }),
      card({ id: 2, name: 'Ácido', featuredPrice: 100, offerCount: 2 }),
    ]
      .sort(compararPorPrecoDestacado)
      .map(p => p.name)
    expect(ordenados).toEqual(['Ácido', 'Zinco'])
  })

  it('não depende da ordem em que o banco respondeu', () => {
    const entrada = [
      card({ id: 1, name: 'Alfa', featuredPrice: 100, offerCount: 2 }),
      card({ id: 2, name: 'Beta', featuredPrice: 100, offerCount: 2 }),
    ]
    const daOrdemA = [...entrada].sort(compararPorPrecoDestacado).map(p => p.name)
    const daOrdemB = [...entrada].reverse().sort(compararPorPrecoDestacado).map(p => p.name)
    expect(daOrdemA).toEqual(daOrdemB)
  })

  it('preço mais baixo vence mesmo com menos ofertas', () => {
    /*
      O caso em que os dois primeiros critérios discordam. Sem ele, inverter a
      ordem dos critérios passaria — foi a mutação que escapou no #151, e não
      quero repetir o mesmo furo.
    */
    const ordenados = [
      card({ id: 1, name: 'CaroComMuitas', featuredPrice: 300, offerCount: 20 }),
      card({ id: 2, name: 'BaratoComPoucas', featuredPrice: 80, offerCount: 1 }),
    ]
      .sort(compararPorPrecoDestacado)
      .map(p => p.name)
    expect(ordenados).toEqual(['BaratoComPoucas', 'CaroComMuitas'])
  })
})

describe('montagem das prateleiras', () => {
  it('monta as três categorias da home, na ordem declarada', () => {
    const prateleiras = montarPrateleiras([whey(), creatina(), preTreino()])
    expect(prateleiras.map(p => p.categoria.slug)).toEqual([...CATEGORIAS_DA_HOME])
  })

  it('corta em quatro produtos, mas conta todos', () => {
    /*
      Os preços entram fora de ordem de propósito.

      A primeira versão deste teste gerava `(i + 1) * 10`, ou seja, já
      ordenado — e o Stryker mostrou que remover o `.sort()` inteiro de
      `montarPrateleiras` sobrevivia, porque `.slice(0, 4)` sobre uma lista já
      crescente dá o mesmo resultado. É o mesmo furo do #151: fixture que
      concorda com a regra não testa a regra.
    */
    const precos = [60, 10, 50, 20, 40, 30]
    const seis = precos.map((preco, i) =>
      whey({ id: i + 1, name: `Whey Protein ${i}`, featuredPrice: preco, offerCount: 2 }),
    )
    const [prateleira] = montarPrateleiras(seis, ['whey-protein'])

    expect(prateleira.produtos).toHaveLength(PRODUTOS_POR_PRATELEIRA)
    expect(prateleira.totalProdutos, 'o total precisa refletir a categoria, não a vitrine').toBe(6)
    expect(prateleira.totalOfertas).toBe(12)
    // Os quatro exibidos são os mais baratos, não os quatro primeiros da lista.
    expect(prateleira.produtos.map(p => p.featuredPrice)).toEqual([10, 20, 30, 40])
  })

  it('soma as ofertas ativas de toda a categoria', () => {
    const [prateleira] = montarPrateleiras(
      [whey({ id: 1, offerCount: 4 }), whey({ id: 2, name: 'Whey Isolado', offerCount: 7 })],
      ['whey-protein'],
    )
    expect(prateleira.totalOfertas).toBe(11)
  })

  it('com menos de quatro produtos, a prateleira existe e mostra o que tem', () => {
    const [prateleira] = montarPrateleiras([whey({ id: 1 }), whey({ id: 2, name: 'Whey Isolado' })], [
      'whey-protein',
    ])
    expect(prateleira.produtos).toHaveLength(2)
    expect(prateleira.totalProdutos).toBe(2)
  })

  it('categoria sem produto publicável não vira prateleira vazia', () => {
    // Cabeçalho de categoria com nada embaixo promete e não entrega.
    const prateleiras = montarPrateleiras([whey()], [...CATEGORIAS_DA_HOME])
    expect(prateleiras.map(p => p.categoria.slug)).toEqual(['whey-protein'])
  })

  it('catálogo vazio não produz prateleira nenhuma', () => {
    expect(montarPrateleiras([])).toEqual([])
  })

  it('estoura se a lista da home citar categoria que não existe', () => {
    // Erro de programação, não estado do catálogo: alguém renomeou a categoria
    // e esqueceu a lista. Falhar alto é melhor que perder a prateleira calado.
    expect(() => montarPrateleiras([whey()], ['whey-protein', 'categoria-fantasma'])).toThrow(
      /categoria-fantasma/,
    )
  })
})

describe('estado editorial dos campos ausentes', () => {
  it('não inventa imagem, preço anterior, dose nem peso', () => {
    /*
      O read model repassa os nulos como estão. Quem decide o que dizer no
      lugar é a tela — e a formulação já existe: "sem dose ou peso informado",
      não campo omitido nem zero.
    */
    const semNada = whey({
      thumbnail: null,
      featuredOriginalPrice: null,
      servings: null,
      sizeGrams: null,
      featuredPerDose: null,
    })
    const [prateleira] = montarPrateleiras([semNada], ['whey-protein'])
    const produto = prateleira.produtos[0]

    expect(produto.thumbnail).toBeNull()
    expect(produto.featuredOriginalPrice).toBeNull()
    expect(produto.servings).toBeNull()
    expect(produto.sizeGrams).toBeNull()
    expect(produto.featuredPerDose).toBeNull()
  })

  it('não altera o array recebido', () => {
    const entrada = [whey({ id: 1, featuredPrice: 200 }), whey({ id: 2, featuredPrice: 100 })]
    montarPrateleiras(entrada, ['whey-protein'])
    expect(entrada.map(p => p.featuredPrice)).toEqual([200, 100])
  })
})
