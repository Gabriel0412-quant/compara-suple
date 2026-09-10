import { normalizarTexto } from './busca'

/**
 * Famílias de sabor, para o filtro não repetir a mesma coisa com nomes
 * diferentes.
 *
 * O `flavor` vem do anúncio do Mercado Livre e chega como o vendedor escreveu.
 * Medido em 10/09/2026, o catálogo tinha 9 rótulos para cerca de 6 coisas:
 *
 * ```
 * Sem sabor 7 · Chocolate 6 · Milkshake de chocolate 2 · Morango 2
 * Natural 2 · Baunilha 1 · Frutas vermelhas 1 · Melancia 1 · Neutro 1
 * ```
 *
 * `Sem sabor`, `Natural` e `Neutro` são a mesma ausência de sabor, e
 * `Milkshake de chocolate` é chocolate. Sem agrupar, o filtro nasceria com nove
 * opções em que três devolvem um produto cada — e duas delas, a mesma coisa
 * dita de outro jeito.
 *
 * **O agrupamento é do filtro, não da exibição.** O card continua mostrando o
 * sabor como o anúncio o escreveu: quem procura por chocolate quer ver os dois,
 * mas quem olha o produto tem direito de saber que aquele é o milkshake. Trocar
 * o texto do card seria reescrever o dado; agrupar a busca não é.
 */

export type Sabor = {
  /** Vai para a URL. */
  valor: string
  /** O que a tela mostra. */
  rotulo: string
  /**
   * Termos que caem nesta família, já normalizados. O primeiro que casar
   * decide, então a ordem dentro da lista importa tanto quanto entre famílias.
   */
  termos: string[]
}

/**
 * A ordem é a de especificidade, não a alfabética.
 *
 * `frutas vermelhas` precisa vir antes de qualquer família que case com uma
 * palavra solta, e o mesmo vale para composições futuras. Uma família nova
 * genérica entra no fim; uma específica, antes das que a contêm.
 */
export const SABORES: Sabor[] = [
  {
    valor: 'sem-sabor',
    rotulo: 'Sem sabor',
    termos: ['sem sabor', 'natural', 'neutro', 'sem aroma'],
  },
  { valor: 'frutas-vermelhas', rotulo: 'Frutas vermelhas', termos: ['frutas vermelhas'] },
  { valor: 'chocolate', rotulo: 'Chocolate', termos: ['chocolate', 'cacau'] },
  { valor: 'baunilha', rotulo: 'Baunilha', termos: ['baunilha'] },
  { valor: 'morango', rotulo: 'Morango', termos: ['morango'] },
  { valor: 'melancia', rotulo: 'Melancia', termos: ['melancia'] },
  { valor: 'limao', rotulo: 'Limão', termos: ['limao'] },
  { valor: 'coco', rotulo: 'Coco', termos: ['coco'] },
  { valor: 'cafe', rotulo: 'Café', termos: ['cafe'] },
]

/**
 * A família de um sabor escrito à mão, ou `null` quando nenhuma casa.
 *
 * `null` não é erro: é sabor que o catálogo tem e o filtro ainda não agrupa. O
 * produto continua aparecendo na busca — some só quando alguém filtra por uma
 * família, que é o mesmo tratamento que categoria não reconhecida recebe.
 */
export function familiaDoSabor(flavor: string | null): Sabor | null {
  if (!flavor) return null
  /*
    Não há guarda para texto vazio, e não é esquecimento.

    Uma string só de espaço normaliza para `''`, e `''.includes(termo)` é falso
    para todo termo — o `find` já devolve `undefined` e a função já devolve
    `null`. A guarda que eu tinha escrito aqui era linha morta: nenhum teste
    honesto conseguia distingui-la, porque não há entrada em que ela mude o
    resultado.
  */
  const texto = normalizarTexto(flavor)
  return SABORES.find(s => s.termos.some(t => texto.includes(t))) ?? null
}

/** A família pelo valor que vem da URL. */
export function saborPorValor(valor: string): Sabor | null {
  return SABORES.find(s => s.valor === valor) ?? null
}
