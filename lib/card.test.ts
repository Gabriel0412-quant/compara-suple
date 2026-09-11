import { describe, expect, it } from 'vitest'

import { compararPorEconomia, estadoDoCard } from './card'
import { formatBRL } from './products'
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
    servings: null,
    sizeGrams: null,
    featuredPerDose: null,
    ...over,
  }
}

describe('desconto', () => {
  it('aparece quando o preço anterior é maior', () => {
    const e = estadoDoCard(card({ featuredPrice: 75, featuredOriginalPrice: 100 }))
    expect(e.temDesconto).toBe(true)
    expect(e.percentualDesconto).toBe(25)
  })

  it('não aparece sem preço anterior', () => {
    const e = estadoDoCard(card({ featuredOriginalPrice: null }))
    expect(e.temDesconto).toBe(false)
    expect(e.percentualDesconto).toBe(0)
  })

  it('não aparece quando o preço anterior é igual', () => {
    // `original_price` vem do próprio anúncio e às vezes repete o preço atual.
    // Um "-0%" na tela é ruído que afirma promoção onde não há.
    const e = estadoDoCard(card({ featuredPrice: 100, featuredOriginalPrice: 100 }))
    expect(e.temDesconto).toBe(false)
  })

  it('não aparece quando o preço anterior é menor', () => {
    // Acontece com dado sujo. Um desconto negativo viraria "+25%".
    const e = estadoDoCard(card({ featuredPrice: 100, featuredOriginalPrice: 80 }))
    expect(e.temDesconto).toBe(false)
    expect(e.percentualDesconto).toBe(0)
  })

  it('arredonda para inteiro', () => {
    const e = estadoDoCard(card({ featuredPrice: 66.67, featuredOriginalPrice: 100 }))
    expect(e.percentualDesconto).toBe(33)
  })
})

describe('economia em reais', () => {
  it('é a diferença entre o preço anterior e o cobrado', () => {
    const e = estadoDoCard(card({ featuredPrice: 147.05, featuredOriginalPrice: 429.9 }))
    expect(e.economia).toBeCloseTo(282.85, 2)
    expect(formatBRL(e.economia!)).toBe(formatBRL(282.85))
  })

  it('é null sem desconto, e não zero', () => {
    // Zero é um número a formatar: viraria "Economiza R$ 0,00" na tela. A
    // ausência precisa ser ausência, do mesmo jeito que `precoNormalizado`.
    expect(estadoDoCard(card({ featuredOriginalPrice: null })).economia).toBeNull()
    expect(estadoDoCard(card({ featuredPrice: 100, featuredOriginalPrice: 100 })).economia).toBeNull()
    expect(estadoDoCard(card({ featuredPrice: 100, featuredOriginalPrice: 80 })).economia).toBeNull()
  })

  it('sobrevive à subtração binária dos preços do catálogo', () => {
    // 344 - 189,99 dá 154,01000000000002 em ponto flutuante. O número cru
    // carrega o resto; quem precisa estar certo é o que a pessoa lê.
    const e = estadoDoCard(card({ featuredPrice: 189.99, featuredOriginalPrice: 344 }))
    expect(formatBRL(e.economia!)).toBe('R$\u00a0154,01')
  })

  it('ordena diferente do percentual — é por isso que existe', () => {
    /*
      Os dois primeiros cards da prateleira de maiores descontos em 10/09/2026.
      O segundo tem o percentual maior e a economia menor: uma fixture em que a
      regra e o acaso concordassem não provaria que a coluna certa foi usada.
    */
    const maior = estadoDoCard(card({ featuredPrice: 147.05, featuredOriginalPrice: 429.9 }))
    const menor = estadoDoCard(card({ featuredPrice: 68.9, featuredOriginalPrice: 239.9 }))

    expect(menor.percentualDesconto).toBeGreaterThan(maior.percentualDesconto)
    expect(menor.economia!).toBeLessThan(maior.economia!)
  })
})

describe('preço normalizado', () => {
  it('usa a dose quando o produto informa porções', () => {
    const e = estadoDoCard(card({ featuredPrice: 90, featuredPerDose: 3, sizeGrams: 900 }))
    // Dose ganha do quilo: é a unidade em que a pessoa consome.
    expect(e.precoNormalizado).toMatch(/\/dose$/)
    expect(e.precoNormalizado).toContain('3,00')
  })

  it('cai para o quilo quando não há dose', () => {
    /*
      O esperado vem de `formatBRL`, e não escrito à mão.

      `Intl.NumberFormat` separa "R$" do número com espaço não separável
      (U+00A0), não com espaço comum. Escrever 'R$ 150,00/kg' no teste produz
      uma string que parece idêntica na tela e no relatório de falha — o vitest
      chegou a imprimir "expected 'R$ 150,00/kg' to be 'R$ 150,00/kg'" — e não
      é igual byte a byte.
    */
    const e = estadoDoCard(card({ featuredPrice: 150, featuredPerDose: null, sizeGrams: 1000 }))
    expect(e.precoNormalizado).toBe(`${formatBRL(150)}/kg`)
  })

  it('converte o peso corretamente abaixo de um quilo', () => {
    const e = estadoDoCard(card({ featuredPrice: 90, featuredPerDose: null, sizeGrams: 900 }))
    expect(e.precoNormalizado).toBe(`${formatBRL(100)}/kg`)
  })

  it('sem dose e sem peso, devolve null em vez de inventar', () => {
    // A tela diz "sem dose ou peso informado". Sumir sem explicação parece bug.
    const e = estadoDoCard(card({ featuredPerDose: null, sizeGrams: null }))
    expect(e.precoNormalizado).toBeNull()
  })

  it('peso zero não vira divisão por zero', () => {
    const e = estadoDoCard(card({ featuredPerDose: null, sizeGrams: 0 }))
    expect(e.precoNormalizado).toBeNull()
  })
})

describe('linha de menor preço', () => {
  it('aparece quando a mais barata contradiz o destaque', () => {
    const e = estadoDoCard(card({ featuredPrice: 120, lowestPrice: 99, lowestOfferId: 7 }))
    expect(e.temMaisBarata).toBe(true)
  })

  it('não aparece quando o destaque já é o menor', () => {
    const e = estadoDoCard(card({ featuredPrice: 99, lowestPrice: 99, lowestOfferId: 7 }))
    expect(e.temMaisBarata).toBe(false)
  })

  it('não aparece sem oferta para onde apontar', () => {
    // Sem `lowestOfferId` a linha viraria texto sem link — ou link para lugar
    // nenhum, que é o que o card já removeu antes.
    const e = estadoDoCard(card({ featuredPrice: 120, lowestPrice: 99, lowestOfferId: null }))
    expect(e.temMaisBarata).toBe(false)
  })

  it('não aparece sem menor preço conhecido', () => {
    const e = estadoDoCard(card({ featuredPrice: 120, lowestPrice: null, lowestOfferId: 7 }))
    expect(e.temMaisBarata).toBe(false)
  })
})

describe('saída para a loja', () => {
  it('existe quando há oferta destacada', () => {
    expect(estadoDoCard(card({ featuredOfferId: 42 })).temSaida).toBe(true)
  })

  it('não existe sem oferta destacada', () => {
    expect(estadoDoCard(card({ featuredOfferId: null })).temSaida).toBe(false)
  })
})

describe('ordem da prateleira de maiores descontos', () => {
  /** Um produto com desconto, nomeado pelo que economiza. */
  function comDesconto(nome: string, preco: number, anterior: number) {
    return card({ name: nome, featuredPrice: preco, featuredOriginalPrice: anterior })
  }

  it('ordena por reais, e não pelo percentual que o selo mostra', () => {
    /*
      Os dois primeiros da prateleira em produção, 10/09/2026. O de -71%
      economiza menos que o de -66%: se a ordenação trocasse para percentual,
      esta lista viraria outra — que é exatamente o que o teste precisa ver.
    */
    const seiscentaSeis = comDesconto('A', 147.05, 429.9)
    const setentaEUm = comDesconto('B', 68.9, 239.9)

    expect([setentaEUm, seiscentaSeis].sort(compararPorEconomia).map(p => p.name)).toEqual(['A', 'B'])
    expect([seiscentaSeis, setentaEUm].sort(compararPorEconomia).map(p => p.name)).toEqual(['A', 'B'])
  })

  it('a ordem por reais e a por percentual são de fato diferentes aqui', () => {
    // Trava a fixture, não o código: se alguém "arrumar" estes números para
    // que os dois critérios concordem, o teste acima deixa de testar.
    const a = estadoDoCard(comDesconto('A', 147.05, 429.9))
    const b = estadoDoCard(comDesconto('B', 68.9, 239.9))

    expect(a.economia!).toBeGreaterThan(b.economia!)
    expect(a.percentualDesconto).toBeLessThan(b.percentualDesconto)
  })

  it('desempata pelo percentual quando a economia empata', () => {
    // R$ 50,00 de economia nos dois; o de preço menor desconta mais.
    const caro = comDesconto('A caro', 200, 250)
    const barato = comDesconto('B barato', 100, 150)

    expect([caro, barato].sort(compararPorEconomia).map(p => p.name)).toEqual(['B barato', 'A caro'])
  })

  it('desempata pelo nome quando economia e percentual empatam', () => {
    // Sem isto, dois produtos idênticos trocam de lugar entre deploys,
    // conforme a ordem em que o Postgres respondeu.
    const zebra = comDesconto('Zebra', 100, 150)
    const alfa = comDesconto('Alfa', 100, 150)

    expect([zebra, alfa].sort(compararPorEconomia).map(p => p.name)).toEqual(['Alfa', 'Zebra'])
    expect([alfa, zebra].sort(compararPorEconomia).map(p => p.name)).toEqual(['Alfa', 'Zebra'])
  })

  it('produto sem desconto vai para o fim', () => {
    // `getProductsOnSale` filtra antes de ordenar, mas a função é pura e
    // exportada: a ordem do caso sem economia é definida aqui.
    const sem = card({ name: 'Sem desconto', featuredOriginalPrice: null })
    const com = comDesconto('Com desconto', 100, 110)

    expect([sem, com].sort(compararPorEconomia).map(p => p.name)).toEqual(['Com desconto', 'Sem desconto'])
  })
})
