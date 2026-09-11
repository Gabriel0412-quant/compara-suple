import { describe, expect, it } from 'vitest'

import {
  agregarMarcas,
  descricaoDaOrdem,
  destaqueDaMarca,
  ordemDeMarcaValida,
  ordenarMarcas,
  ordenarMarcasPor,
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

function marca(over: Partial<Marca> = {}): Marca {
  return {
    nome: 'Growth',
    slug: 'growth',
    produtos: 1,
    ofertas: 1,
    menorPreco: 100,
    categorias: ['whey-protein'],
    tom: 0,
    ...over,
  }
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

  it('marcas diferentes recebem tons diferentes', () => {
    /*
      Achado pelo Stryker: esvaziar o laço de `hashEstavel` sobrevivia a todos
      os 21 testes. Com o laço vazio, o hash devolve a semente para qualquer
      nome — e a faixa inteira sairia da mesma cor, sem nada acusar. Os testes
      de estabilidade não pegam isso: uma cor só também é estável.
    */
    const nomes = ['Growth', 'Dux', 'Max Titanium', 'Integralmédica', 'Probiótica', 'FTW', 'Optimum', 'Black Skull']
    const tons = new Set(nomes.map(nome => agregarMarcas([card({ brand: nome })])[0].tom))
    expect(tons.size, 'todas as marcas caíram no mesmo tom').toBeGreaterThan(1)
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
    // Hífen cercado de espaço vira três hifens antes do colapso: sem o
    // `.replace(/-+/g, '-')` este caso sai "max---titanium".
    ['Max - Titanium', 'max-titanium'],
    // Hífen na borda: sem o `.replace(/^-|-$/g, '')` sai "-growth-".
    ['- Growth -', 'growth'],
    ['!!! Dux !!!', 'dux'],
  ])('%s → %s', (nome, esperado) => {
    expect(slugDaMarca(nome)).toBe(esperado)
  })
})

describe('menor preço da marca', () => {
  it('é o da oferta mais barata, entre todos os produtos', () => {
    const [marca] = agregarMarcas([
      card({ id: 1, brand: 'Growth', featuredPrice: 200, lowestPrice: 180 }),
      card({ id: 2, brand: 'Growth', featuredPrice: 90, lowestPrice: 84.5 }),
    ])
    expect(marca.menorPreco).toBe(84.5)
  })

  it('não depende da ordem em que os produtos chegam', () => {
    // `Math.min` trocado por `Math.max` passaria num catálogo onde o primeiro
    // produto já fosse o mais barato.
    const crescente = agregarMarcas([
      card({ id: 1, brand: 'Growth', featuredPrice: 90, lowestPrice: 84.5 }),
      card({ id: 2, brand: 'Growth', featuredPrice: 200, lowestPrice: 180 }),
    ])
    expect(crescente[0].menorPreco).toBe(84.5)
  })

  it('cai no preço destacado quando não há oferta mais barata registrada', () => {
    const [marca] = agregarMarcas([card({ brand: 'Growth', featuredPrice: 129.9, lowestPrice: null })])
    expect(marca.menorPreco).toBe(129.9)
  })
})

describe('categorias da marca', () => {
  it('junta as categorias dos produtos, sem repetir', () => {
    const [marca] = agregarMarcas([
      card({ id: 1, brand: 'Growth', name: 'Whey Protein Concentrado 1kg' }),
      card({ id: 2, brand: 'Growth', name: 'Whey Protein Isolado 900g' }),
      card({ id: 3, brand: 'Growth', name: 'Creatina Monohidratada 300g' }),
    ])
    expect(marca.categorias).toEqual(['whey-protein', 'creatina'])
  })

  it('o primeiro produto já traz a categoria dele', () => {
    // Com dois ou mais produtos, o ramo que cria a marca pode devolver lista
    // vazia que os seguintes preenchem, e ninguém nota.
    const [marca] = agregarMarcas([card({ brand: 'Growth', name: 'Whey Protein Concentrado 1kg' })])
    expect(marca.categorias).toEqual(['whey-protein'])
  })

  it('produto que não casa categoria nenhuma não inventa uma', () => {
    const [marca] = agregarMarcas([card({ brand: 'Growth', name: 'Suplemento sem palavra conhecida' })])
    expect(marca.categorias).toEqual([])
  })
})

describe('ordem escolhida na URL', () => {
  it('aceita as quatro que a página oferece', () => {
    expect(ordemDeMarcaValida('ofertas')).toBe('ofertas')
    expect(ordemDeMarcaValida('produtos')).toBe('produtos')
    expect(ordemDeMarcaValida('preco')).toBe('preco')
    expect(ordemDeMarcaValida('nome')).toBe('nome')
  })

  it('cai no padrão para valor inventado, ausente ou repetido', () => {
    expect(ordemDeMarcaValida('inventado')).toBe('ofertas')
    expect(ordemDeMarcaValida(undefined)).toBe('ofertas')
    // Chave repetida chega como array; não se adivinha qual vale.
    expect(ordemDeMarcaValida(['nome', 'preco'])).toBe('ofertas')
    /*
      E o array de um elemento é o caso que prova a guarda de tipo.

      `?ordem=nome&ordem=nome` chega como `['nome']`. Sem o `typeof`, o
      `'nome' in ORDENS_DE_MARCA` responde `true` — porque a chave é coagida
      para string — e a função devolveria o próprio array no lugar da ordem.
    */
    expect(ordemDeMarcaValida(['nome'])).toBe('ofertas')
  })
})

describe('ordenação por critério', () => {
  const integral = marca({ nome: 'Integralmédica', slug: 'i', produtos: 2, ofertas: 649, menorPreco: 36 })
  const growth = marca({ nome: 'Growth', slug: 'g', produtos: 5, ofertas: 71, menorPreco: 21.88 })
  const dark = marca({ nome: 'Dark Lab', slug: 'd', produtos: 1, ofertas: 3, menorPreco: 49.9 })

  /*
    Os três discordam entre si de propósito, com números de produção em
    10/09/2026: a Integralmédica lidera em ofertas, a Growth em produtos e é a
    mais barata, e a Dark Lab é a primeira em ordem alfabética. Fixture em que
    os quatro critérios coincidissem não provaria que cada um olha sua coluna.
  */
  const todas = [integral, growth, dark]

  it('por ofertas, que é o padrão', () => {
    expect(ordenarMarcasPor(todas, 'ofertas').map(m => m.slug)).toEqual(['i', 'g', 'd'])
  })

  it('por produtos', () => {
    expect(ordenarMarcasPor(todas, 'produtos').map(m => m.slug)).toEqual(['g', 'i', 'd'])
  })

  it('por preço, do menor para o maior', () => {
    expect(ordenarMarcasPor(todas, 'preco').map(m => m.slug)).toEqual(['g', 'i', 'd'])
  })

  it('por preço, e não por produtos disfarçado de preço', () => {
    /*
      Nas três de produção os dois critérios dão a mesma lista: a Growth é a
      que cobre mais produtos e também a mais barata. Com elas, trocar o ramo
      de `preco` pelo de `produtos` passa despercebido.

      Aqui a mais barata é a que cobre menos produtos, então as duas ordens
      são opostas e só uma delas pode estar certa.*/
    const barataECurta = marca({ nome: 'Barata', slug: 'b', produtos: 1, menorPreco: 10 })
    const caraELarga = marca({ nome: 'Cara', slug: 'c', produtos: 9, menorPreco: 20 })

    expect(ordenarMarcasPor([caraELarga, barataECurta], 'preco').map(m => m.slug)).toEqual(['b', 'c'])
    expect(ordenarMarcasPor([barataECurta, caraELarga], 'produtos').map(m => m.slug)).toEqual(['c', 'b'])
  })

  it('por nome, em pt-BR', () => {
    expect(ordenarMarcasPor(todas, 'nome').map(m => m.slug)).toEqual(['d', 'g', 'i'])
  })

  it('não altera o array recebido', () => {
    const entrada = [...todas]
    ordenarMarcasPor(entrada, 'nome')
    expect(entrada.map(m => m.slug)).toEqual(['i', 'g', 'd'])
  })

  it('marca sem preço vai para o fim, contra a ordem alfabética', () => {
    /*
      A sem preço se chama "Alfa" de propósito.

      Com ela chamada "Zeta", o nome e a regra concordam: ela vai para o fim
      dos dois jeitos, e trocar o `&&` por `||` — ou mandar o par inteiro para
      o desempate por nome — passa sem ninguém notar. Chamando-se "Alfa", a
      ordem alfabética a puxa para o começo e só a regra do nulo a segura.
    */
    const semPreco = marca({ nome: 'Alfa', slug: 'a', menorPreco: null })
    const comPreco = marca({ nome: 'Zeta', slug: 'z', menorPreco: 21.88 })

    expect(ordenarMarcasPor([semPreco, comPreco], 'preco').map(m => m.slug)).toEqual(['z', 'a'])
    // E dos dois lados, senão o comparador só está certo por acaso da ordem.
    expect(ordenarMarcasPor([comPreco, semPreco], 'preco').map(m => m.slug)).toEqual(['z', 'a'])
  })

  it('duas sem preço desempatam pelo nome', () => {
    const zeta = marca({ nome: 'Zeta', slug: 'z', menorPreco: null })
    const alfa = marca({ nome: 'Alfa', slug: 'a', menorPreco: null })
    expect(ordenarMarcasPor([zeta, alfa], 'preco').map(m => m.slug)).toEqual(['a', 'z'])
  })

  it('preço empatado desempata pelo nome', () => {
    const zeta = marca({ nome: 'Zeta', slug: 'z', menorPreco: 50 })
    const alfa = marca({ nome: 'Alfa', slug: 'a', menorPreco: 50 })
    expect(ordenarMarcasPor([zeta, alfa], 'preco').map(m => m.slug)).toEqual(['a', 'z'])
  })

  it('produtos empatados desempatam por ofertas, e depois pelo nome', () => {
    const muitas = marca({ nome: 'Zeta', slug: 'z', produtos: 3, ofertas: 90 })
    const poucas = marca({ nome: 'Alfa', slug: 'a', produtos: 3, ofertas: 10 })
    expect(ordenarMarcasPor([poucas, muitas], 'produtos').map(m => m.slug)).toEqual(['z', 'a'])

    const iguais = [
      marca({ nome: 'Zeta', slug: 'z', produtos: 3, ofertas: 10 }),
      marca({ nome: 'Alfa', slug: 'a', produtos: 3, ofertas: 10 }),
    ]
    expect(ordenarMarcasPor(iguais, 'produtos').map(m => m.slug)).toEqual(['a', 'z'])
  })
})

describe('a página descreve a própria ordem', () => {
  it('cada ordem tem sua frase', () => {
    expect(descricaoDaOrdem('produtos')).toBe('da que cobre mais produtos para a que cobre menos')
    expect(descricaoDaOrdem('preco')).toBe('do menor preço de entrada para o maior')
    expect(descricaoDaOrdem('nome')).toBe('em ordem alfabética')
  })

  it('a frase do padrão é a que a home deixou de dizer no #205', () => {
    // `e2e/marcas.spec.ts` cobra este texto em `/marcas` porque o recorte da
    // faixa da home depende dele. Trocar a frase aqui quebra lá, de propósito.
    expect(descricaoDaOrdem('ofertas')).toBe('da que tem mais ofertas para a que tem menos')
  })
})

describe('selo do cartão', () => {
  const integral = marca({ nome: 'Integralmédica', slug: 'i', produtos: 2, ofertas: 649 })
  const growth = marca({ nome: 'Growth', slug: 'g', produtos: 5, ofertas: 71, categorias: ['whey-protein', 'creatina'] })
  const dark = marca({ nome: 'Dark Lab', slug: 'd', produtos: 1, ofertas: 3, categorias: ['creatina'] })
  const soldiers = marca({ nome: 'Soldiers', slug: 's', produtos: 4, ofertas: 83, categorias: ['whey-protein', 'creatina', 'pre-treino'] })
  const todas = [integral, growth, dark, soldiers]

  it('quem lidera em ofertas', () => {
    expect(destaqueDaMarca(integral, todas)).toBe('1º em ofertas')
  })

  it('quem cobre mais produtos, quando não é a mesma', () => {
    expect(destaqueDaMarca(growth, todas)).toBe('Mais produtos')
  })

  it('a categoria, quando a marca tem exatamente uma', () => {
    expect(destaqueDaMarca(dark, todas)).toBe('Creatina')
  })

  it('nada, quando a marca cobre mais de uma categoria', () => {
    expect(destaqueDaMarca(soldiers, todas)).toBeNull()
  })

  it('nada, quando a marca não casa categoria nenhuma', () => {
    const sem = marca({ nome: 'Sem', slug: 'x', produtos: 1, ofertas: 1, categorias: [] })
    expect(destaqueDaMarca(sem, [integral, growth, sem])).toBeNull()
  })

  it('nada, quando a categoria não existe no dicionário', () => {
    const fantasma = marca({ nome: 'Fantasma', slug: 'f', produtos: 1, ofertas: 1, categorias: ['inexistente'] })
    expect(destaqueDaMarca(fantasma, [integral, growth, fantasma])).toBeNull()
  })

  it('empate em produtos fica com o primeiro, não com o último', () => {
    /*
      `>` e `>=` só se distinguem no empate, e a `reduce` guarda o acumulado:
      com `>` fica o primeiro empatado, com `>=` fica o último. Sem duas marcas
      com o mesmo número de produtos, os dois operadores dão a mesma lista.
    */
    const lider = marca({ nome: 'Líder', slug: 'l', produtos: 1, ofertas: 900 })
    const primeira = marca({ nome: 'Primeira', slug: 'p', produtos: 5, ofertas: 80, categorias: [] })
    const segunda = marca({ nome: 'Segunda', slug: 'x', produtos: 5, ofertas: 70, categorias: [] })
    const empatadas = [lider, primeira, segunda]

    expect(destaqueDaMarca(primeira, empatadas)).toBe('Mais produtos')
    expect(destaqueDaMarca(segunda, empatadas)).toBeNull()
  })

  it('sem lista não há selo', () => {
    expect(destaqueDaMarca(integral, [])).toBeNull()
  })

  it('o líder em ofertas ganha o selo mesmo se também cobrir mais produtos', () => {
    // Só um selo por cartão, e o de ofertas vem primeiro: é o critério com que
    // a página abre.
    const unica = marca({ nome: 'Única', slug: 'u', produtos: 9, ofertas: 900, categorias: ['creatina'] })
    expect(destaqueDaMarca(unica, [unica, dark])).toBe('1º em ofertas')
  })

  it('não depende da ordem em que a lista chega', () => {
    // `marcas[0]` em vez de reordenar passaria numa lista já ordenada.
    expect(destaqueDaMarca(integral, [dark, growth, integral, soldiers])).toBe('1º em ofertas')
  })
})
