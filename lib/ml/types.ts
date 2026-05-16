// Tipos da Catalog Products API do Mercado Livre.
// Endpoint /sites/MLB/search foi descontinuado (403 mesmo com Bearer).
// Substituto: /products/search + /products/{id}

export type MlAttribute = {
  id: string                       // 'BRAND' | 'FLAVOR' | 'NET_WEIGHT' | 'GTIN' | 'IS_VEGAN' | ...
  name: string                     // rótulo pt-BR
  value_id?: string | null
  value_name: string | null
  values?: Array<{ id: string; name: string; meta?: { value: unknown } }>
  meta?: { value: unknown }
}

/** Item resumido devolvido por /products/search */
export type MlCatalogProductSummary = {
  id: string                       // ex.: 'MLB6238755'
  catalog_product_id: string
  domain_id: string                // ex.: 'MLB-SUPPLEMENTS'
  name: string
  parent_id?: string
  children_ids?: string[]
  attributes: MlAttribute[]
}

export type MlCatalogProductSearchResponse = {
  keywords: string
  paging: { total: number; limit: number; offset: number; last?: string }
  results: MlCatalogProductSummary[]
}

export type MlPicture = {
  id: string
  url: string
}

/** Oferta vencedora (buy box) — pode ser null se não há sellers ativos */
export type MlBuyBoxWinner = {
  item_id: string                  // ID do anúncio específico que ganhou o buy box
  price: number
  original_price?: number | null
  currency_id: string
  permalink: string                // URL do anúncio (usada com tracking de afiliado)
  available_quantity?: number
  sold_quantity?: number
  seller_id: number
  shipping?: { free_shipping?: boolean }
} | null

/** Resposta completa de /products/{id} */
export type MlCatalogProduct = {
  id: string
  catalog_product_id: string
  status: 'active' | 'inactive' | string
  domain_id: string
  name: string
  family_name: string
  type: string                     // 'catalog_product' | ...
  permalink: string
  pictures: MlPicture[]
  attributes: MlAttribute[]
  buy_box_winner: MlBuyBoxWinner
}
