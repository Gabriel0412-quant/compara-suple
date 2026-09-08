import {
  getAllProductCards,
  getCategoryBySlug,
  produtoCasaCategoria,
  type Category,
  type CategoryProduct,
} from './categories'
import { buildCompararUrl, destacarMelhor, type MotivoSemDestaque } from './comparador'
import { CATEGORIAS_DA_HOME } from './shelves'

/**
 * O bloco comparador da home: três produtos da mesma categoria, lado a lado.
 *
 * A maquete 1b o chama de "Mesma proteína, preço por dose diferente". A ideia
 * é mostrar, em três cartões, que produtos equivalentes divergem no preço
 * normalizado — que é a tese do produto inteiro.
 *
 * A regra de destaque não é reimplementada aqui: usa `destacarMelhor` do
 * `lib/comparador.ts`, o mesmo que a página `/comparar` usa. Se as duas telas
 * decidissem separado, a home poderia coroar um vencedor que o comparador se
 * recusa a coroar — e a recusa é justamente a parte que custou a ser
 * conquistada.
 */

/** Quantos cartões o bloco mostra. Três, como na maquete. */
export const ITENS_DO_COMPARADOR = 3

export type ItemComparado = {
  produto: CategoryProduct
  precoPorDose: number | null
  precoPorKg: number | null
  /**
   * Ofertas ativas, e o campo se chama assim de propósito.
   *
   * A maquete rotula esta linha como "Lojas". Enquanto só houver Mercado
   * Livre, este número conta **anúncios do mesmo marketplace**, não lojas
   * distintas — não temos fonte que identifique o vendedor por trás de cada
   * anúncio. Chamar de "lojas" seria contar uma coisa e dizer outra. Quando o
   * EP06 trouxer a Amazon, aí sim haverá lojas para contar.
   */
  ofertas: number
}

export type ComparadorDaHome = {
  categoria: Category
  /** Exatamente `ITENS_DO_COMPARADOR`. */
  itens: ItemComparado[]
  /** Índices com o melhor R$/kg. Vazio quando não há vencedor legítimo. */
  melhorPorKg: number[]
  /** Por que não houve destaque, quando não houve. */
  motivoSemDestaque: MotivoSemDestaque | null
  /** `/comparar` já com os três pré-selecionados. */
  urlDoComparador: string
}

/** R$/kg a partir do preço destacado e do peso. `null` sem peso utilizável. */
export function precoPorKg(produto: CategoryProduct): number | null {
  const gramas = produto.sizeGrams
  /*
    A guarda de `null` existe para o compilador, não para o comportamento —
    mesma situação de `lib/card.ts`. Em JavaScript `null <= 0` já é `true`,
    então `gramas <= 0` sozinho devolveria `null` do mesmo jeito, e o Stryker
    mostra isso trocando a condição por `false ||` sem nenhum teste notar.

    Removê-la não é opção: sem ela o TypeScript recusa as duas linhas
    seguintes com "'gramas' is possibly 'null'".
  */
  // Stryker disable next-line ConditionalExpression
  if (gramas === null || gramas <= 0) return null
  return (produto.featuredPrice / gramas) * 1000
}

/**
 * Quem pode entrar no bloco.
 *
 * Exige peso informado, porque o critério do selo é R$/kg: um produto sem peso
 * nunca poderia vencer nem perder, e ocuparia um dos três cartões com uma
 * linha vazia. Exige oferta comprável pelo mesmo motivo do #53 — produto sem
 * destino não ajuda a decidir nada.
 *
 * Dose não é exigida: quando falta, o cartão diz que falta, como o resto do
 * site já faz.
 */
export function elegivel(produto: CategoryProduct): boolean {
  return produto.offerCount > 0 && precoPorKg(produto) !== null
}

/**
 * A ordem de escolha dos três, declarada.
 *
 * Mais ofertas ativas primeiro: entre produtos equivalentes, comparar os que
 * têm mais anúncios é o que dá lastro ao número. Desempate por nome, para a
 * seleção não herdar a ordem em que o banco respondeu — mesma razão do #151 e
 * do #154.
 *
 * O critério aparece no texto do bloco (#157). Seleção que o leitor não
 * entende parece favorecimento.
 */
export function compararParaSelecao(a: CategoryProduct, b: CategoryProduct): number {
  return b.offerCount - a.offerCount || a.name.localeCompare(b.name, 'pt-BR')
}

/**
 * Monta o bloco, ou devolve `null`.
 *
 * `null` quando nenhuma categoria da home tem três produtos elegíveis. O #157
 * remove o bloco nesse caso: três cartões com dois produtos e um buraco, ou
 * uma comparação de dois chamada de comparação de três, seria inventar.
 */
export function montarComparadorDaHome(
  cards: CategoryProduct[],
  slugs: readonly string[] = CATEGORIAS_DA_HOME,
): ComparadorDaHome | null {
  for (const slug of slugs) {
    const categoria = getCategoryBySlug(slug)
    if (!categoria) throw new Error(`CATEGORIAS_DA_HOME cita "${slug}", que não existe`)

    const candidatos = cards
      .filter(card => produtoCasaCategoria(card.name, categoria))
      .filter(elegivel)

    if (candidatos.length < ITENS_DO_COMPARADOR) continue

    const escolhidos = [...candidatos].sort(compararParaSelecao).slice(0, ITENS_DO_COMPARADOR)
    const itens: ItemComparado[] = escolhidos.map(produto => ({
      produto,
      precoPorDose: produto.featuredPerDose,
      precoPorKg: precoPorKg(produto),
      ofertas: produto.offerCount,
    }))

    const destaque = destacarMelhor(itens.map(i => i.precoPorKg), 'min')

    return {
      categoria,
      itens,
      melhorPorKg: destaque.indices,
      motivoSemDestaque: destaque.motivo,
      urlDoComparador: buildCompararUrl(itens.map(i => i.produto.id)),
    }
  }

  return null
}

// Stryker disable all
export async function comparadorDaHome(): Promise<ComparadorDaHome | null> {
  return montarComparadorDaHome(await getAllProductCards())
}
// Stryker restore all
