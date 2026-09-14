import { formatCount } from './stats'
import type { Offer } from './products'

/**
 * Modelo de linha da tabela de ofertas e as decisões que ela toma.
 *
 * Extraído de OffersSection para poder ser testado sem DOM. O que quebrou
 * antes aqui foi lógica, não marcação: o selo de menor preço vinha da posição
 * na ordenação escolhida, e a coluna TOTAL repetia o preço do item sob um
 * rótulo que prometia frete somado.
 */

export type SortBy = 'featured' | 'preco' | 'discount'

/**
 * Quantas ofertas a tabela mostra antes do "ver mais".
 *
 * A maquete 1c desenha três linhas e um "Ver mais 1 loja", pressupondo um
 * punhado de lojas. O catálogo real não é assim: a mediana é 9 ofertas por
 * produto, mas a creatina 300 g da Integralmédica tem 544 e o whey da DUX tem
 * 131. Sem teto, a página do DUX media 19.160px de altura e a tabela era 96%
 * dela — a caixa de preço fixa, que é a razão de ser da 1c, acompanhava a
 * rolagem de um documento que ninguém ia rolar.
 *
 * Dez porque é o que cabe numa tela e cobre a mediana: 8 dos 15 produtos com
 * oferta ativa mostram tudo sem botão nenhum. Os outros 7 ganham uma linha
 * dizendo quantas faltam — o número continua visível, o que muda é ter que
 * pedir para vê-las.
 */
export const OFERTAS_VISIVEIS = 10

export type OfferRow = {
  offerId: number
  /** Duas letras para o quadrado da linha. Não é logo: não temos os logos. */
  avatar: string
  nome: string
  isOfficial: boolean
  freeShipping: boolean
  isFulfillment: boolean
  preco: number
  originalPrice: number | null
  entrega: string
  city: string | null
  state: string | null
  url: string
}

export type OfferFilters = {
  onlyFreeShipping: boolean
  onlyOfficial: boolean
  onlyFull: boolean
}

/*
  A cor do avatar saiu no #163.

  Era um círculo pintado com uma das seis cores da paleta padrão do Tailwind,
  sorteada por `seller_id % 6`. Parecia identidade visual de um vendedor sem
  ser a de nenhum, e é exatamente o que o #151 proibiu: cartão nosso não se
  veste com cor que não é nossa. O quadrado agora é neutro, com as iniciais.
*/

function derivaEntrega(logisticType: string | undefined): string {
  if (logisticType === 'fulfillment')   return '1–2 dias (Full)'
  if (logisticType === 'cross_docking') return '2–4 dias'
  if (logisticType === 'xd_drop_off')   return '3–5 dias'
  if (logisticType === 'drop_off')      return '4–7 dias'
  return '3–7 dias'
}

export function offerToRow(offer: Offer): OfferRow {
  const isOfficial   = !!offer.raw?.official_store_id
  const freeShipping = !!offer.raw?.shipping?.free_shipping
  const sellerId     = offer.raw?.seller_id ?? 0
  const city         = offer.raw?.seller_address?.city?.name ?? null
  const state        = offer.raw?.seller_address?.state?.name ?? null
  return {
    offerId: offer.id,
    avatar: isOfficial ? 'OF' : (city?.slice(0, 2).toUpperCase() ?? 'V'),
    nome: isOfficial ? 'Loja Oficial' : (city ? `Vendedor em ${city}` : `Vendedor #${sellerId}`),
    isOfficial,
    freeShipping,
    isFulfillment: offer.raw?.shipping?.logistic_type === 'fulfillment',
    preco: offer.price,
    originalPrice: offer.raw?.original_price ?? null,
    entrega: derivaEntrega(offer.raw?.shipping?.logistic_type),
    city,
    state,
    url: offer.url,
  }
}

export function filtrarRows(rows: readonly OfferRow[], f: OfferFilters): OfferRow[] {
  let list = [...rows]
  if (f.onlyFreeShipping) list = list.filter(r => r.freeShipping)
  if (f.onlyOfficial)     list = list.filter(r => r.isOfficial)
  if (f.onlyFull)         list = list.filter(r => r.isFulfillment)
  return list
}

export function ordenarRows(rows: readonly OfferRow[], sortBy: SortBy): OfferRow[] {
  // 'featured' preserva a ordem que o servidor entregou: oficial → preço.
  if (sortBy === 'featured') return [...rows]
  return [...rows].sort((a, b) => {
    if (sortBy === 'discount') {
      const dA = a.originalPrice ? (1 - a.preco / a.originalPrice) : 0
      const dB = b.originalPrice ? (1 - b.preco / b.originalPrice) : 0
      return dB - dA
    }
    return a.preco - b.preco
  })
}

/**
 * A linha mais barata entre as visíveis.
 *
 * Calculada sobre as linhas filtradas, nunca sobre a posição na ordenação:
 * filtrar é uma escolha legítima do usuário sobre QUAIS ofertas comparar;
 * ordenar não deveria mudar qual é a mais barata.
 */
export function menorPrecoRow(rows: readonly OfferRow[]): OfferRow | null {
  if (rows.length === 0) return null
  return rows.reduce((menor, r) => (r.preco < menor.preco ? r : menor))
}

/**
 * Quais linhas a tabela mostra fechada — as primeiras, MAIS a mais barata.
 *
 * O teto sozinho tem um efeito que só apareceu no teste: a ordem padrão é a do
 * Mercado Livre, e nela a oferta mais barata pode estar em qualquer posição.
 * Cortando nas dez primeiras, a página exibia "menor preço R$ 1,00" na caixa
 * fixa e nenhuma das linhas visíveis tinha esse preço — o selo "MENOR PREÇO"
 * ficava numa linha que só existia depois de clicar em "ver mais".
 *
 * Então ela entra, mesmo cortada, como décima primeira linha. Fora de ordem de
 * propósito: a ordem é a do ML e alterá-la mentiria sobre o que o ML destaca;
 * o que a lista passa a dizer é "as dez que o ML põe na frente, e a mais
 * barata". Quem ordena por preço não vê diferença nenhuma — ali ela já é a
 * primeira.
 */
export function linhasVisiveis(rows: readonly OfferRow[], teto: number): OfferRow[] {
  const primeiras = rows.slice(0, teto)
  const barata = menorPrecoRow(rows)
  if (!barata || primeiras.some(r => r.offerId === barata.offerId)) return primeiras
  return [...primeiras, barata]
}

/** Quantas linhas ficam atrás do "ver mais". Zero quando cabem todas. */
export function ofertasOcultas(rows: readonly OfferRow[], teto: number): number {
  return rows.length - linhasVisiveis(rows, teto).length
}

/**
 * O que o botão de abrir a lista diz.
 *
 * Mora aqui, e não no JSX, porque o rótulo fechado é a informação: 121 ofertas
 * escondidas e 2 escondidas são decisões diferentes para quem está comparando,
 * e "ver mais" não distingue as duas. Fora do componente, as três frases têm
 * teste — dentro dele, a de "Mostrar menos" só existiria depois de um clique.
 */
export function rotuloDeMaisOfertas(ocultas: number, aberto: boolean): string {
  if (aberto) return 'Mostrar menos'
  return ocultas === 1 ? 'Ver mais 1 oferta' : `Ver as outras ${formatCount(ocultas)} ofertas`
}

/**
 * O que a linha pode afirmar sobre frete.
 *
 * `free_shipping` do Mercado Livre é um fato da oferta. A ausência dele não é
 * um valor: o frete depende do CEP do visitante e não é calculado aqui — daí
 * "+ frete" e não um total.
 */
export function rotuloFrete(row: Pick<OfferRow, 'freeShipping'>): string {
  return row.freeShipping ? 'frete grátis' : '+ frete'
}
