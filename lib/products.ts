import { supabase } from './db'

/**
 * Tipos derivados do schema do Supabase.
 * Mantém shape compatível com o que o ingest popula (lib/ml/ingest.ts).
 */

export type OfferRaw = {
  thumbnail?: string
  product_name?: string
  catalog_id?: string
  seller_id?: number
  official_store_id?: number | null
  original_price?: number | null
  listing_type_id?: string
  warranty?: string
  accepts_mercadopago?: boolean
  shipping?: {
    free_shipping?: boolean
    mode?: string
    logistic_type?: string
    cost?: number
  }
  seller_address?: {
    city?: { id?: string; name?: string }
    state?: { id?: string; name?: string }
  }
  sale_terms?: Array<{
    id: string
    name?: string
    value_id?: string | null
    value_name?: string | null
  }>
} | null

export type Offer = {
  id: number
  external_id: string
  url: string
  price: number
  available: boolean
  fetched_at: string
  raw: OfferRaw
}

export type Variant = {
  id: number
  flavor: string | null
  size_grams: number | null
  offers: Offer[]
}

export type ProductDetail = {
  id: number
  slug: string
  name: string
  brand: { name: string; slug: string | null } | null
  variants: Variant[]
}

/** Busca um produto pelo slug, com todas variantes e ofertas. */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('product')
    .select(`
      id, slug, name,
      brand:brand_id ( name, slug ),
      variants:variant ( id, flavor, size_grams,
        offers:offer ( id, external_id, url, price, available, fetched_at, raw )
      )
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null

  // Normalização defensiva — Supabase pode devolver null em joins
  const variants: Variant[] = (data.variants ?? []).map((v: {
    id: number
    flavor: string | null
    size_grams: number | null
    offers: Offer[] | null
  }) => ({
    id: v.id,
    flavor: v.flavor,
    size_grams: v.size_grams,
    offers: (v.offers ?? []).sort((a, b) => a.price - b.price),
  }))

  const brand = Array.isArray(data.brand) ? (data.brand[0] ?? null) : data.brand

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    brand,
    variants,
  }
}

/** Helper — todas ofertas de todas variantes, ordenadas por preço. */
export function flattenOffers(product: ProductDetail): Offer[] {
  return product.variants
    .flatMap(v => v.offers)
    .sort((a, b) => a.price - b.price)
}

/** Helper — formata número em BRL. */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** Helper — calcula preço por kg (devolve string formatada ou null). */
export function pricePerKg(price: number, sizeGrams: number | null): string | null {
  if (!sizeGrams || sizeGrams <= 0) return null
  const perKg = (price / sizeGrams) * 1000
  return `${formatBRL(perKg)} / kg`
}
