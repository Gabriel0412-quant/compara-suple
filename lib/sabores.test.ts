import { describe, expect, it } from 'vitest'

import { SABORES, familiaDoSabor, saborPorValor } from './sabores'

/**
 * O agrupamento de sabor.
 *
 * O que pode dar errado aqui é sutil: agrupar demais junta coisas diferentes,
 * agrupar de menos devolve a lista redundante que motivou o módulo, e a ordem
 * das famílias muda qual delas captura um rótulo composto.
 */

describe('famílias de sabor', () => {
  /*
    Os nove rótulos medidos em produção em 10/09/2026, com a família esperada.
    É a tabela que motivou o módulo, e é o que ele precisa continuar resolvendo.
  */
  it.each([
    // Os nove rótulos medidos em produção, mais um representante de cada
    // família que o catálogo ainda não tem — senão os termos dela nunca são
    // exercidos e trocá-los passa despercebido.
    ['Sem sabor', 'sem-sabor', 'Sem sabor'],
    ['Natural', 'sem-sabor', 'Sem sabor'],
    ['Neutro', 'sem-sabor', 'Sem sabor'],
    ['Sem aroma', 'sem-sabor', 'Sem sabor'],
    ['Chocolate', 'chocolate', 'Chocolate'],
    ['Milkshake de chocolate', 'chocolate', 'Chocolate'],
    ['Cacau', 'chocolate', 'Chocolate'],
    ['Morango', 'morango', 'Morango'],
    ['Baunilha', 'baunilha', 'Baunilha'],
    ['Frutas vermelhas', 'frutas-vermelhas', 'Frutas vermelhas'],
    ['Melancia', 'melancia', 'Melancia'],
    ['Limão', 'limao', 'Limão'],
    ['Coco', 'coco', 'Coco'],
    ['Café', 'cafe', 'Café'],
  ])('%s cai em %s, com o rótulo %s', (flavor, valor, rotulo) => {
    const familia = familiaDoSabor(flavor)
    expect(familia?.valor).toBe(valor)
    expect(familia?.rotulo).toBe(rotulo)
  })

  it('os nove rótulos do catálogo viram seis famílias', () => {
    // O número é o ponto do módulo: nove opções, três delas dizendo a mesma
    // coisa, viram seis.
    const catalogo = [
      'Sem sabor', 'Chocolate', 'Milkshake de chocolate', 'Morango', 'Natural',
      'Baunilha', 'Frutas vermelhas', 'Melancia', 'Neutro',
    ]
    const familias = new Set(catalogo.map(f => familiaDoSabor(f)?.valor))
    expect(familias.size).toBe(6)
  })

  it('ignora acento e caixa, porque o texto vem do anúncio', () => {
    expect(familiaDoSabor('LIMÃO')?.valor).toBe('limao')
    expect(familiaDoSabor('café')?.valor).toBe('cafe')
    expect(familiaDoSabor('CHOCOLATE BELGA')?.valor).toBe('chocolate')
  })

  it('ausência de dado não é uma família', () => {
    // `null` e string vazia são "ninguém preencheu", não "sem sabor" — que é
    // uma afirmação do anúncio.
    expect(familiaDoSabor(null)).toBeNull()
    expect(familiaDoSabor('')).toBeNull()
    expect(familiaDoSabor('   ')).toBeNull()
  })

  it('sabor que não casa devolve null em vez de inventar família', () => {
    expect(familiaDoSabor('Tutti-frutti')).toBeNull()
  })

  /*
    A ordem de `SABORES` é regra, não arrumação.

    "Frutas vermelhas" precisa ser testada antes de qualquer família cujo termo
    apareça dentro dela. Hoje nenhuma outra casa, mas a asserção existe para
    que acrescentar "frutas" ou "vermelho" no futuro quebre aqui em vez de
    silenciosamente roubar o rótulo composto.
  */
  it('família composta ganha da genérica que a contém', () => {
    expect(familiaDoSabor('Frutas vermelhas')?.valor).toBe('frutas-vermelhas')
    const posicao = (v: string) => SABORES.findIndex(s => s.valor === v)
    expect(posicao('frutas-vermelhas')).toBeLessThan(posicao('morango'))
  })

  it('nenhum valor de família se repete', () => {
    expect(new Set(SABORES.map(s => s.valor)).size).toBe(SABORES.length)
  })

  it('nenhum termo aparece em duas famílias', () => {
    // Termo repetido faz a família vencedora depender da ordem da lista, o
    // que é exatamente o tipo de dependência invisível que gera bug depois.
    const todos = SABORES.flatMap(s => s.termos)
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('todo termo já está normalizado', () => {
    // A comparação normaliza o texto do anúncio, não o termo. Um termo com
    // acento nunca casaria — e falharia em silêncio.
    for (const s of SABORES) {
      for (const t of s.termos) {
        expect(t, `${s.valor}: "${t}"`).toBe(t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
      }
    }
  })

  it('saborPorValor encontra pelo valor da URL, e só por ele', () => {
    expect(saborPorValor('chocolate')?.rotulo).toBe('Chocolate')
    // O rótulo não serve como valor: a URL usa slug.
    expect(saborPorValor('Chocolate')).toBeNull()
    expect(saborPorValor('inventado')).toBeNull()
  })
})
