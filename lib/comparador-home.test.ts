import { describe, expect, it } from 'vitest'

import type { CategoryProduct } from './categories'
import {
  compararParaSelecao,
  elegivel,
  ITENS_DO_COMPARADOR,
  montarComparadorDaHome,
  precoPorKg,
} from './comparador-home'

function card(over: Partial<CategoryProduct> = {}): CategoryProduct {
  return {
    id: 1,
    slug: 'whey-a',
    name: 'Whey Protein Concentrado A',
    brand: 'Growth',
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

/** Três wheys elegíveis, com R$/kg diferentes. */
function trio(): CategoryProduct[] {
  return [
    card({ id: 1, name: 'Whey Protein A', featuredPrice: 150, sizeGrams: 1000, offerCount: 9 }),
    card({ id: 2, name: 'Whey Protein B', featuredPrice: 190, sizeGrams: 900, offerCount: 5 }),
    card({ id: 3, name: 'Whey Protein C', featuredPrice: 220, sizeGrams: 1000, offerCount: 3 }),
  ]
}

describe('preço por quilo', () => {
  it('converte a partir do peso em gramas', () => {
    expect(precoPorKg(card({ featuredPrice: 90, sizeGrams: 900 }))).toBe(100)
  })

  it('é null sem peso, em vez de zero', () => {
    // Zero viraria "o mais barato por quilo" e venceria tudo.
    expect(precoPorKg(card({ sizeGrams: null }))).toBeNull()
    expect(precoPorKg(card({ sizeGrams: 0 }))).toBeNull()
  })
})

describe('elegibilidade', () => {
  it('exige peso, porque o selo é por quilo', () => {
    expect(elegivel(card({ sizeGrams: null }))).toBe(false)
  })

  it('exige oferta comprável', () => {
    expect(elegivel(card({ offerCount: 0 }))).toBe(false)
  })

  it('não exige dose: a ausência é dita, não impeditiva', () => {
    expect(elegivel(card({ featuredPerDose: null, servings: null }))).toBe(true)
  })
})

describe('seleção', () => {
  it('escolhe os três com mais ofertas', () => {
    const cards = [
      ...trio(),
      card({ id: 4, name: 'Whey Protein D', offerCount: 40, sizeGrams: 1000 }),
    ]
    const bloco = montarComparadorDaHome(cards, ['whey-protein'])
    expect(bloco!.itens.map(i => i.produto.id)).toEqual([4, 1, 2])
  })

  it('desempata por nome, não pela ordem do banco', () => {
    const a = [
      card({ id: 1, name: 'Zulu Whey Protein', offerCount: 5 }),
      card({ id: 2, name: 'Alfa Whey Protein', offerCount: 5 }),
      card({ id: 3, name: 'Beta Whey Protein', offerCount: 5 }),
    ]
    const ordem = (lista: CategoryProduct[]) =>
      [...lista].sort(compararParaSelecao).map(p => p.name)
    expect(ordem(a)).toEqual(ordem([...a].reverse()))
  })

  it('mostra exatamente três', () => {
    const cards = Array.from({ length: 8 }, (_, i) =>
      card({ id: i + 1, name: `Whey Protein ${i}`, offerCount: i + 1 }),
    )
    expect(montarComparadorDaHome(cards, ['whey-protein'])!.itens).toHaveLength(
      ITENS_DO_COMPARADOR,
    )
  })

  it('pula a categoria que não tem três elegíveis e tenta a próxima', () => {
    const cards = [
      card({ id: 1, name: 'Whey Protein A' }),
      card({ id: 2, name: 'Whey Protein B' }),
      card({ id: 3, name: 'Creatina Monohidratada A', featuredPrice: 60, sizeGrams: 300 }),
      card({ id: 4, name: 'Creatina Monohidratada B', featuredPrice: 80, sizeGrams: 300 }),
      card({ id: 5, name: 'Creatina Monohidratada C', featuredPrice: 100, sizeGrams: 300 }),
    ]
    const bloco = montarComparadorDaHome(cards, ['whey-protein', 'creatina'])
    expect(bloco!.categoria.slug).toBe('creatina')
  })

  it('categoria com três produtos mas dois elegíveis é pulada', () => {
    /*
      O caso que faltava, achado pelo Stryker: remover o `.filter(elegivel)`
      sobrevivia a todos os testes, porque em cada um deles a categoria com
      poucos elegíveis também tinha poucos produtos — o corte acontecia pelo
      tamanho, não pela elegibilidade.

      Aqui a whey tem três produtos e só dois com peso informado. Sem o filtro,
      o bloco seria montado com um cartão de R$/kg vazio.
    */
    const cards = [
      card({ id: 1, name: 'Whey Protein A', sizeGrams: 1000 }),
      card({ id: 2, name: 'Whey Protein B', sizeGrams: 900 }),
      card({ id: 3, name: 'Whey Protein C', sizeGrams: null }),
      card({ id: 4, name: 'Creatina A', featuredPrice: 60, sizeGrams: 300 }),
      card({ id: 5, name: 'Creatina B', featuredPrice: 80, sizeGrams: 300 }),
      card({ id: 6, name: 'Creatina C', featuredPrice: 100, sizeGrams: 300 }),
    ]
    const bloco = montarComparadorDaHome(cards, ['whey-protein', 'creatina'])
    expect(bloco!.categoria.slug).toBe('creatina')
    expect(bloco!.itens.every(i => i.precoPorKg !== null)).toBe(true)
  })

  it('devolve null quando nenhuma categoria tem trio', () => {
    // Melhor não ter bloco que ter três cartões com dois produtos e um buraco.
    const cards = [card({ id: 1, name: 'Whey Protein A' }), card({ id: 2, name: 'Whey Protein B' })]
    expect(montarComparadorDaHome(cards, ['whey-protein', 'creatina'])).toBeNull()
  })

  it('catálogo vazio não vira bloco', () => {
    expect(montarComparadorDaHome([])).toBeNull()
  })
})

describe('destaque de melhor R$/kg', () => {
  it('coroa o menor preço por quilo', () => {
    const bloco = montarComparadorDaHome(trio(), ['whey-protein'])!
    // A: 150/kg, B: ~211/kg, C: 220/kg — vence A, que está no índice 1
    // depois da ordenação por ofertas (D não existe aqui): [1, 2, 3] → A é 0.
    expect(bloco.melhorPorKg).toEqual([0])
    expect(bloco.motivoSemDestaque).toBeNull()
  })

  it('não coroa vencedor solitário', () => {
    /*
      Se só um item tem o dado, ele "vence" por ser o único a informar — e isso
      transforma ausência de dado em mérito. É a regra que o `destacarMelhor`
      do comparador já implementava, e o bloco da home usa a mesma função em
      vez de reimplementar.

      Aqui os três são elegíveis (todos têm peso), mas forço dois a empatar com
      o terceiro para exercitar a outra guarda.
    */
    const iguais = [
      card({ id: 1, name: 'Whey Protein A', featuredPrice: 100, sizeGrams: 1000, offerCount: 3 }),
      card({ id: 2, name: 'Whey Protein B', featuredPrice: 100, sizeGrams: 1000, offerCount: 2 }),
      card({ id: 3, name: 'Whey Protein C', featuredPrice: 100, sizeGrams: 1000, offerCount: 1 }),
    ]
    const bloco = montarComparadorDaHome(iguais, ['whey-protein'])!
    expect(bloco.melhorPorKg).toEqual([])
    expect(bloco.motivoSemDestaque).toBe('empate')
  })

  it('destaca os dois empatados quando o terceiro perde', () => {
    const cards = [
      card({ id: 1, name: 'Whey Protein A', featuredPrice: 100, sizeGrams: 1000, offerCount: 3 }),
      card({ id: 2, name: 'Whey Protein B', featuredPrice: 100, sizeGrams: 1000, offerCount: 2 }),
      card({ id: 3, name: 'Whey Protein C', featuredPrice: 300, sizeGrams: 1000, offerCount: 1 }),
    ]
    const bloco = montarComparadorDaHome(cards, ['whey-protein'])!
    expect(bloco.melhorPorKg).toEqual([0, 1])
  })
})

describe('métricas e saída', () => {
  it('o campo conta ofertas, e não lojas', () => {
    /*
      Enquanto só houver Mercado Livre, este número conta anúncios do mesmo
      marketplace. A maquete rotula "Lojas"; contar uma coisa e dizer outra é
      o que este campo evita. Muda quando o EP06 trouxer a Amazon.
    */
    const bloco = montarComparadorDaHome(trio(), ['whey-protein'])!
    expect(bloco.itens.map(i => i.ofertas)).toEqual([9, 5, 3])
  })

  it('repassa a dose ausente sem inventar', () => {
    const semDose = trio().map(p => ({ ...p, featuredPerDose: null }))
    const bloco = montarComparadorDaHome(semDose, ['whey-protein'])!
    expect(bloco.itens.every(i => i.precoPorDose === null)).toBe(true)
  })

  it('a URL do comparador leva os três ids selecionados', () => {
    const bloco = montarComparadorDaHome(trio(), ['whey-protein'])!
    const ids = new URL(bloco.urlDoComparador, 'http://x').searchParams.get('ids')
    expect(ids!.split(',').map(Number).sort()).toEqual([1, 2, 3])
  })

  it('estoura se a lista da home citar categoria inexistente', () => {
    expect(() => montarComparadorDaHome(trio(), ['fantasma'])).toThrow(/fantasma/)
  })
})
