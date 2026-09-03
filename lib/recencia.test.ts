import { describe, expect, it } from 'vitest'
import {
  LIMITE_ATRASO_HORAS,
  avisoDeRecencia,
  classificarRecencia,
} from './recencia'

const AGORA = new Date('2026-09-02T12:00:00Z')
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000)

describe('classificarRecencia', () => {
  it('coleta de hoje está em dia', () => {
    expect(classificarRecencia(horasAtras(3), AGORA)).toBe('em-dia')
  })

  it('coleta de ontem no horário está em dia', () => {
    // O cron roda diariamente; ~24h é o intervalo normal.
    expect(classificarRecencia(horasAtras(24), AGORA)).toBe('em-dia')
  })

  it('tolera o atraso da janela do cron', () => {
    // Em 02/09 a execução saiu às 09:46 para um agendamento das 09:00.
    expect(classificarRecencia(horasAtras(25), AGORA)).toBe('em-dia')
    expect(classificarRecencia(horasAtras(LIMITE_ATRASO_HORAS), AGORA)).toBe('em-dia')
  })

  it('acusa quando passa do limite', () => {
    expect(classificarRecencia(horasAtras(LIMITE_ATRASO_HORAS + 1), AGORA)).toBe('atrasado')
  })

  it('uma coleta perdida vira atraso', () => {
    expect(classificarRecencia(horasAtras(48), AGORA)).toBe('atrasado')
  })

  it('sem coleta é estado próprio, não atraso', () => {
    expect(classificarRecencia(null, AGORA)).toBe('sem-coleta')
  })

  it('data inválida não vira atraso silencioso', () => {
    expect(classificarRecencia(new Date('não é data'), AGORA)).toBe('sem-coleta')
  })

  it('data no futuro é relógio fora de sincronia, não atraso', () => {
    expect(classificarRecencia(horasAtras(-5), AGORA)).toBe('em-dia')
  })

  it('o limite é parâmetro, não texto fixo', () => {
    expect(classificarRecencia(horasAtras(10), AGORA, 6)).toBe('atrasado')
    expect(classificarRecencia(horasAtras(10), AGORA, 20)).toBe('em-dia')
  })

  it('a fronteira é exclusiva: exatamente no limite ainda está em dia', () => {
    expect(classificarRecencia(horasAtras(30), AGORA, 30)).toBe('em-dia')
    expect(classificarRecencia(horasAtras(30.1), AGORA, 30)).toBe('atrasado')
  })
})

describe('avisoDeRecencia', () => {
  it('em dia não avisa nada', () => {
    expect(avisoDeRecencia('em-dia')).toBeNull()
  })

  it('atrasado manda conferir na loja', () => {
    expect(avisoDeRecencia('atrasado')).toMatch(/confira o valor na loja/i)
  })

  it('sem coleta diz que não há coleta', () => {
    expect(avisoDeRecencia('sem-coleta')).toMatch(/não há coleta/i)
  })
})
