import { describe, expect, it } from 'vitest'

import type { CategoryProduct } from './categories'
import {
  CATEGORIAS_DA_HOME,
  PRODUTOS_POR_PRATELEIRA,
  compararPorPrecoDestacado,
  descontosDaPrateleira,
  fundoDaCategoria,
  fundoDaPrateleira,
  montarPrateleiras,
} from './shelves'

function card(over: Partial<CategoryProduct> = {}): CategoryProduct {
  return {
    id: 1,
    slug: 'whey-growth',
    name: 'Whey Protein Concentrado Growth',
    brand: 'Growth Supplements',
    thumbnail: null,
    flavor: null,
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

  it('carrega mais produtos do que caberiam na tela, para as setas terem função', () => {
    /*
      A prateleira carregava 4, que é quantos a maquete desenha visíveis — e
      quatro cabem em 1440px, então não havia transbordo e as setas se
      escondiam por não terem para onde rolar. Medido em produção: whey tem 11
      produtos, e sete nunca apareciam.
    */
    expect(PRODUTOS_POR_PRATELEIRA).toBeGreaterThan(4)

    const doze = Array.from({ length: 20 }, (_, i) =>
      whey({ id: i + 1, name: `Whey Protein ${i}`, featuredPrice: 100 + i, offerCount: 2 }),
    )
    const [prateleira] = montarPrateleiras(doze, ['whey-protein'])
    expect(prateleira.produtos).toHaveLength(PRODUTOS_POR_PRATELEIRA)
    expect(prateleira.totalProdutos).toBe(20)
  })

  it('corta no limite, mas conta todos', () => {
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
    const [prateleira] = montarPrateleiras(seis, ['whey-protein'], 4)

    expect(prateleira.produtos).toHaveLength(4)
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

describe('fundo alternado', () => {
  it('alterna a cada prateleira', () => {
    const fundos = [0, 1, 2, 3].map(fundoDaPrateleira)
    expect(fundos).toEqual([
      'bg-surface-muted',
      'bg-surface',
      'bg-surface-muted',
      'bg-surface',
    ])
  })

  it('duas prateleiras seguidas nunca têm o mesmo fundo', () => {
    // Sem alternância os blocos encostam sem separação visível, que é o que a
    // maquete evita trocando o fundo em vez de usar linha divisória.
    for (let i = 0; i < 6; i++) {
      expect(fundoDaPrateleira(i)).not.toBe(fundoDaPrateleira(i + 1))
    }
  })

  it('devolve classe literal, não montada', () => {
    // Classe interpolada não é gerada pelo Tailwind e o bloco sai sem fundo.
    for (let i = 0; i < 4; i++) {
      expect(fundoDaPrateleira(i)).toMatch(/^bg-[a-z-]+$/)
    }
  })

  /*
    A categoria não começa no zero.

    Desde o #211 a prateleira de descontos vem antes, e ocupa o índice 0. Se a
    primeira categoria recomeçasse do zero, ela repetiria o fundo dos descontos
    e as duas faixas colariam numa só — que é exatamente o que a alternância
    existe para evitar.
  */
  it('a primeira categoria não repete o fundo da prateleira que vem antes', () => {
    expect(fundoDaCategoria(0)).not.toBe(fundoDaPrateleira(0))
  })

  it('as categorias seguem alternando entre si', () => {
    for (let i = 0; i < 6; i++) {
      expect(fundoDaCategoria(i)).not.toBe(fundoDaCategoria(i + 1))
    }
  })
})

describe('corte da prateleira de descontos', () => {
  const lista = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: i }) as unknown as CategoryProduct)

  it('corta no mesmo limite das prateleiras de categoria', () => {
    expect(descontosDaPrateleira(lista(30))).toHaveLength(PRODUTOS_POR_PRATELEIRA)
  })

  it('com menos produtos que o limite, devolve todos', () => {
    // O caso que discrimina: se a função devolvesse sempre `PRODUTOS_POR_
    // PRATELEIRA` itens, o teste acima passaria e este não.
    expect(descontosDaPrateleira(lista(3))).toHaveLength(3)
  })

  it('preserva a ordem que veio, que é a do desconto', () => {
    // `getProductsOnSale` já ordena; reordenar aqui desfaria o critério em
    // silêncio, e a prateleira mostraria "maiores descontos" fora de ordem.
    const entrada = lista(5)
    expect(descontosDaPrateleira(entrada)).toEqual(entrada)
  })

  it('não altera o array recebido', () => {
    const entrada = lista(30)
    descontosDaPrateleira(entrada)
    expect(entrada).toHaveLength(30)
  })
})
