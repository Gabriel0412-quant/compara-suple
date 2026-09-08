import { describe, expect, it } from 'vitest'

import { CLASSE_DO_TOM, iniciaisDaMarca } from './tons'
import { TONS_DE_MARCA } from '@/lib/brands'

describe('mapa de tons', () => {
  it('todo tom da paleta tem classe', () => {
    // O `Record` completo já garante isso em tempo de compilação; aqui a
    // garantia é em tempo de execução, para o caso de o tipo ser afrouxado.
    for (const tom of TONS_DE_MARCA) {
      expect(CLASSE_DO_TOM[tom], `${tom} sem classe`).toBeTruthy()
    }
  })

  it('nenhuma classe é montada por interpolação', () => {
    // Classe montada em runtime não é gerada pelo Tailwind, e o elemento sai
    // transparente sem erro nenhum. Se alguém colocar `${` aqui, acusa.
    for (const classe of Object.values(CLASSE_DO_TOM)) {
      expect(classe).toMatch(/^bg-[a-z-]+$/)
    }
  })

  it('a classe corresponde ao token, sem renomear no caminho', () => {
    for (const tom of TONS_DE_MARCA) {
      expect(CLASSE_DO_TOM[tom]).toBe(`bg-${tom}`)
    }
  })
})

describe('monograma', () => {
  it.each([
    ['Growth Supplements', 'GS'],
    ['Dux', 'D'],
    ['Max Titanium Nutrition', 'MT'],
    ['  Integralmédica  ', 'I'],
    ['FTW', 'F'],
  ])('%s → %s', (nome, esperado) => {
    expect(iniciaisDaMarca(nome)).toBe(esperado)
  })

  it('não estoura com nome vazio', () => {
    expect(iniciaisDaMarca('')).toBe('')
    expect(iniciaisDaMarca('   ')).toBe('')
  })
})
