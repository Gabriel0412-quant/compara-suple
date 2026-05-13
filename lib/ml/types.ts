// Subconjunto dos types da Catalog API do Mercado Livre que usamos no ingest.
// Referência completa: docs/mercado-livre-api-guia.md

export type MlAttribute = {
  id: string                       // "BRAND" | "FLAVOR" | "NET_WEIGHT" | "GTIN" | ...
  name: string                     // rótulo em pt-BR
  value_id?: string | null
  value_name: string | null
}

export type MlSeller = {
  id: number
  nickname: string
}

export type MlShipping = {
  free_shipping: boolean
  logistic_type?: string
  mode?: string
  tags?: string[]
}

export type MlSearchItem = {
  id: string                       // ex.: "MLB1234567890"
  title: string
  condition: 'new' | 'used' | string
  thumbnail: string
  price: number
  original_price: number | null
  currency_id: string
  available_quantity: number
  sold_quantity: number
  permalink: string
  category_id: string
  seller: MlSeller
  shipping: MlShipping
  attributes: MlAttribute[]
}

export type MlSearchResponse = {
  site_id: string
  query: string
  paging: { total: number; offset: number; limit: number; primary_results: number }
  results: MlSearchItem[]
}

export type MlPicture = {
  id: string
  url: string
  secure_url: string
  size?: string
  max_size?: string
}

export type MlItem = {
  id: string
  title: string
  category_id: string
  price: number
  base_price?: number
  original_price?: number | null
  currency_id: string
  available_quantity: number
  sold_quantity: number
  condition: string
  permalink: string
  thumbnail: string
  pictures: MlPicture[]
  attributes: MlAttribute[]
  shipping: MlShipping
  catalog_product_id: string | null
  domain_id: string | null
  date_created: string
  last_updated: string
}

export type MlMultiGetEntry = {
  code: number                     // 200 = ok, 404 = não existe
  body: MlItem
}
