import { formatBRL, pricePerDose, pricePerKg, type Offer, type ProductDetail } from './products'
import type { CategoryProduct } from './categories'

/**
 * O estado da página de produto, fora do JSX.
 *
 * Mesma divisão de `lib/card.ts`: a regra fica pura e exercitável, e o
 * componente só decide onde cada coisa aparece. A página anterior calculava
 * tudo dentro do `return`, com desconto, R$/dose, rótulo de vendedor e data de
 * coleta misturados ao layout — nada disso tinha teste, e metade era mock.
 *
 * A maquete 1c pede quatro coisas desta camada: qual preço vai na caixa fixa,
 * qual oferta contradiz esse preço, o que cabe nos azulejos de métrica e há
 * quanto tempo o dado foi coletado.
 */

/** Um azulejo de métrica ao lado do nome, como na maquete 1c. */
export type Metrica = {
  rotulo: string
  valor: string
  /** O primeiro azulejo é quente: é a tese do produto. */
  destaque: boolean
}

export type EstadoDoProduto = {
  /**
   * A oferta mais barata entre as disponíveis. É ela que a caixa fixa mostra e
   * para onde o botão principal manda.
   *
   * A maquete 1c rotula essa caixa "MENOR PREÇO HOJE", e é uma escolha de
   * produto, não de layout: quem chega nesta página já escolheu o produto e
   * está decidindo onde comprar. O card das listagens continua liderando pelo
   * destaque do Mercado Livre, com o menor preço nomeado embaixo — os dois
   * números aparecem nas duas telas, o que muda é qual leva o clique.
   */
  menor: Offer
  /**
   * A oferta que o Mercado Livre promove, **quando é outra**.
   *
   * `null` quando o ML destaca a mais barata, que é o caso feliz e não merece
   * uma linha dizendo o óbvio. Quando difere, a página nomeia as duas — é a
   * regra que o CLAUDE.md chama de "menor preço ≠ destaque", e em 7 de 13
   * variantes medidas o destaque era mais caro.
   */
  destaque: Offer | null
  totalOfertas: number
  /** `original_price` do anúncio mais barato, quando ele sustenta desconto. */
  precoOriginal: number | null
  temDesconto: boolean
  /** Inteiro já arredondado. Zero quando não há desconto. */
  percentualDesconto: number
  /** Reais que deixam de ser gastos. `null` — não zero — quando não há desconto. */
  economia: number | null
  /** Azulejos com dado. Vazio quando o anúncio não informa dose nem peso. */
  metricas: Metrica[]
  /** "33 doses de 30 g", "1 kg", ou `null` quando não há nem peso nem doses. */
  embalagem: string | null
  /** A coleta mais recente entre as ofertas deste produto. */
  ultimaColeta: Date | null
  thumbnail: string | null
}

/*
  Sobre as guardas de `null` marcadas neste arquivo.

  Existem para o TypeScript, não para o comportamento. Em JavaScript `null`
  vira `0` em comparação relacional, então `null <= 0` já é `true` e `null > 0`
  já é `false` — a guarda é redundante em tempo de execução, e o Stryker mostra
  isso trocando `x !== null &&` por `true &&` sem nenhum teste conseguir notar.

  Não dá para removê-las: sem a guarda o compilador recusa comparar
  `number | null` com `number`. E não dá para matar o mutante com teste, porque
  nenhum valor do domínio distingue as duas versões. É a mesma decisão já
  registrada em `lib/card.ts`, e pelo mesmo motivo.
*/

/** "1 kg", "900 g", ou `null`. */
export function pesoLegivel(sizeGrams: number | null): string | null {
  // Stryker disable next-line ConditionalExpression
  if (sizeGrams === null || sizeGrams <= 0) return null
  return sizeGrams >= 1000 ? `${sizeGrams / 1000} kg` : `${sizeGrams} g`
}

/**
 * A linha de embalagem do topo: "33 doses de 30 g".
 *
 * O peso da dose é divisão de dois campos do próprio anúncio, arredondada ao
 * grama — e só aparece quando os dois existem. Com doses e sem peso, diz só as
 * doses; com peso e sem doses, diz só o peso. Sem nenhum dos dois é `null`, e
 * a página escreve que o anúncio não informou, como fazem os cards.
 */
export function linhaDeEmbalagem(
  servings: number | null,
  sizeGrams: number | null,
): string | null {
  const peso = pesoLegivel(sizeGrams)
  // Stryker disable next-line ConditionalExpression
  const temDoses = servings !== null && servings > 0

  if (temDoses && peso !== null) {
    return `${servings} doses de ${Math.round(sizeGrams! / servings)} g`
  }
  if (temDoses) return `${servings} doses`
  return peso
}

/**
 * Os azulejos de métrica, na ordem da maquete.
 *
 * A maquete 1c desenha três — R$/dose, R$/kg e "por 24 g de proteína". O
 * terceiro não existe: não há coluna de proteína no catálogo, e inventá-la é
 * exatamente o que o EP15 vai resolver. Sobram os dois que têm origem, e a
 * grade se ajusta a quantos vierem.
 *
 * Saem do preço da caixa fixa, e não do destaque do ML, porque é o preço que
 * a página está apresentando — dois números na mesma tela derivados de preços
 * diferentes seria a incoerência que o #199 e o #226 custaram para tirar dos
 * cards.
 */
export function metricasDoProduto(
  preco: number,
  servings: number | null,
  sizeGrams: number | null,
): Metrica[] {
  const metricas: Metrica[] = []

  const porDose = pricePerDose(preco, servings)
  if (porDose !== null) {
    metricas.push({ rotulo: 'R$ / dose', valor: porDose.replace(' / dose', ''), destaque: true })
  }

  const porKg = pricePerKg(preco, sizeGrams)
  if (porKg !== null) {
    metricas.push({
      rotulo: 'R$ / kg',
      valor: porKg.replace(' / kg', ''),
      // Só é a tese quando não há dose: aí o peso é o único normalizador.
      destaque: metricas.length === 0,
    })
  }

  return metricas
}

/**
 * A coleta mais recente entre as ofertas do produto.
 *
 * Sai das próprias ofertas desta tela, e não de uma consulta ao catálogo
 * inteiro: é o dado que descreve o que está sendo mostrado aqui, e evita uma
 * query a mais por página. Data inválida é ignorada em vez de virar `NaN` na
 * comparação, que devolveria `false` nos dois sentidos e travaria o acumulador
 * na primeira oferta.
 */
export function ultimaColetaDe(offers: readonly Offer[]): Date | null {
  /*
    Por timestamp, e não por `Date` num acumulador.

    A versão com `reduce` sobre `Date | null` precisava de duas guardas — uma
    para o acumulador vazio e outra para a comparação — e as duas eram
    redundantes em tempo de execução: `data > null` já é verdadeiro para
    qualquer data depois de 1970, que é toda data que este domínio tem. Elas
    passavam pelo Stryker sem que nenhum teste do domínio pudesse matá-las.
    Com números, `Math.max` faz a escolha e a única guarda que sobra — lista
    vazia — é a que tem caso de teste.
  */
  const tempos = offers.map(o => new Date(o.fetched_at).getTime()).filter(t => !Number.isNaN(t))
  return tempos.length === 0 ? null : new Date(Math.max(...tempos))
}

/**
 * Monta o estado a partir das ofertas disponíveis, já ordenadas.
 *
 * Recebe a lista pronta em vez de chamar `flattenOffers`: quem chama já a tem
 * (a tabela de ofertas usa a mesma), e assim esta função não precisa de banco
 * nem de `ProductDetail` inteiro para ser testada.
 *
 * `null` quando não há oferta disponível — a página tem um estado próprio para
 * isso, e devolver um estado com preço zero seria pior que devolver nada.
 */
export function estadoDoProduto(
  offers: readonly Offer[],
  { servings, sizeGrams }: { servings: number | null; sizeGrams: number | null },
): EstadoDoProduto | null {
  if (offers.length === 0) return null

  const menor = maisBarata(offers)
  const promovida = offers[0]
  const original = menor.raw?.original_price ?? null
  // Stryker disable next-line ConditionalExpression
  const temDesconto = original !== null && original > menor.price

  return {
    menor,
    // Mesma oferta não é contradição: a linha só existe quando há o que separar.
    destaque: promovida.id === menor.id ? null : promovida,
    totalOfertas: offers.length,
    precoOriginal: original,
    temDesconto,
    percentualDesconto: temDesconto ? Math.round((1 - menor.price / original) * 100) : 0,
    economia: temDesconto ? original - menor.price : null,
    metricas: metricasDoProduto(menor.price, servings, sizeGrams),
    embalagem: linhaDeEmbalagem(servings, sizeGrams),
    ultimaColeta: ultimaColetaDe(offers),
    thumbnail: menor.raw?.thumbnail ?? promovida.raw?.thumbnail ?? null,
  }
}

/**
 * A mais barata, com desempate estável.
 *
 * `lowestPriceOffer` de `lib/products.ts` faz o mesmo e aceita ofertas
 * indisponíveis na entrada; aqui a lista já vem filtrada por `flattenOffers`, e
 * o que importa é o desempate — preço, depois a ordem do ML, depois id. Sem
 * ele, dois anúncios pelo mesmo valor trocam de lugar entre renderizações
 * conforme a ordem em que o Postgres respondeu.
 */
function maisBarata(offers: readonly Offer[]): Offer {
  return offers.reduce((melhor, o) => {
    /*
      Cada comparação abaixo já está guardada pela desigualdade da linha
      anterior, então trocar `<` por `<=` não muda resultado nenhum: dentro do
      `if (o.price !== melhor.price)` os preços nunca são iguais, e dentro do
      `if (rank !== 0)` os ranks nunca são. O último compara `offer.id`, que é
      chave primária — dois elementos do mesmo `reduce` não têm o mesmo id.
      São três mutantes equivalentes, e matá-los exigiria fixture de um estado
      que o banco não produz.
    */
    // Stryker disable EqualityOperator
    if (o.price !== melhor.price) return o.price < melhor.price ? o : melhor
    const rank = (o.ml_rank ?? Number.MAX_SAFE_INTEGER) - (melhor.ml_rank ?? Number.MAX_SAFE_INTEGER)
    if (rank !== 0) return rank < 0 ? o : melhor
    return o.id < melhor.id ? o : melhor
    // Stryker restore EqualityOperator
  })
}

/**
 * Como nomear o vendedor de uma oferta.
 *
 * O ML não devolve o nome da loja no snapshot que guardamos; devolve
 * `official_store_id` e o endereço do vendedor. Com isso dá para dizer se é
 * loja oficial e de onde despacha — nada além. Inventar um nome a partir do
 * `seller_id` seria afirmar identidade que não temos.
 */
export function vendedorDaOferta(offer: Offer): string {
  if (offer.raw?.official_store_id) return 'Loja oficial no Mercado Livre'
  const cidade = offer.raw?.seller_address?.city?.name
  return cidade ? `Vendedor em ${cidade}` : 'Vendedor no Mercado Livre'
}

/**
 * Os relacionados do pé da página: mesma categoria, menor R$/dose primeiro.
 *
 * A maquete 1c chama a faixa de "Whey mais barato por dose", e o critério
 * precisa ser esse mesmo — a prateleira da home ordena por preço de etiqueta,
 * que é a comparação que este produto existe para recusar.
 *
 * Produto sem dose informada não entra: ele não tem como ocupar uma fileira
 * cujo título promete ordem por dose. Continua alcançável pela categoria.
 */
export function relacionadosPorDose(
  cards: readonly CategoryProduct[],
  slugAtual: string,
  limite: number,
): CategoryProduct[] {
  return cards
    .filter(c => c.slug !== slugAtual && c.featuredPerDose !== null)
    .sort(
      (a, b) =>
        a.featuredPerDose! - b.featuredPerDose! ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
    .slice(0, limite)
}

/** A economia em texto, para a caixa fixa. `null` quando não há desconto. */
export function textoDaEconomia(economia: number | null): string | null {
  return economia === null ? null : `Economiza ${formatBRL(economia)}`
}

export type { ProductDetail }
