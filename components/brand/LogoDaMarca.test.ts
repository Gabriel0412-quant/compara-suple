import { describe, expect, it } from 'vitest'

import { fundoDoLogo } from './LogoDaMarca'
import type { Marca } from '@/lib/brands'

/**
 * Qual fundo cada logo exige.
 *
 * A regra é curta mas vale nas duas telas que mostram logo — a faixa da home
 * e o cartão de `/marcas` —, e errar nela deixa uma marca invisível sem
 * quebrar nada: sem erro de build, sem erro de tipo, só um painel vazio.
 */

function marca(nome: string): Marca {
  return {
    nome,
    slug: 'x',
    produtos: 1,
    ofertas: 1,
    menorPreco: 100,
    categorias: [],
    tom: 0,
  }
}

describe('fundoDoLogo', () => {
  it('a Dark Lab pede o painel escuro, porque o arquivo dela é negativo', () => {
    expect(fundoDoLogo(marca('Dark Lab'))).toBe('bg-surface-dark')
  })

  it('as outras ficam no painel claro', () => {
    for (const nome of ['Growth Supplements', 'Max Titanium', 'Integralmédica', 'FTW']) {
      expect(fundoDoLogo(marca(nome)), `${nome} deveria ficar no painel claro`).toBe(
        'bg-surface-muted',
      )
    }
  })

  it('marca sem logo nenhum fica no claro, que é onde o nome escrito se lê', () => {
    // O fallback é texto em `text-ink`, escuro: num painel escuro ele sumiria.
    expect(fundoDoLogo(marca('Marca Que Nao Existe'))).toBe('bg-surface-muted')
  })

  it('acha a polaridade pelo nome como o banco escreve, com acento e caixa', () => {
    expect(fundoDoLogo(marca('DARK LAB'))).toBe('bg-surface-dark')
  })
})
