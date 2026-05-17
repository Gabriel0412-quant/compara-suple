// Tipos da API do Mercado Livre que usamos.
//
// Estratégia em produção:
//   1. data/items.json lista CATALOG product IDs (formato MLB ou MLBU)
//   2. Para cada catalog_id:
//      - GET /products/{cat_id}            → metadata (nome, marca, atributos, fotos)
//      - GET /products/{cat_id}/items      → lista de OFERTAS (N sellers, com preços)
//   3. Salva 1 product + 1 variant + N offers por catalog_id
//
// Por que esse caminho funciona: /products/{cat_id}/items devolve TODAS as
// ofertas ativas pro catalog product (mesmo quando buy_box_winner está null).
// /items/{id} direto retorna 403 access_denied pro nosso tipo de app.

export type MlAttribute = {
  id: string
  name: string
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

// ---------- /products/{id} ----------

export type MlCatalogProduct = {
  id: string
  catalog_product_id: string
  status: 'active' | 'inactive' | string
  domain_id: string
  name: string
  family_name?: string
  permalink?: string
  pictures?: MlPicture[]
  attributes: MlAttribute[]
  buy_box_winner: null | { item_id: string; price: number; permalink: string }
}

// ---------- /products/{id}/items ----------

/** Uma oferta (seller listing) que está vendendo um catalog product específico. */
export type MlProductItem = {
  item_id: string                    // ex.: 'MLB5872093596'
  site_id: string
  seller_id: number
  price: number
  original_price: number | null
  currency_id: string                // 'BRL'
  category_id: string
  condition: 'new' | 'used' | string
  warranty?: string
  listing_type_id: string            // 'gold_special', 'gold_pro', ...
  tags?: string[]
  official_store_id: number | null   // não-null = loja oficial da marca
  accepts_mercadopago?: boolean
  shipping?: {
    free_shipping?: boolean
    mode?: string
    logistic_type?: string
    tags?: string[]
    cost?: number
  }
  seller_address?: {
    city?: { id?: string; name?: string }
    state?: { id?: string; name?: string }
    neighborhood?: { id?: string; name?: string }
  }
  sale_terms?: Array<{
    id: string
    name: string
    value_id?: string | null
    value_name?: string | null
  }>
  user_product_id?: string
  min_purchase_unit?: number
  international_delivery_mode?: string
}

export type MlProductItemsResponse = {
  paging: { total: number; offset: number; limit: number }
  results: MlProductItem[]
  experiments?: unknown
}

// ---------- /products/search (uso futuro pra descoberta automática se a Amazon liberar) ----------

export type MlCatalogProductSearchResponse = {
  keywords: string
  paging: { total: number; limit: number; offset: number }
  results: Array<{
    id: string
    catalog_product_id: string
    domain_id: string
    name: string
    attributes: MlAttribute[]
  }>
}
