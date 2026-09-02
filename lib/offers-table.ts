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

export type OfferRow = {
  offerId: number
  avatar: string
  avatarColor: string
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

const AVATAR_COLORS = [
  'bg-gray-500',
  'bg-orange-500',
  'bg-purple-600',
  'bg-blue-600',
  'bg-pink-600',
  'bg-cyan-600',
]

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
    avatarColor: isOfficial ? 'bg-green-600' : AVATAR_COLORS[sellerId % AVATAR_COLORS.length],
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
 * O que a linha pode afirmar sobre frete.
 *
 * `free_shipping` do Mercado Livre é um fato da oferta. A ausência dele não é
 * um valor: o frete depende do CEP do visitante e não é calculado aqui — daí
 * "+ frete" e não um total.
 */
export function rotuloFrete(row: Pick<OfferRow, 'freeShipping'>): string {
  return row.freeShipping ? 'frete grátis' : '+ frete'
}
