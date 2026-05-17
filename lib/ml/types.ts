// Tipos da API do Mercado Livre que usamos.
//
// IMPORTANTE: usamos DOIS endpoints com formatos diferentes:
//   - /products/search + /products/{id}  → catalog products (rica em metadata, mas
//                                           SEM preço/oferta — buy_box_winner vem null)
//   - /items/{id} ou /items?ids=A,B,C   → anúncios específicos de sellers
//                                           (TEM preço, seller, permalink)
//
// O ingest atual usa SÓ /items/{id} a partir de uma lista curada em data/items.json
// porque /products/search não devolve buy_box_winner pro nosso tipo de app.

export type MlAttribute = {
  id: string                       // 'BRAND' | 'FLAVOR' | 'NET_WEIGHT' | 'GTIN' | 'IS_VEGAN' | ...
  name: string                     // rótulo pt-BR
  value_id?: string | null
  value_name: string | null
  values?: Array<{ id: string; name: string; meta?: { value: unknown } }>
  meta?: { value: unknown }
}

export type MlPicture = {
  id: string
  url: string
  secure_url?: string
}

export type MlShipping = {
  free_shipping?: boolean
  mode?: string
  logistic_type?: string
  tags?: string[]
}

// ---------- /items/{id} ----------

/** Anúncio específico de um seller. Tem preço, é o que importa pro comparador. */
export type MlItem = {
  id: string                       // ex.: 'MLB5872093596'
  title: string
  category_id: string
  price: number
  base_price?: number
  original_price?: number | null
  currency_id: string              // 'BRL'
  available_quantity: number
  sold_quantity: number
  condition: 'new' | 'used' | string
  permalink: string                // URL pública (recebe ?affiliate=tag)
  thumbnail: string
  pictures: MlPicture[]
  attributes: MlAttribute[]
  shipping: MlShipping
  catalog_product_id?: string | null
  domain_id?: string | null
  status: 'active' | 'paused' | 'closed' | string
  seller_id: number
  official_store_id?: number | null
  date_created: string
  last_updated: string
}

export type MlMultiGetEntry = {
  code: number                     // 200 = ok, 404 = não existe
  body: MlItem
}

// ---------- /products/search + /products/{id} (uso futuro / enriquecimento) ----------

export type MlCatalogProductSummary = {
  id: string
  catalog_product_id: string
  domain_id: string
  name: string
  attributes: MlAttribute[]
}

export type MlCatalogProductSearchResponse = {
  keywords: string
  paging: { total: number; limit: number; offset: number }
  results: MlCatalogProductSummary[]
}

export type MlCatalogProduct = {
  id: string
  catalog_product_id: string
  status: 'active' | 'inactive' | string
  domain_id: string
  name: string
  family_name: string
  permalink: string
  pictures: MlPicture[]
  attributes: MlAttribute[]
  buy_box_winner: null | {
    item_id: string
    price: number
    currency_id: string
    permalink: string
  }
}
