import { describe, expect, it } from 'vitest'

import {
  agregarMarcas,
  ordenarMarcas,
  slugDaMarca,
  tomDaMarca,
  TONS_DE_MARCA,
  type Marca,
} from './brands'
import type { CategoryProduct } from './categories'

function card(over: Partial<CategoryProduct> = {}): CategoryProduct {
  return {
    id: 1,
    slug: 'whey-growth',
    name: 'Whey Protein Concentrado',
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

function marca(over: Partial<Marca> = {}): Marca {
  return { nome: 'Growth', slug: 'growth', produtos: 1, ofertas: 1, tom: 0, ...over }
}

describe('agregação', () => {
  it('soma produtos e ofertas por marca', () => {
    const marcas = agregarMarcas([
      card({ id: 1, brand: 'Growth', offerCount: 3 }),
      card({ id: 2, brand: 'Growth', offerCount: 4 }),
      card({ id: 3, brand: 'Dux', offerCount: 2 }),
    ])

    expect(marcas.map(m => [m.nome, m.produtos, m.ofertas])).toEqual([
      ['Growth', 2, 7],
      ['Dux', 1, 2],
    ])
  })

  it('junta a mesma marca escrita com acento e caixa diferentes', () => {
    const marcas = agregarMarcas([
      card({ id: 1, brand: 'Integralmédica', offerCount: 2 }),
      card({ id: 2, brand: 'integralmedica', offerCount: 3 }),
    ])

    expect(marcas).toHaveLength(1)
    expect(marcas[0].ofertas).toBe(5)
    // Mantém a grafia da primeira ocorrência, que é a que o catálogo declarou.
    expect(marcas[0].nome).toBe('Integralmédica')
  })

  it('produto sem marca não vira uma marca "Sem marca"', () => {
    const marcas = agregarMarcas([
      card({ id: 1, brand: null }),
      card({ id: 2, brand: '   ' }),
      card({ id: 3, brand: 'Growth' }),
    ])

    expect(marcas.map(m => m.nome)).toEqual(['Growth'])
  })

  it('marca sem oferta comprável não aparece', () => {
    const marcas = agregarMarcas([
      card({ id: 1, brand: 'Fantasma', offerCount: 0 }),
      card({ id: 2, brand: 'Growth', offerCount: 1 }),
    ])

    expect(marcas.map(m => m.nome)).toEqual(['Growth'])
  })

  it('catálogo vazio devolve lista vazia, não erro nem placeholder', () => {
    expect(agregarMarcas([])).toEqual([])
  })

  it('catálogo parcial: descarta o que não conta e ordena o resto', () => {
    // O estado real do banco em 04/09/2026: parte das linhas tem brand_id
    // nulo, parte dos produtos não tem oferta ativa, e o resto é o que a
    // faixa mostra.
    const marcas = agregarMarcas([
      card({ id: 1, brand: 'Growth', offerCount: 12 }),
      card({ id: 2, brand: 'Growth', offerCount: 8 }),
      card({ id: 3, brand: null, offerCount: 30 }),
      card({ id: 4, brand: 'Dux', offerCount: 0 }),
      card({ id: 5, brand: 'Dux', offerCount: 5 }),
      card({ id: 6, brand: 'Max Titanium', offerCount: 5 }),
      card({ id: 7, brand: 'Max Titanium', offerCount: 0 }),
    ])

    expect(marcas.map(m => [m.nome, m.produtos, m.ofertas])).toEqual([
      ['Growth', 2, 20],
      // Dux e Max Titanium empatam em 5 ofertas e 1 produto publicável;
      // desempate alfabético.
      ['Dux', 1, 5],
      ['Max Titanium', 1, 5],
    ])
  })
})

describe('ordenação', () => {
  it('põe primeiro quem tem mais ofertas ativas', () => {
    const ordenadas = ordenarMarcas([
      marca({ nome: 'Poucas', ofertas: 2 }),
      marca({ nome: 'Muitas', ofertas: 40 }),
      marca({ nome: 'Médias', ofertas: 9 }),
    ])
    expect(ordenadas.map(m => m.nome)).toEqual(['Muitas', 'Médias', 'Poucas'])
  })

  it('ofertas mandam mais que produtos quando os dois discordam', () => {
    /*
      O caso que faltava.

      Todos os outros testes de ordem tinham os dois critérios concordando, ou
      um deles constante — então a suíte passava igual com a ordem invertida.
      Descoberto na verificação de mutação: trocar `ofertas` por `produtos` como
      primeiro critério não era acusado por nenhum dos 19 testes.

      Aqui eles discordam de propósito: a marca com mais ofertas tem menos
      produtos. A faixa promete cobertura de oferta, então ela vem primeiro.
    */
    const ordenadas = ordenarMarcas([
      marca({ nome: 'MuitosProdutos', ofertas: 6, produtos: 9 }),
      marca({ nome: 'MuitasOfertas', ofertas: 30, produtos: 2 }),
    ])
    expect(ordenadas.map(m => m.nome)).toEqual(['MuitasOfertas', 'MuitosProdutos'])
  })

  it('desempata por número de produtos', () => {
    // Dez ofertas espalhadas em cinco produtos dizem mais sobre a cobertura da
    // marca do que dez ofertas de um produto só.
    const ordenadas = ordenarMarcas([
      marca({ nome: 'UmProduto', ofertas: 10, produtos: 1 }),
      marca({ nome: 'CincoProdutos', ofertas: 10, produtos: 5 }),
    ])
    expect(ordenadas.map(m => m.nome)).toEqual(['CincoProdutos', 'UmProduto'])
  })

  it('desempata por nome quando tudo mais empata', () => {
    const ordenadas = ordenarMarcas([
      marca({ nome: 'Zinco', ofertas: 5, produtos: 2 }),
      marca({ nome: 'Ácido', ofertas: 5, produtos: 2 }),
      marca({ nome: 'Beta', ofertas: 5, produtos: 2 }),
    ])
    expect(ordenadas.map(m => m.nome)).toEqual(['Ácido', 'Beta', 'Zinco'])
  })

  it('não depende da ordem em que o banco devolveu as linhas', () => {
    // Sem o terceiro critério, duas marcas idênticas em número trocariam de
    // lugar entre um deploy e outro sem nada ter mudado.
    const entrada = [
      marca({ nome: 'Alfa', ofertas: 5, produtos: 2 }),
      marca({ nome: 'Beta', ofertas: 5, produtos: 2 }),
    ]
    expect(ordenarMarcas(entrada)).toEqual(ordenarMarcas([...entrada].reverse()))
  })

  it('não altera o array recebido', () => {
    const entrada = [marca({ nome: 'B', ofertas: 1 }), marca({ nome: 'A', ofertas: 9 })]
    ordenarMarcas(entrada)
    expect(entrada.map(m => m.nome)).toEqual(['B', 'A'])
  })
})

describe('paleta', () => {
  it('o tom de uma marca é sempre o mesmo', () => {
    const uma = agregarMarcas([card({ brand: 'Max Titanium' })])[0]
    const outra = agregarMarcas([card({ brand: 'Max Titanium' })])[0]
    expect(uma.tom).toBe(outra.tom)
  })

  it('a grafia não muda o tom', () => {
    const comAcento = agregarMarcas([card({ brand: 'Integralmédica' })])[0]
    const sem = agregarMarcas([card({ brand: 'INTEGRALMEDICA' })])[0]
    expect(comAcento.tom).toBe(sem.tom)
  })

  it('todo tom aponta para um token da casa', () => {
    const nomes = ['Growth', 'Dux', 'Max Titanium', 'Integralmédica', 'Probiótica', 'FTW', 'Optimum']
    for (const nome of nomes) {
      const m = agregarMarcas([card({ brand: nome })])[0]
      expect(TONS_DE_MARCA).toContain(tomDaMarca(m))
    }
  })

  it('a paleta não contém cor de terceiro, só token da casa', () => {
    // A maquete pintava os cartões com a cor oficial de cada marca. Isso
    // insinua parceria que não existe. Se alguém acrescentar um valor de cor
    // aqui, este teste acusa.
    for (const tom of TONS_DE_MARCA) {
      expect(tom, `"${tom}" parece um valor de cor, não um nome de token`).not.toMatch(
        /#|oklch|rgb|hsl/,
      )
    }
  })
})

describe('slug', () => {
  it.each([
    ['Growth Supplements', 'growth-supplements'],
    ['Integralmédica', 'integralmedica'],
    ['Max  Titanium', 'max-titanium'],
    ['Probiótica!', 'probiotica'],
    ['  FTW  ', 'ftw'],
  ])('%s → %s', (nome, esperado) => {
    expect(slugDaMarca(nome)).toBe(esperado)
  })
})
