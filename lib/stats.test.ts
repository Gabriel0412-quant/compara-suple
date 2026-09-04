import { describe, expect, it } from 'vitest'

import { formatCount, formatUltimaColeta, formatUpdatedAt } from './stats'

/**
 * Datas de coleta são lidas por quem está no Brasil, e gravadas em UTC.
 *
 * O servidor da Vercel roda em UTC, então "hoje" calculado com
 * `Date.getDate()` é o hoje de Londres, não o de São Paulo. Entre 21h e
 * meia-noite de Brasília isso troca o dia: a coleta da manhã vira "ontem"
 * para quem está lendo à noite do mesmo dia.
 */

/** 04/09/2026, 22h00 em Brasília — já é dia 5 em UTC. */
const NOITE_BRT = new Date('2026-09-05T01:00:00Z')
/** Coleta das 06h45 de Brasília do dia 04. */
const COLETA_DA_MANHA = new Date('2026-09-04T09:45:00Z')

describe('formatUpdatedAt', () => {
  it('diz "hoje" para a coleta da manhã, lida às 22h de Brasília', () => {
    expect(formatUpdatedAt(COLETA_DA_MANHA, NOITE_BRT)).toBe('hoje')
  })

  it('diz "ontem" para a coleta do dia anterior', () => {
    expect(formatUpdatedAt(new Date('2026-09-03T09:45:00Z'), NOITE_BRT)).toBe('ontem')
  })

  it('vira data explícita a partir de dois dias', () => {
    expect(formatUpdatedAt(new Date('2026-09-02T09:45:00Z'), NOITE_BRT)).toBe('02/09')
  })

  it('não esconde a ausência de coleta', () => {
    expect(formatUpdatedAt(null, NOITE_BRT)).toBe('sem coleta')
  })

  it('trata a virada do dia em Brasília, não em UTC', () => {
    // 00h30 de Brasília do dia 05 = 03h30 UTC do dia 05.
    const madrugada = new Date('2026-09-05T03:30:00Z')
    // Coleta às 23h do dia 04 em Brasília = 02h UTC do dia 05.
    expect(formatUpdatedAt(new Date('2026-09-05T02:00:00Z'), madrugada)).toBe('ontem')
  })
})

describe('formatCount', () => {
  it('agrupa milhar no padrão brasileiro', () => {
    expect(formatCount(1252)).toBe('1.252')
  })

  it('não inventa número quando não há nenhum', () => {
    expect(formatCount(0)).toBe('0')
  })
})

describe('formatUltimaColeta', () => {
  it('diz a hora de Brasília, não a de UTC', () => {
    // 09h45 UTC = 06h45 em São Paulo. É esse o número que a pessoa espera ver.
    expect(formatUltimaColeta(COLETA_DA_MANHA, NOITE_BRT)).toBe('hoje às 06:45')
  })

  it('mantém a hora quando a coleta foi ontem', () => {
    expect(formatUltimaColeta(new Date('2026-09-03T09:45:00Z'), NOITE_BRT)).toBe('ontem às 06:45')
  })

  it('diz a data por extenso quando o dado está velho, em vez de omitir', () => {
    expect(formatUltimaColeta(new Date('2026-08-31T09:45:00Z'), NOITE_BRT)).toBe('em 31/08 às 06:45')
  })

  it('não finge que houve coleta', () => {
    expect(formatUltimaColeta(null, NOITE_BRT)).toBe('sem coleta registrada')
  })
})
