import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { classeDoChip, OffersSection } from './OffersSection'
import { OFERTAS_VISIVEIS } from '@/lib/offers-table'
import { formatBRL, type Offer } from '@/lib/products'

/**
 * O que a tabela decide numa renderização só.
 *
 * A interação — filtrar, ordenar, abrir a lista — está em `e2e/produto.spec.ts`,
 * contra o app servido. Aqui ficam as decisões que já estão tomadas quando o
 * HTML sai do servidor: quem leva o selo de menor preço, quando o preço
 * riscado aparece, o que o botão de "ver mais" diz e como cada linha se veste.
 */

function oferta(
  id: number,
  price: number,
  { ml_rank = id, raw = {} }: { ml_rank?: number; raw?: Offer['raw'] } = {},
): Offer {
  return {
    id,
    external_id: `MLB${id}`,
    url: 'https://exemplo.test',
    price,
    available: true,
    fetched_at: '2026-01-01',
    ml_rank,
    raw,
  }
}

/*
  Sete ofertas, cada uma para um ramo:

    10  80,00  a mais barata, com cidade e estado
    20 100,00  loja oficial, e NÃO é a mais barata
    30 100,00  vendedor comum, para a diferença aparecer duas vezes
    40  80,00  empata com a mais barata: diferença exatamente zero
    50 100,00  original 150 — riscado legítimo
    60 100,00  original 90, abaixo do preço — não pode riscar
    70 100,00  original 100, igual ao preço — não pode riscar
*/
const LISTA = [
  oferta(10, 80, { raw: { seller_address: { city: { name: 'Curitiba' }, state: { name: 'Paraná' } } } }),
  oferta(20, 100, { raw: { official_store_id: 7 } }),
  oferta(30, 100, { raw: { seller_address: { city: { name: 'São Paulo' } } } }),
  oferta(40, 80),
  oferta(50, 100, { raw: { original_price: 150 } }),
  oferta(60, 100, { raw: { original_price: 90 } }),
  oferta(70, 100, { raw: { original_price: 100 } }),
]

const render = (offers: Offer[], servings: number | null = 20, superficie?: 'comparador') =>
  renderToStaticMarkup(
    <OffersSection offers={offers} servings={servings} superficie={superficie} />,
  )

const quantas = (html: string, trecho: string) => html.split(trecho).length - 1

/** Linhas do corpo da tabela. O cabeçalho não tem a grade de celular. */
const linhasDoCorpo = (html: string) => quantas(html, 'max-sm:grid max-sm:grid-cols-2')

/*
  Todo valor em real passa por `formatBRL`, e nunca escrito à mão.

  `Intl.NumberFormat('pt-BR')` separa o símbolo do número com espaço NÃO
  separável (U+00A0), e `"R$ 150,00"` digitado no teclado usa o espaço comum.
  Os dois são visualmente idênticos e nunca casam — é armadilha registrada no
  CLAUDE.md, e caiu nela a primeira versão deste arquivo.
*/

/** N ofertas de preços distintos, a mais barata na frente. */
function muitas(n: number): Offer[] {
  return Array.from({ length: n }, (_, i) => oferta(100 + i, 50 + i, { ml_rank: i }))
}

describe('a saída de cada linha', () => {
  it('usa produto por padrão e nomeia o critério de cada uma', () => {
    const html = render(LISTA)
    expect(html).toContain('href="/go/10?de=produto&amp;por=menor_preco"')
    expect(html).toContain('href="/go/20?de=produto&amp;por=destaque"')
  })

  it('usa comparador quando pedido', () => {
    const html = render(LISTA, 20, 'comparador')
    expect(html).toContain('href="/go/10?de=comparador&amp;por=menor_preco"')
    expect(html).toContain('href="/go/20?de=comparador&amp;por=destaque"')
  })

  it('o botão da mais barata é sólido; os outros, de contorno', () => {
    const html = render(LISTA)
    expect(html).toContain('bg-ink text-ink-on-dark hover:bg-surface-darker')
    expect(html).toContain('border border-line-strong text-ink-2')
    expect(html).toContain('>Ir à loja</a>')
  })
})

describe('fala em ofertas, não em lojas', () => {
  it('o título conta anúncios do Mercado Livre', () => {
    // A seção dizia "Comparar em N lojas". São anúncios de um marketplace só.
    const html = render(LISTA)
    expect(html).toContain('7 ofertas no Mercado Livre')
    expect(html).not.toMatch(/\d+ lojas/)
  })

  it('uma oferta fala no singular', () => {
    expect(render([oferta(10, 80)])).toContain('1 oferta no Mercado Livre')
  })

  it('declara de onde vem a ordem e o que o preço não inclui', () => {
    expect(render(LISTA)).toContain('é a do próprio Mercado Livre. Frete não entra no preço.')
  })

  it('sem filtro ligado, não diz "de N" nem oferece limpar', () => {
    const html = render(LISTA)
    expect(html).not.toContain(' de 7')
    expect(html).not.toContain('limpar')
  })
})

describe('a grade da tabela', () => {
  it('tem quatro colunas, e a de ação só é anunciada a quem lê por áudio', () => {
    const html = render(LISTA)
    expect(html).toContain('>Oferta</th>')
    expect(html).toContain('>Preço</th>')
    expect(html).toContain('>R$/dose</th>')
    expect(html).toContain('<span class="sr-only">Ação</span>')
    expect(quantas(html, '<th ')).toBe(4)
  })

  it('cada linha vira cartão no celular', () => {
    // Sem isto a tabela rola de lado no celular e o preço fica fora da tela.
    expect(render(LISTA)).toContain('max-sm:grid max-sm:grid-cols-2')
  })

  it('sem oferta nenhuma, não há tabela — há uma frase', () => {
    const html = render([])
    expect(html).toContain('Nenhuma oferta atende a esses filtros.')
    expect(html).not.toContain('<table')
  })

  it('com oferta, a frase de lista vazia não aparece', () => {
    expect(render(LISTA)).not.toContain('Nenhuma oferta atende')
  })
})

describe('quem é a mais barata', () => {
  it('a linha dela é a única realçada e a única com selo', () => {
    const html = render(LISTA)
    expect(quantas(html, 'MENOR PREÇO')).toBe(1)
    expect(quantas(html, 'bg-surface-warm"')).toBe(1)
    /*
      O sufixo da classe da linha, e não `hover:bg-surface-muted` solto: essa
      classe também está no `<select>` de ordenação, e a asserção passava
      mesmo com a linha inteira sem realce nenhum.
    */
    expect(html).toContain('max-sm:py-3 hover:bg-surface-muted"')
  })

  it('o selo de oficial não disputa espaço com o de menor preço', () => {
    // A 20 é oficial e não é a mais barata: ganha o selo OFICIAL.
    expect(render(LISTA)).toContain('OFICIAL')
    // Aqui a oficial é também a mais barata: um selo só, o que importa.
    const html = render([oferta(20, 50, { raw: { official_store_id: 7 } }), oferta(30, 90)])
    expect(html).toContain('MENOR PREÇO')
    expect(html).not.toContain('OFICIAL<')
  })

  it('a diferença aparece só onde há diferença', () => {
    /*
      Cinco linhas custam R$ 20,00 a mais. A mais barata não tem diferença
      nenhuma, e a 40 empata com ela — diferença exatamente zero, que não é
      informação: "+R$ 0,00 vs. menor preço" é ruído.
    */
    const html = render(LISTA)
    expect(html).toContain(`+${formatBRL(20)} vs. menor preço`)
    expect(quantas(html, 'vs. menor preço')).toBe(5)
    expect(html).not.toContain(`+${formatBRL(0)}`)
  })
})

describe('o que cada linha pode afirmar', () => {
  it('só risca o preço quando o anunciado é maior', () => {
    const html = render(LISTA)
    expect(html).toContain(formatBRL(150))
    // A 60 anuncia 90 sobre um preço de 100, e a 70 anuncia o próprio preço.
    expect(html).not.toContain(formatBRL(90))
    expect(quantas(html, 'line-through')).toBe(1)
  })

  it('mostra o estado só quando ele existe', () => {
    /*
      Ancorado no `</svg>` do alfinete de mapa, que é o que separa esta linha
      do nome do vendedor. Sem a âncora, "São Paulo</span>" também casa com
      "Vendedor em São Paulo</span>" e a asserção passa com a vírgula perdida.
    */
    const html = render(LISTA)
    expect(html).toContain('</svg>Curitiba, Paraná</span>')
    expect(html).toContain('</svg>São Paulo</span>')
  })

  it('o prazo de entrega desceu para a linha do vendedor', () => {
    expect(render(LISTA)).toContain('<span>3–7 dias</span>')
  })

  it('o R$/dose perde o sufixo na coluna e o recupera no celular', () => {
    // 80,00 / 20 doses. Na tabela o cabeçalho já diz "R$/dose"; no cartão do
    // celular não há cabeçalho, e sem o sufixo o valor lê como outro preço.
    expect(render(LISTA)).toContain(
      `${formatBRL(4)}<span class="text-ink-4 sm:hidden"> / dose</span>`,
    )
  })

  it('sem doses informadas, a coluna diz que não sabe', () => {
    const html = render([oferta(10, 80)], null)
    expect(html).toContain('—')
    expect(html).not.toContain('/ dose')
  })
})

describe('o chip de filtro', () => {
  it('ligado é sólido na cor da marca; desligado é contorno', () => {
    expect(classeDoChip(true)).toContain('bg-brand')
    expect(classeDoChip(false)).toContain('border-line-strong')
  })

  it('os dois estados não se confundem', () => {
    // "não contém bg-brand" também vale para string vazia: o que prova que os
    // dois ramos existem é eles diferirem, e a mesma armadilha custou um
    // mutante sobrevivente no #241.
    expect(classeDoChip(true)).not.toBe(classeDoChip(false))
  })

  it('começam todos desligados', () => {
    expect(render(LISTA)).toContain(classeDoChip(false))
    expect(render(LISTA)).not.toContain(classeDoChip(true))
  })
})

describe('a ordem oferecida', () => {
  it('nomeia os três critérios, e o padrão é o do Mercado Livre', () => {
    const html = render(LISTA)
    expect(html).toContain('Destaque (ordem do Mercado Livre)')
    expect(html).toContain('>Menor preço</option>')
    expect(html).toContain('>Maior desconto</option>')
    expect(html).toContain('<option value="featured" selected=""')
  })
})

describe('o teto de linhas', () => {
  const linhas = linhasDoCorpo

  it('mostra só as primeiras e diz quantas faltam', () => {
    const html = render(muitas(131))
    expect(linhas(html)).toBe(OFERTAS_VISIVEIS)
    expect(html).toContain('Ver as outras 121 ofertas')
    expect(html).not.toContain('Mostrar menos')
  })

  it('sem teto estourado, não há botão nenhum', () => {
    // Exatamente no teto: o botão apareceria dizendo "ver mais 0 ofertas".
    const html = render(muitas(OFERTAS_VISIVEIS))
    expect(linhas(html)).toBe(OFERTAS_VISIVEIS)
    expect(html).not.toContain('Ver as outras')
    expect(html).not.toContain('Ver mais')
  })

  it('uma oferta a mais fala no singular', () => {
    expect(render(muitas(OFERTAS_VISIVEIS + 1))).toContain('Ver mais 1 oferta')
  })

  it('a mais barata entra mesmo cortada pelo teto', () => {
    /*
      A ordem padrão é a do ML, e nela a mais barata pode estar em qualquer
      posição. Aqui ela é a última — sem a linha extra, a caixa de preço
      anunciaria R$ 1,00 e nenhuma linha visível teria esse valor.
    */
    const html = render([...muitas(12), oferta(999, 1, { ml_rank: 99 })])
    expect(html).toContain('href="/go/999?de=produto&amp;por=menor_preco"')
    expect(linhas(html)).toBe(OFERTAS_VISIVEIS + 1)
    expect(html).toContain('Ver as outras 2 ofertas')
  })
})
