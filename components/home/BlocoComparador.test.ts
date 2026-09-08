import { describe, expect, it } from 'vitest'

import { BlocoComparador, explicarAusenciaDeDestaque } from './BlocoComparador'

/**
 * A renderização vai ao e2e; aqui ficam as duas decisões do componente que
 * podem estar erradas em silêncio.
 */

describe('ausência de destaque', () => {
  it('explica o empate, em vez de só não mostrar o selo', () => {
    // Sem texto, o leitor não sabe se ninguém venceu ou se o site esqueceu.
    expect(explicarAusenciaDeDestaque('empate')).toBe('Os três custam o mesmo por quilo.')
  })

  it('explica a falta de dado comparável', () => {
    expect(explicarAusenciaDeDestaque('sem-comparacao')).toBe(
      'Não há preço por quilo suficiente para comparar.',
    )
  })

  it('não inventa explicação quando há vencedor', () => {
    expect(explicarAusenciaDeDestaque(null)).toBeNull()
  })
})

describe('bloco sem trio', () => {
  it('não existe quando não há comparação para mostrar', () => {
    // Inventar uma comparação de dois seria pior do que não ter a seção.
    expect(BlocoComparador({ dados: null })).toBeNull()
  })
})
