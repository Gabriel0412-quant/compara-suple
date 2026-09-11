import type { CategoryProduct } from './categories'
import { formatBRL } from './products'

/**
 * Os estados que um card de produto pode assumir.
 *
 * Estavam calculados dentro do JSX de `ProductGridCard`, que é usado em
 * quatro superfícies — home, `/produtos`, `/categoria/[slug]` e `/ofertas`.
 * Cada uma dessas decisões custou um PR para chegar à forma atual, e nenhuma
 * era testável sem renderizar.
 *
 * Aqui elas ficam nomeadas, puras e verificáveis. A renderização continua no
 * componente; o que muda é que a regra passa a ter onde ser exercitada.
 */

export type EstadoDoCard = {
  /** Só quando `original_price` sustenta: precisa existir e ser maior. */
  temDesconto: boolean
  /** Inteiro, já arredondado. Zero quando não há desconto. */
  percentualDesconto: number
  /**
   * Quanto a pessoa deixa de gastar, em reais, na oferta destacada.
   *
   * O percentual sozinho não responde "quanto eu economizo": -13% de R$ 449,90
   * poupa R$ 60,00 e -50% de R$ 99,80 poupa R$ 49,90, e a fileira ordenada por
   * reais lê como se estivesse fora de ordem. Este é o número que a prateleira
   * de maiores descontos usa para ordenar, e até o #227 ele não aparecia em
   * lugar nenhum do site.
   *
   * `null` — e não zero — quando não há desconto: é a mesma ausência que
   * `temDesconto` descreve, e zero seria um valor a formatar e exibir.
   */
  economia: number | null
  /**
   * Preço por dose, ou por quilo, ou `null`.
   *
   * Comparar suplemento por preço absoluto engana quando as embalagens têm
   * tamanhos diferentes. Quando não há dose nem peso, é `null` — e a tela diz
   * isso em vez de omitir, porque a ausência do número é informação.
   */
  precoNormalizado: string | null
  /**
   * Se vale mostrar a linha de menor preço.
   *
   * Só quando ela contradiz o destaque. O preço grande do card é o da oferta
   * que o Mercado Livre promove, que em 7 de 13 variantes não era a mais
   * barata — chamar o destaque de "menor preço" era falso.
   */
  temMaisBarata: boolean
  /** Se há para onde mandar o clique de saída. */
  temSaida: boolean
}

/*
  Sobre as duas guardas de `null` marcadas abaixo.

  Elas existem para o TypeScript, não para o comportamento. Em JavaScript
  `null` vira `0` em comparação relacional, então `null > 100` já é `false` e
  `null > 0` também — a guarda é redundante em tempo de execução, e o Stryker
  mostra isso trocando `x !== null &&` por `true &&` sem nenhum teste
  conseguir notar.

  Não dá para removê-las: sem a guarda o compilador recusa comparar
  `number | null` com `number`. E não dá para matar o mutante com teste: para
  `sizeGrams` nenhum valor distingue as duas versões, e para o preço só
  distinguiria um `featuredPrice` negativo, que não existe no domínio e cujo
  teste documentaria uma situação impossível em vez de uma regra.

  Ficam anotadas, com o motivo, em vez de virarem teste contrafeito.
*/
export function estadoDoCard(product: CategoryProduct): EstadoDoCard {
  const original = product.featuredOriginalPrice
  // Stryker disable next-line ConditionalExpression
  const temDesconto = original !== null && original > product.featuredPrice

  return {
    temDesconto,
    percentualDesconto: temDesconto
      ? Math.round((1 - product.featuredPrice / original) * 100)
      : 0,
    economia: temDesconto ? original - product.featuredPrice : null,
    precoNormalizado:
      product.featuredPerDose !== null
        ? `${formatBRL(product.featuredPerDose)}/dose`
        : // Stryker disable next-line ConditionalExpression
          product.sizeGrams !== null && product.sizeGrams > 0
          ? `${formatBRL((product.featuredPrice / product.sizeGrams) * 1000)}/kg`
          : null,
    temMaisBarata:
      product.lowestPrice !== null &&
      product.lowestOfferId !== null &&
      product.lowestPrice < product.featuredPrice,
    temSaida: product.featuredOfferId !== null,
  }
}
