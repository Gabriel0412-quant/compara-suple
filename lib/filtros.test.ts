import { describe, expect, it } from 'vitest'

import {
  FILTROS_VAZIOS,
  ORDENS,
  slugDoProduto,
  aplicarFiltros,
  buscaPorMarca,
  chipsDeFiltro,
  facetasDeCategoria,
  facetasDeMarca,
  facetasDeSabor,
  ordenar,
  parseFiltros,
  semFiltro,
  serializarFiltros,
  temPromocao,
  type Filtros,
} from './filtros'
import type { CategoryProduct } from './categories'

/**
 * As regras da página de busca.
 *
 * A tela é grande, mas o que pode mentir aqui é pequeno e bem delimitado: o
 * que a URL vira, o que cada filtro deixa passar, quanto cada faceta diz que
 * existe, e onde vai parar o produto sem dose informada.
 */

let proximo = 1
function produto(over: Partial<CategoryProduct> = {}): CategoryProduct {
  const id = proximo++
  return {
    id,
    slug: `p-${id}`,
    name: 'Whey Protein Concentrado',
    brand: 'Growth Supplements',
    thumbnail: null,
    flavor: null,
    offerCount: 3,
    featuredPrice: 100,
    featuredOriginalPrice: null,
    lowestPrice: null,
    lowestOfferId: null,
    featuredOfferId: id,
    servings: 30,
    sizeGrams: 900,
    featuredPerDose: 3,
    ...over,
  }
}

const f = (over: Partial<Filtros> = {}): Filtros => ({ ...FILTROS_VAZIOS, ...over })

describe('leitura da URL', () => {
  it('lê os filtros que a página escreve', () => {
    expect(
      parseFiltros({
        q: 'whey',
        categoria: 'creatina',
        marca: 'Growth Supplements',
        sabor: 'chocolate',
        promocao: '1',
        preco_max: '150',
        dose_max: '2,5',
        ordem: 'dose',
      }),
    ).toEqual({
      termo: 'whey',
      categoria: 'creatina',
      marca: 'growth-supplements',
      sabor: 'chocolate',
      soPromocao: true,
      precoMax: 150,
      dosePrecoMax: 2.5,
      ordem: 'dose',
    })
  })

  it('família de sabor desconhecida vira ausência', () => {
    expect(parseFiltros({ sabor: 'tutti-frutti' }).sabor).toBeNull()
    expect(parseFiltros({ sabor: 'chocolate' }).sabor).toBe('chocolate')
  })

  it('categoria desconhecida vira ausência, não resultado vazio', () => {
    /*
      Link velho ou slug renomeado não pode produzir uma tela sem nada, que
      parece bug. `?categoria=inventada` mostra o catálogo inteiro.
    */
    expect(parseFiltros({ categoria: 'inventada' }).categoria).toBeNull()
    expect(parseFiltros({ categoria: 'whey-protein' }).categoria).toBe('whey-protein')
  })

  it('ordem desconhecida cai em relevância', () => {
    expect(parseFiltros({ ordem: 'preco' }).ordem).toBe('preco')
    expect(parseFiltros({ ordem: 'aleatoria' }).ordem).toBe('relevancia')
  })

  it('só promocao=1 liga o filtro', () => {
    // O caso que discrimina: um `if (params.promocao)` ligaria em todos estes.
    for (const valor of ['0', '', 'true', 'sim']) {
      expect(parseFiltros({ promocao: valor }).soPromocao, `promocao=${valor}`).toBe(false)
    }
    expect(parseFiltros({ promocao: '1' }).soPromocao).toBe(true)
  })

  it('teto não positivo é ausência de teto, não teto zero', () => {
    // `Number('')` é 0, e um teto de zero esconderia o catálogo em silêncio.
    for (const valor of ['', '0', '-5', 'abc']) {
      expect(parseFiltros({ preco_max: valor }).precoMax, `preco_max=${valor}`).toBeNull()
    }
    expect(parseFiltros({ preco_max: '80' }).precoMax).toBe(80)
  })

  it('parâmetro repetido usa o primeiro, como o Next entrega', () => {
    expect(parseFiltros({ q: ['whey', 'creatina'] }).termo).toBe('whey')
  })

  it('parâmetro ausente ou só com espaço é ausência', () => {
    // `?q=%20%20` não pode virar uma busca por espaço, que não casa com nada.
    expect(parseFiltros({}).termo).toBe('')
    expect(parseFiltros({ q: '   ' }).termo).toBe('')
    expect(parseFiltros({ q: '  whey  ' }).termo).toBe('whey')
  })

  it('sem marca na URL, o filtro de marca é nulo e não string vazia', () => {
    // Sem a guarda, `slugDaMarca('')` devolveria `''`, que é diferente de
    // `null` e faria a tela achar que há uma marca escolhida.
    expect(parseFiltros({}).marca).toBeNull()
    expect(parseFiltros({ marca: '' }).marca).toBeNull()
  })
})

describe('as opções de ordenação', () => {
  it('declara as três, com R$/dose antes de preço', () => {
    /*
      A ordem da lista é a ordem que aparece no seletor, e ela declara o que o
      site acha que importa: a tese é custo por dose, não preço de etiqueta.
    */
    expect(ORDENS).toEqual([
      { valor: 'relevancia', rotulo: 'Relevância' },
      { valor: 'dose', rotulo: 'Menor R$/dose' },
      { valor: 'preco', rotulo: 'Menor preço' },
    ])
  })
})

describe('escrita da URL', () => {
  it('omite tudo que está no padrão', () => {
    expect(serializarFiltros(FILTROS_VAZIOS)).toBe('/produtos')
    expect(serializarFiltros(f({ ordem: 'relevancia' }))).toBe('/produtos')
  })

  it('ida e volta preserva o estado', () => {
    const original = f({
      termo: 'whey',
      categoria: 'creatina',
      marca: 'max-titanium',
      sabor: 'morango',
      soPromocao: true,
      precoMax: 150,
      dosePrecoMax: 2.5,
      ordem: 'preco',
    })
    const url = new URL(serializarFiltros(original), 'http://x')
    expect(parseFiltros(Object.fromEntries(url.searchParams))).toEqual(original)
  })
})

describe('link para a busca por marca', () => {
  it('leva ao filtro de marca, e não à busca por texto', () => {
    /*
      A faixa de marcas da home e o índice `/marcas` usam esta função em vez de
      montar a string. Montar à mão dá um segundo lugar para o nome do
      parâmetro divergir de `parseFiltros`, e componente não é alcançado pela
      mutação — o serializador é.
    */
    expect(buscaPorMarca('growth-supplements')).toBe('/produtos?marca=growth-supplements')
  })

  it('a ida e volta bate com o que o parser lê', () => {
    const url = new URL(buscaPorMarca('max-titanium'), 'http://x')
    expect(parseFiltros(Object.fromEntries(url.searchParams)).marca).toBe('max-titanium')
  })

  it('não carrega filtro nenhum além da marca', () => {
    // O cartão promete "produtos desta marca", não "desta marca com o filtro
    // que estava valendo antes".
    expect(new URL(buscaPorMarca('growth-supplements'), 'http://x').searchParams.size).toBe(1)
  })
})

describe('cada filtro', () => {
  const catalogo = [
    produto({ name: 'Whey Protein Concentrado', brand: 'Growth Supplements', featuredPrice: 100, featuredPerDose: 3 }),
    produto({ name: 'Creatina Monohidratada', brand: 'Max Titanium', featuredPrice: 60, featuredPerDose: 1 }),
    produto({ name: 'Pré-treino Insano', brand: 'Growth Supplements', featuredPrice: 200, featuredPerDose: null }),
    produto({ name: 'Whey Isolado', brand: 'Max Titanium', featuredPrice: 150, featuredOriginalPrice: 300, featuredPerDose: 5 }),
  ]
  const nomes = (l: CategoryProduct[]) => l.map(p => p.name).sort()

  it('categoria filtra pelo nome do produto', () => {
    expect(nomes(aplicarFiltros(catalogo, f({ categoria: 'whey-protein' })))).toEqual([
      'Whey Isolado',
      'Whey Protein Concentrado',
    ])
  })

  it('marca casa pelo slug, não pela string crua', () => {
    expect(nomes(aplicarFiltros(catalogo, f({ marca: 'max-titanium' })))).toEqual([
      'Creatina Monohidratada',
      'Whey Isolado',
    ])
  })

  it('promoção exige preço anterior maior que o atual', () => {
    expect(nomes(aplicarFiltros(catalogo, f({ soPromocao: true })))).toEqual(['Whey Isolado'])
    // Anterior igual ou menor não é promoção — seria desconto negativo.
    expect(temPromocao(produto({ featuredPrice: 100, featuredOriginalPrice: 100 }))).toBe(false)
    expect(temPromocao(produto({ featuredPrice: 100, featuredOriginalPrice: 90 }))).toBe(false)
  })

  it('teto de preço inclui o valor exato do teto', () => {
    expect(nomes(aplicarFiltros(catalogo, f({ precoMax: 100 })))).toEqual([
      'Creatina Monohidratada',
      'Whey Protein Concentrado',
    ])
  })

  /*
    A assimetria que mais importa, e a que mais parece bug se estiver errada.

    O teto de preço não julga quem não tem preço, porque todo produto tem. O
    teto de dose precisa julgar: quem pede "até R$ 3 por dose" está comparando
    por dose, e produto sem dose informada não pode ser afirmado como dentro do
    teto. O "Pré-treino Insano" tem `featuredPerDose: null` e custa R$ 200 —
    se a regra fosse a mesma do preço, ele apareceria num filtro de dose barata.
  */
  it('teto de dose exclui produto sem dose informada', () => {
    expect(nomes(aplicarFiltros(catalogo, f({ dosePrecoMax: 3 })))).toEqual([
      'Creatina Monohidratada',
      'Whey Protein Concentrado',
    ])
    expect(nomes(aplicarFiltros(catalogo, f({ dosePrecoMax: 99 })))).not.toContain('Pré-treino Insano')
  })

  it('marca só com espaço em branco não é marca', () => {
    // `brand` vem do banco e já apareceu como string vazia. Sem o `trim`,
    // ela viraria uma marca de slug vazio, que casa com "sem marca".
    expect(slugDoProduto(produto({ brand: '   ' }))).toBeNull()
    expect(slugDoProduto(produto({ brand: null }))).toBeNull()
    expect(slugDoProduto(produto({ brand: '  Growth Supplements  ' }))).toBe('growth-supplements')
  })

  it('promoção exige preço anterior, e ausência não é promoção', () => {
    expect(temPromocao(produto({ featuredOriginalPrice: null }))).toBe(false)
    expect(temPromocao(produto({ featuredPrice: 100, featuredOriginalPrice: 150 }))).toBe(true)
  })

  /*
    O caso que separa "casa por família" de "casa por string".

    "Milkshake de chocolate" e "Chocolate" são dois textos diferentes vindos de
    dois anúncios. Um filtro que comparasse string devolveria só um deles, e a
    pessoa que clicou em "Chocolate (2)" veria um produto.
  */
  it('sabor casa por família, não pelo texto do anúncio', () => {
    const comSabor = [
      produto({ name: 'Whey A', flavor: 'Chocolate' }),
      produto({ name: 'Whey B', flavor: 'Milkshake de chocolate' }),
      produto({ name: 'Whey C', flavor: 'Morango' }),
      produto({ name: 'Creatina D', flavor: 'Sem sabor' }),
      produto({ name: 'Creatina E', flavor: 'Natural' }),
    ]
    expect(nomes(aplicarFiltros(comSabor, f({ sabor: 'chocolate' })))).toEqual(['Whey A', 'Whey B'])
    expect(nomes(aplicarFiltros(comSabor, f({ sabor: 'sem-sabor' })))).toEqual([
      'Creatina D',
      'Creatina E',
    ])
  })

  it('sabor fora de qualquer família some quando alguém filtra', () => {
    // Não dá para afirmar que é chocolate quem o catálogo não diz que é. Sem
    // filtro de sabor ativo, ele continua aparecendo.
    const exotico = [produto({ name: 'Whey Tutti-frutti', flavor: 'Tutti-frutti' })]
    expect(nomes(aplicarFiltros(exotico, f()))).toEqual(['Whey Tutti-frutti'])
    expect(aplicarFiltros(exotico, f({ sabor: 'chocolate' }))).toEqual([])
  })

  it('produto sem sabor informado não é "sem sabor"', () => {
    /*
      `flavor: null` é ausência de dado; "Sem sabor" é uma afirmação do
      anúncio. Confundir os dois colocaria no filtro de "Sem sabor" todo
      produto cujo sabor ninguém preencheu.
    */
    const semDado = [produto({ name: 'Sem dado', flavor: null })]
    expect(aplicarFiltros(semDado, f({ sabor: 'sem-sabor' }))).toEqual([])
  })

  it('os filtros se acumulam', () => {
    expect(
      nomes(aplicarFiltros(catalogo, f({ categoria: 'whey-protein', marca: 'max-titanium' }))),
    ).toEqual(['Whey Isolado'])
  })

  it('termo casa nome e marca, ignorando acento e caixa', () => {
    expect(nomes(aplicarFiltros(catalogo, f({ termo: 'GROWTH' })))).toEqual([
      'Pré-treino Insano',
      'Whey Protein Concentrado',
    ])
    expect(nomes(aplicarFiltros(catalogo, f({ termo: 'pre-treino' })))).toEqual(['Pré-treino Insano'])
  })
})

describe('ordenação', () => {
  const semDose = produto({ name: 'Sem dose', featuredPerDose: null, featuredPrice: 10 })
  const barato = produto({ name: 'Barato por dose', featuredPerDose: 1, featuredPrice: 300 })
  const caro = produto({ name: 'Caro por dose', featuredPerDose: 9, featuredPrice: 20 })
  const lista = [semDose, caro, barato]

  it('por dose, o mais barato primeiro', () => {
    expect(ordenar(lista, 'dose').map(p => p.name)[0]).toBe('Barato por dose')
  })

  /*
    O caso que a comparação ingênua erra.

    `null - 9` é `-9` em JavaScript, então `a.featuredPerDose - b.featuredPerDose`
    coloca quem não tem dose em primeiro lugar — anunciando como o mais barato
    por dose do catálogo exatamente quem não tem o dado.
  */
  it('sem dose informada vai para o fim, nunca para o começo', () => {
    expect(ordenar(lista, 'dose').map(p => p.name)).toEqual([
      'Barato por dose',
      'Caro por dose',
      'Sem dose',
    ])
  })

  it('por preço, a fileira inteira em ordem crescente', () => {
    // A ordem toda, e não só o primeiro: com `+` no lugar de `-`, o primeiro
    // pode continuar certo por acaso enquanto o resto embaralha.
    expect(ordenar(lista, 'preco').map(p => p.name)).toEqual([
      'Sem dose',
      'Caro por dose',
      'Barato por dose',
    ])
  })

  it('preços iguais desempatam por nome, não pela ordem do banco', () => {
    const zebra = produto({ name: 'Zebra', featuredPrice: 50, featuredPerDose: 2 })
    const alfa = produto({ name: 'Alfa', featuredPrice: 50, featuredPerDose: 2 })
    expect(ordenar([zebra, alfa], 'preco').map(p => p.name)).toEqual(['Alfa', 'Zebra'])
    expect(ordenar([zebra, alfa], 'dose').map(p => p.name)).toEqual(['Alfa', 'Zebra'])
  })

  it('nulos e não-nulos ordenam certo em qualquer ordem de entrada', () => {
    /*
      A fixture é escolhida, não inventada.

      Quatro variações da comparação — ignorar o ramo dos dois nulos nos dois
      sentidos, ignorar o ramo do primeiro nulo, ignorar o do segundo —
      produzem a mesma saída na maioria das entradas, e passariam por um teste
      montado no chute. Precisa de três nulos, dois valores e esta ordem de
      entrada para as cinco saídas serem distintas:

        correto           Delta | Eco | Alfa | Bravo | Charlie
        sem o ramo duplo  Alfa | Bravo | Charlie | Delta | Eco
        ramo duplo falso  Delta | Eco | Alfa | Charlie | Bravo
        sem o 1º nulo     Bravo | Charlie | Delta | Eco | Alfa
        sem o 2º nulo     Eco | Delta | Alfa | Bravo | Charlie

      Achei a ordem varrendo as permutações, não olhando. O ponto é que quem
      não tem dose informada nunca pode aparecer entre os mais baratos por
      dose, e a estabilidade entre os sem-dose evita a fileira trocar de
      posição entre dois carregamentos.
    */
    const entrada = [
      produto({ name: 'Alfa', featuredPerDose: null }),
      produto({ name: 'Delta', featuredPerDose: 1 }),
      produto({ name: 'Eco', featuredPerDose: 9 }),
      produto({ name: 'Charlie', featuredPerDose: null }),
      produto({ name: 'Bravo', featuredPerDose: null }),
    ]
    expect(ordenar(entrada, 'dose').map(p => p.name)).toEqual([
      'Delta',
      'Eco',
      'Alfa',
      'Bravo',
      'Charlie',
    ])
  })

  it('relevância mantém a ordem que o catálogo trouxe', () => {
    /*
      Restaurado depois de a mutação acusar.

      Eu apaguei este teste sem querer ao reescrever o bloco, e o mutante que
      força o ramo de dose passou a sobreviver — porque ninguém mais afirmava
      que "relevância" não reordena. A ordem aqui difere da de dose e da de
      preço de propósito: se relevância caísse em qualquer um dos dois ramos,
      esta asserção falharia.
    */
    expect(ordenar(lista, 'relevancia').map(p => p.name)).toEqual([
      'Sem dose',
      'Caro por dose',
      'Barato por dose',
    ])
  })

  it('não altera o array recebido', () => {
    const entrada = [...lista]
    ordenar(entrada, 'dose')
    ordenar(entrada, 'preco')
    expect(entrada.map(p => p.name)).toEqual(lista.map(p => p.name))
  })
})

describe('contagem das facetas', () => {
  const catalogo = [
    produto({ name: 'Whey A', brand: 'Growth Supplements' }),
    produto({ name: 'Whey B', brand: 'Max Titanium' }),
    produto({ name: 'Creatina C', brand: 'Growth Supplements' }),
  ]

  /*
    O erro clássico de faceta, e o motivo de `aplicarFiltros` aceitar `exceto`.

    Com "Whey Protein" marcado, contar as categorias com o filtro de categoria
    aplicado daria Creatina = 0, e a lista viraria uma opção marcada cercada de
    zeros — impossível trocar de categoria sem limpar antes. O que a pessoa
    precisa saber é quantos produtos apareceriam ao trocar.
  */
  it('a categoria não conta a si mesma, mas conta os outros filtros', () => {
    const facetas = facetasDeCategoria(catalogo, f({ categoria: 'whey-protein' }))
    expect(facetas).toEqual([
      { valor: 'whey-protein', rotulo: 'Whey Protein', n: 2 },
      { valor: 'creatina', rotulo: 'Creatina', n: 1 },
    ])
  })

  it('a categoria respeita o filtro de marca', () => {
    const facetas = facetasDeCategoria(catalogo, f({ marca: 'growth-supplements' }))
    // Growth tem um whey e uma creatina; Max Titanium não entra na conta.
    expect(facetas).toEqual([
      { valor: 'creatina', rotulo: 'Creatina', n: 1 },
      { valor: 'whey-protein', rotulo: 'Whey Protein', n: 1 },
    ])
  })

  it('a marca não conta a si mesma, mas conta a categoria', () => {
    const facetas = facetasDeMarca(catalogo, f({ marca: 'growth-supplements', categoria: 'whey-protein' }))
    expect(facetas).toEqual([
      { valor: 'growth-supplements', rotulo: 'Growth Supplements', n: 1 },
      { valor: 'max-titanium', rotulo: 'Max Titanium', n: 1 },
    ])
  })

  it('produto sem marca não vira uma faceta "sem marca"', () => {
    expect(facetasDeMarca([produto({ brand: null })], f())).toEqual([])
  })

  it('a mesma marca soma em vez de recomeçar do um', () => {
    // Com o incremento quebrado, toda faceta terminaria com n = 1 e a lista
    // pareceria um catálogo de um produto por marca.
    const tres = [
      produto({ name: 'Whey A', brand: 'Growth Supplements' }),
      produto({ name: 'Whey B', brand: 'Growth Supplements' }),
      produto({ name: 'Whey C', brand: 'Growth Supplements' }),
    ]
    expect(facetasDeMarca(tres, f())).toEqual([
      { valor: 'growth-supplements', rotulo: 'Growth Supplements', n: 3 },
    ])
  })

  it('o rótulo da marca vem sem o espaço que o banco trouxe', () => {
    expect(facetasDeMarca([produto({ brand: '  Max Titanium  ' })], f())[0].rotulo).toBe(
      'Max Titanium',
    )
  })

  it('produto que não casa com categoria nenhuma não vira faceta', () => {
    // O catálogo tem nome que não bate com nenhuma palavra-chave. Sem a
    // guarda, ele viraria uma faceta de rótulo indefinido.
    const soltos = [produto({ name: 'Camiseta Regata de Treino', brand: 'Growth Supplements' })]
    expect(facetasDeCategoria(soltos, f())).toEqual([])
  })

  it('o sabor conta por família, somando os rótulos que dizem a mesma coisa', () => {
    const comSabor = [
      produto({ name: 'Whey A', flavor: 'Chocolate' }),
      produto({ name: 'Whey B', flavor: 'Milkshake de chocolate' }),
      produto({ name: 'Creatina C', flavor: 'Natural' }),
      produto({ name: 'Creatina D', flavor: 'Neutro' }),
      produto({ name: 'Creatina E', flavor: 'Sem sabor' }),
      produto({ name: 'Whey F', flavor: 'Tutti-frutti' }),
      produto({ name: 'Whey G', flavor: null }),
    ]
    /*
      Cinco produtos em duas famílias, e dois de fora: o exótico e o sem dado.
      Sem o agrupamento, isto seria uma lista de cinco linhas com n = 1.

      A ordem é a de `SABORES`, não a da contagem — "Sem sabor" tem 3 e vem
      depois de "Chocolate", que tem 2, porque sabor é lista curta e estável e
      quem já sabe onde uma opção fica não deve perdê-la de lugar a cada coleta.
    */
    expect(facetasDeSabor(comSabor, f())).toEqual([
      { valor: 'sem-sabor', rotulo: 'Sem sabor', n: 3 },
      { valor: 'chocolate', rotulo: 'Chocolate', n: 2 },
    ])
  })

  it('o sabor não conta a si mesmo, mas conta os outros filtros', () => {
    const comSabor = [
      produto({ name: 'Whey A', flavor: 'Chocolate', brand: 'Growth Supplements' }),
      produto({ name: 'Whey B', flavor: 'Morango', brand: 'Growth Supplements' }),
      produto({ name: 'Whey C', flavor: 'Morango', brand: 'Max Titanium' }),
    ]
    expect(
      facetasDeSabor(comSabor, f({ sabor: 'chocolate', marca: 'growth-supplements' })),
    ).toEqual([
      { valor: 'chocolate', rotulo: 'Chocolate', n: 1 },
      { valor: 'morango', rotulo: 'Morango', n: 1 },
    ])
  })

  it('família sem nenhum produto não aparece na lista', () => {
    // Opção que devolve zero é convite a um clique que esvazia a tela.
    const so = [produto({ flavor: 'Chocolate' })]
    expect(facetasDeSabor(so, f()).map(s => s.valor)).toEqual(['chocolate'])
  })

  it('a maior contagem vem primeiro, com desempate por nome', () => {
    const empate = [
      produto({ name: 'Whey A', brand: 'Zebra' }),
      produto({ name: 'Whey B', brand: 'Alfa' }),
    ]
    expect(facetasDeMarca(empate, f()).map(m => m.rotulo)).toEqual(['Alfa', 'Zebra'])
  })
})

describe('chips de filtro ativo', () => {
  const COMPLETO = f({
    termo: 'whey',
    categoria: 'creatina',
    marca: 'max-titanium',
    sabor: 'chocolate',
    soPromocao: true,
    precoMax: 150,
    dosePrecoMax: 2.5,
  })

  /*
    O `href` de cada chip é a promessa de que ele tira só o próprio filtro.

    Quebrar isso não muda o rótulo nem a quantidade de chips: a tela continua
    igual, e o clique é que deixa de fazer o que diz. Por isso a asserção é
    sobre a URL de cada um, campo a campo — o que sai voltou ao padrão, e o
    que fica está intacto.
  */
  it.each([
    ['q', '"whey"'],
    ['categoria', 'Creatina'],
    ['marca', 'max-titanium'],
    ['sabor', 'Chocolate'],
    ['promocao', 'Só em promoção'],
    ['preco_max', 'Até R$ 150'],
    ['dose_max', 'Até R$ 2.5/dose'],
  ])('o chip %s some da URL e não leva os outros junto', (param, rotulo) => {
    const chip = chipsDeFiltro(COMPLETO, []).find(c => c.rotulo === rotulo)
    expect(chip, `não há chip com o rótulo ${rotulo}`).toBeDefined()

    const restante = parseFiltros(
      Object.fromEntries(new URL(chip!.href, 'http://x').searchParams),
    )
    const todos = Object.fromEntries(
      new URL(serializarFiltros(COMPLETO), 'http://x').searchParams,
    )
    expect(Object.keys(todos)).toContain(param)

    const esperado = parseFiltros(
      Object.fromEntries(Object.entries(todos).filter(([k]) => k !== param)),
    )
    expect(restante).toEqual(esperado)
  })

  it('cada chip remove só o próprio filtro', () => {
    const filtros = f({ termo: 'whey', categoria: 'creatina', soPromocao: true })
    const chips = chipsDeFiltro(filtros, [])

    const daCategoria = chips.find(c => c.rotulo === 'Creatina')!
    const url = new URL(daCategoria.href, 'http://x')
    // Tirar a categoria não pode levar o termo e a promoção junto.
    expect(url.searchParams.get('categoria')).toBeNull()
    expect(url.searchParams.get('q')).toBe('whey')
    expect(url.searchParams.get('promocao')).toBe('1')
  })

  it('a marca aparece com o nome do banco, não com o slug', () => {
    // Duas facetas, e a certa não é a primeira: com a busca quebrada, o chip
    // exibiria "Growth Supplements" para um filtro de Integralmédica.
    const chips = chipsDeFiltro(f({ marca: 'integralmedica' }), [
      { valor: 'growth-supplements', rotulo: 'Growth Supplements', n: 9 },
      { valor: 'integralmedica', rotulo: 'Integralmédica', n: 3 },
    ])
    expect(chips[0].rotulo).toBe('Integralmédica')
  })

  it('cada filtro ativo tem seu rótulo, e nenhum sobra', () => {
    const chips = chipsDeFiltro(
      f({
        termo: 'whey',
        categoria: 'creatina',
        sabor: 'chocolate',
        soPromocao: true,
        precoMax: 150,
        dosePrecoMax: 2.5,
      }),
      [],
    )
    expect(chips.map(c => c.rotulo)).toEqual([
      '"whey"',
      'Creatina',
      'Chocolate',
      'Só em promoção',
      'Até R$ 150',
      'Até R$ 2.5/dose',
    ])
  })

  it('sabor sem rótulo conhecido cai no valor em vez de sumir', () => {
    expect(chipsDeFiltro(f({ sabor: 'inventado' }), [])[0].rotulo).toBe('inventado')
  })

  it('categoria sem rótulo conhecido cai no slug em vez de sumir', () => {
    // `parseFiltros` barra slug inválido, mas o tipo permite montar o estado à
    // mão — e um chip sem rótulo seria um X flutuando sem texto.
    expect(chipsDeFiltro(f({ categoria: 'categoria-que-nao-existe' }), [])[0].rotulo).toBe(
      'categoria-que-nao-existe',
    )
  })

  it('sem a faceta, o chip cai no slug em vez de sumir', () => {
    expect(chipsDeFiltro(f({ marca: 'integralmedica' }), [])[0].rotulo).toBe('integralmedica')
  })

  it('ordenação não é filtro e não vira chip', () => {
    expect(chipsDeFiltro(f({ ordem: 'dose' }), [])).toEqual([])
    expect(semFiltro(f({ ordem: 'dose' }))).toBe(true)
  })

  it.each([
    ['termo', { termo: 'whey' }],
    ['categoria', { categoria: 'creatina' }],
    ['marca', { marca: 'max-titanium' }],
    ['sabor', { sabor: 'chocolate' }],
    ['promoção', { soPromocao: true }],
    ['preço', { precoMax: 150 }],
    ['dose', { dosePrecoMax: 2.5 }],
  ] as const)('%s sozinho já basta para a tela não estar limpa', (_nome, mudanca) => {
    // Campo a campo: `semFiltro` decide se a tela mostra "Limpar" e se o
    // texto diz "todos os produtos" ou "N resultados". Esquecer um campo faz
    // a tela afirmar que não há filtro enquanto há.
    expect(semFiltro(f(mudanca))).toBe(false)
  })
})
