import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PaginaDoProduto } from './PaginaDoProduto'
import type { Category } from '@/lib/categories'
import { estadoDoProduto } from '@/lib/produto'
import type { Offer } from '@/lib/products'

/**
 * O que a maquete 1c decide, e que só se vê na página montada.
 *
 * A aritmética toda mora em `lib/produto.ts` e é testada lá. O que sobra aqui
 * são duas coisas que dependem da árvore: a ORDEM em que os blocos entram no
 * DOM, que no celular é a ordem em que se lê, e a ausência dos três blocos que
 * a versão anterior mantinha como esqueleto.
 */

function oferta(id: number, price: number, ml_rank: number, raw: Offer['raw'] = {}): Offer {
  return {
    id,
    external_id: `MLB${id}`,
    url: `https://exemplo.test/${id}`,
    price,
    available: true,
    fetched_at: '2026-09-08T12:07:00Z',
    ml_rank,
    raw,
  }
}

const CATEGORIA: Category = {
  name: 'Whey Protein',
  slug: 'whey-protein',
  keywords: ['whey'],
  emoji: '',
  description: '',
} as Category

/** O ML promove a de R$ 89,90; a mais barata é a 103, a R$ 59,90. */
const OFERTAS = [
  oferta(101, 89.9, 1, { thumbnail: 'https://exemplo.test/101.jpg', official_store_id: 7 }),
  oferta(102, 84.5, 2),
  oferta(103, 59.9, 3, { original_price: 79.9 }),
]

function montar(ofertas: Offer[] = OFERTAS) {
  const estado = estadoDoProduto(ofertas, { servings: 30, sizeGrams: 1000 })!
  return renderToStaticMarkup(
    <PaginaDoProduto
      nome="Whey Protein Concentrado 1kg"
      marca="Growth Supplements"
      produtoId={1}
      categoria={CATEGORIA}
      estado={estado}
      ofertas={ofertas}
      servings={30}
      relacionados={[]}
    />,
  )
}

describe('a ordem dos blocos é a ordem de leitura no celular', () => {
  it('a caixa de preço vem antes da tabela de ofertas no DOM', () => {
    /*
      Em coluna única o `grid` empilha na ordem do DOM, e é essa ordem que o
      Tab também segue. Posicionar a caixa pela direita com `order` deixaria o
      preço e a saída 3.400px abaixo do nome do produto no celular — medido na
      primeira versão desta página.
    */
    /*
      As âncoras são únicas de propósito. A primeira versão deste teste
      procurava "ofertas no Mercado Livre", que é o fim da linha de embalagem
      lá no topo, e "Menor preço", que também é o selo de uma linha da tabela —
      comparava dois textos que aparecem três vezes cada e falhava por isso.
    */
    const html = montar()
    const caixa = html.indexOf('Coletado ')
    const tabela = html.indexOf('id="ofertas-do-produto"')
    expect(caixa).toBeGreaterThan(-1)
    expect(tabela).toBeGreaterThan(-1)
    expect(caixa).toBeLessThan(tabela)
  })

  it('o nome do produto vem antes da caixa de preço', () => {
    const html = montar()
    expect(html.indexOf('Whey Protein Concentrado 1kg')).toBeLessThan(html.indexOf('Coletado '))
  })
})

describe('a saída principal', () => {
  it('leva a oferta mais barata, não a que o Mercado Livre promove', () => {
    const html = montar()
    expect(html).toContain('href="/go/103?de=produto&amp;por=menor_preco"')
  })

  it('nomeia a promovida separadamente, com o link dela', () => {
    const html = montar()
    expect(html).toContain('O Mercado Livre destaca outra')
    expect(html).toContain('href="/go/101?de=produto&amp;por=destaque"')
  })

  it('quando o ML destaca a mais barata, não há o que separar', () => {
    // Aqui a promovida (rank 1) é a mais barata: a caixa de contradição some.
    const html = montar([oferta(201, 59.9, 1), oferta(202, 84.5, 2)])
    expect(html).not.toContain('O Mercado Livre destaca outra')
    expect(html).toContain('href="/go/201?de=produto&amp;por=menor_preco"')
  })

  it('a divulgação de comissão fica na mesma tela da saída', () => {
    expect(montar()).toContain('Ganhamos comissão se você comprar por este link')
  })
})

describe('os blocos sem dado não voltam como esqueleto', () => {
  const html = montar()

  it.each([
    ['histórico de preço', /hist[óo]rico de pre[çc]o/i],
    ['informação nutricional', /informa[çc][ãa]o nutricional/i],
    ['avaliações', /avalia[çc][õo]es/i],
    ['promessa de "em breve"', /em breve/i],
  ])('não mostra %s', (_nome, padrao) => {
    /*
      A versão anterior desta página trazia os três desabilitados, mais cinco
      estrelas fixas em 4,5 e quatro miniaturas vazias. `price_history` tem 11
      dias distintos e o catálogo não tem coluna de proteína — nenhum dos três
      tem dado, e seção sem dado some.
    */
    expect(html).not.toMatch(padrao)
  })
})
