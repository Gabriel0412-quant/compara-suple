import type { TomDeMarca } from '@/lib/brands'

/**
 * Tom da marca → classe de fundo.
 *
 * Escrito por extenso, e não interpolado.
 *
 * `bg-${tom}` não funciona e falha em silêncio: o Tailwind varre o código em
 * busca de nomes de classe literais, e uma classe montada em tempo de execução
 * não é gerada. O elemento sai transparente, sem erro de build nem de tipo — o
 * que já aconteceu neste próprio arquivo antes de ele existir.
 *
 * Fica separado porque a faixa da home (#152) e o índice `/marcas` (#153)
 * precisam do mesmo mapa. Duas cópias significariam dois lugares para o
 * desenho divergir.
 *
 * O `Record` completo é o que garante que nenhum tom fique de fora: acrescentar
 * uma entrada em `TONS_DE_MARCA` sem mapeá-la aqui não compila.
 */
export const CLASSE_DO_TOM: Record<TomDeMarca, string> = {
  'surface-dark': 'bg-surface-dark',
  'brand-strong': 'bg-brand-strong',
  'surface-darker': 'bg-surface-darker',
  'brand-deep': 'bg-brand-deep',
  'surface-dark-raised': 'bg-surface-dark-raised',
  'brand-ink': 'bg-brand-ink',
}

/**
 * Monograma da marca: até duas iniciais.
 *
 * Serve como âncora visual no índice, onde o cartão colorido da home não
 * cabe. Não é logo, e por isso são letras da própria tipografia — nada aqui
 * imita identidade de terceiro.
 */
export function iniciaisDaMarca(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(palavra => palavra[0]?.toUpperCase() ?? '')
    .join('')
}
