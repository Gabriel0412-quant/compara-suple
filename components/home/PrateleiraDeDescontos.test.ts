import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { removerComentarios } from '@/lib/claims'

import { PrateleiraDeDescontos } from './PrateleiraDeDescontos'
import type { CategoryProduct } from '@/lib/categories'

/**
 * A única regra que este componente tem: sumir quando não há desconto.
 *
 * O resto é o cabeçalho, que é literal, e a `Prateleira`, que é a mesma das
 * categorias. Aqui só se prova a decisão de estado vazio — e ela importa
 * porque o que existia antes era uma caixa dizendo "quando rolar desconto,
 * aparece aqui", que é promessa de conteúdo futuro.
 *
 * Um server component é uma função: o valor de retorno basta, sem DOM.
 */

const produto: CategoryProduct = {
  id: 1,
  slug: 'whey-54',
  name: 'Whey 54',
  brand: 'Growth',
  thumbnail: null,
  offerCount: 2,
  featuredPrice: 90,
  featuredOriginalPrice: 120,
  lowestPrice: 80,
  lowestOfferId: 9,
  servings: 30,
  sizeGrams: 900,
  featuredPerDose: 3,
  featuredOfferId: 54,
}

describe('prateleira de descontos', () => {
  it('sem desconto na última coleta, a seção inteira não existe', () => {
    expect(PrateleiraDeDescontos({ produtos: [] })).toBeNull()
  })

  it('com desconto, a seção existe', () => {
    expect(PrateleiraDeDescontos({ produtos: [produto] })).not.toBeNull()
  })

  it('não há texto de espera no lugar do vazio', () => {
    /*
      O estado vazio anterior prometia: "Verificamos o ML diariamente — quando
      rolar desconto, aparece aqui". A regra do projeto é que dado ausente
      some, não vira promessa — a mesma que `FaixaDeMarcas` já defende.
    */
    const fonte = removerComentarios(
      readFileSync(
        resolve(process.cwd(), 'components/home/PrateleiraDeDescontos.tsx'),
        'utf8',
      ),
    )
    for (const proibido of [/aparece aqui/i, /em breve/i, /quando rolar/i]) {
      expect(fonte, `${proibido} não deveria aparecer`).not.toMatch(proibido)
    }
  })

  it('mantém o nome que o dado sustenta', () => {
    /*
      "Em queda agora" afirmava variação de preço no tempo, e o dado é
      `original_price` do anúncio. O nome certo é o que está aqui, e o e2e
      `prateleiras.spec.ts` proíbe o antigo de voltar em qualquer lugar da home.
    */
    const elemento = PrateleiraDeDescontos({ produtos: [produto] })
    expect(elemento!.props.titulo).toBe('Maiores descontos')
    expect(elemento!.props.legenda).toMatch(/preço anunciado/i)
  })
})
