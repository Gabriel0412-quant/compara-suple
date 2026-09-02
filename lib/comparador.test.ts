import { describe, expect, it } from 'vitest'
import {
  MAX_SLOTS,
  buildCompararUrl,
  destacarMelhor,
  parseIdsComparados,
} from './comparador'

describe('parseIdsComparados', () => {
  it('lê ids separados por vírgula', () => {
    expect(parseIdsComparados('1,2,3')).toEqual([1, 2, 3])
  })

  it('remove duplicatas', () => {
    // Regressão: `?ids=62,62,62` rendia três colunas do mesmo produto,
    // com o cabeçalho anunciando "Comparação (3)".
    expect(parseIdsComparados('62,62,62')).toEqual([62])
    expect(parseIdsComparados('62,62,63')).toEqual([62, 63])
  })

  it('preserva a ordem da primeira aparição', () => {
    expect(parseIdsComparados('3,1,3,2')).toEqual([3, 1, 2])
  })

  it('corta no teto de slots', () => {
    expect(parseIdsComparados('1,2,3,4,5')).toHaveLength(MAX_SLOTS)
    expect(parseIdsComparados('1,2,3,4,5')).toEqual([1, 2, 3])
  })

  it('conta o teto após deduplicar, não antes', () => {
    expect(parseIdsComparados('1,1,1,2,3')).toEqual([1, 2, 3])
  })

  it('descarta id inválido, negativo e zero', () => {
    expect(parseIdsComparados('abc,-1,0,7')).toEqual([7])
  })

  it('trata ausência e string vazia', () => {
    expect(parseIdsComparados(undefined)).toEqual([])
    expect(parseIdsComparados('')).toEqual([])
    expect(parseIdsComparados(',,,')).toEqual([])
  })

  it('aceita o array que o Next entrega quando o parâmetro se repete', () => {
    expect(parseIdsComparados(['1,2', '9'])).toEqual([1, 2])
  })

  it('ignora espaços', () => {
    expect(parseIdsComparados(' 1 , 2 ')).toEqual([1, 2])
  })
})

describe('buildCompararUrl', () => {
  it('monta a URL com ids e selecionado', () => {
    expect(buildCompararUrl([1, 2], 2)).toBe('/comparar?ids=1%2C2&selected=2')
  })

  it('sem ids devolve a rota limpa', () => {
    expect(buildCompararUrl([])).toBe('/comparar')
  })

  it('descarta selecionado que não está na comparação', () => {
    // Evita `?selected=` apontando para um produto que acabou de ser removido.
    expect(buildCompararUrl([1, 2], 99)).toBe('/comparar?ids=1%2C2')
  })

  it('sem selecionado, omite o parâmetro', () => {
    expect(buildCompararUrl([1, 2], null)).toBe('/comparar?ids=1%2C2')
  })
})

describe('destacarMelhor', () => {
  it('aponta o menor valor', () => {
    expect(destacarMelhor([30, 10, 20])).toEqual({ indices: [1], motivo: null })
  })

  it('aponta o maior quando o modo é max', () => {
    expect(destacarMelhor([3, 9, 5], 'max')).toEqual({ indices: [1], motivo: null })
  })

  it('não destaca quando só um item informa o dado', () => {
    // Vencer sozinho transforma ausência de dado dos outros em mérito.
    expect(destacarMelhor([10, null, null])).toEqual({
      indices: [], motivo: 'sem-comparacao',
    })
  })

  it('não destaca quando nenhum item informa o dado', () => {
    expect(destacarMelhor([null, null])).toEqual({
      indices: [], motivo: 'sem-comparacao',
    })
  })

  it('não destaca quando todos empatam', () => {
    expect(destacarMelhor([10, 10, 10])).toEqual({ indices: [], motivo: 'empate' })
  })

  it('destaca os dois melhores num empate parcial', () => {
    expect(destacarMelhor([10, 10, 20])).toEqual({ indices: [0, 1], motivo: null })
  })

  it('item ausente não vence nem perde', () => {
    const d = destacarMelhor([null, 50, 80])
    expect(d.indices).toEqual([1])
    expect(d.indices).not.toContain(0)
  })

  it('ausente não é tratado como zero', () => {
    // Se null virasse 0, o índice 0 venceria um critério de mínimo.
    expect(destacarMelhor([null, 5, 9]).indices).toEqual([1])
  })

  it('ignora valores não finitos', () => {
    expect(destacarMelhor([Infinity, 5, 9]).indices).toEqual([1])
    expect(destacarMelhor([NaN, 5, 9]).indices).toEqual([1])
  })

  it('lista vazia não quebra', () => {
    expect(destacarMelhor([])).toEqual({ indices: [], motivo: 'sem-comparacao' })
  })
})
