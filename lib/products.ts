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
  ml_rank: number | null    // posição 0-based na resposta /products/{id}/items do ML
  raw: OfferRaw
}

export type Variant = {
  id: number
  flavor: string | null
  size_grams: number | null
  servings: number | null
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
      variants:variant ( id, flavor, size_grams, servings,
        offers:offer ( id, external_id, url, price, available, fetched_at, ml_rank, raw )
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
    servings: number | null
    offers: (Offer & { ml_rank?: number | null })[] | null
  }) => ({
    id: v.id,
    flavor: v.flavor,
    size_grams: v.size_grams,
    servings: v.servings,
    // Ordenação aproxima o buy box do ML (loja oficial primeiro, depois preço).
    // Necessário porque o meli.la redireciona pro catálogo, e o ML destaca
    // a vencedora do buy box independente do que clicamos. Sem isso, o
    // "menor preço" no nosso site não bate com o preço final no ML.
    offers: (v.offers ?? []).sort(compareOffers),
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

/**
 * Helper — todas ofertas de todas variantes, ordenadas exatamente como o ML
 * mostra (via ml_rank). Fallback heurístico pra ofertas legadas sem rank.
 */
export function flattenOffers(product: ProductDetail): Offer[] {
  return product.variants.flatMap(v => v.offers).sort(compareOffers)
}

/**
 * Comparator central — segue o padrão do ML:
 *   1. ml_rank (posição na resposta /products/{id}/items) — fonte de verdade
 *   2. Fallback heurístico pra rows legadas (rank null): oficial primeiro, depois preço
 *
 * Exportado pra reuso em outras camadas (categories, listings, etc) — toda página
 * que precisa decidir "qual oferta destacar" deve usar este comparator.
 *
 * Aceita qualquer objeto com {price, ml_rank, raw.official_store_id} —
 * funciona com queries minimalistas (lite) ou completas (full).
 */
type OfferSortable = {
  price: number
  ml_rank?: number | null
  raw?: { official_store_id?: number | null } | null
}

export function compareOffers(a: OfferSortable, b: OfferSortable): number {
  // Primário: ml_rank do ML
  const aRank = a.ml_rank ?? Number.MAX_SAFE_INTEGER
  const bRank = b.ml_rank ?? Number.MAX_SAFE_INTEGER
  if (aRank !== bRank) return aRank - bRank

  // Fallback (ambos sem rank ou empate): oficial primeiro, depois preço
  const aOfficial = !!a.raw?.official_store_id
  const bOfficial = !!b.raw?.official_store_id
  if (aOfficial && !bOfficial) return -1
  if (!aOfficial && bOfficial) return 1
  return a.price - b.price
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

/** Helper — preço por dose (porção), devolve string formatada ou null. */
export function pricePerDose(price: number, servings: number | null): string | null {
  if (!servings || servings <= 0) return null
  return `${formatBRL(price / servings)} / dose`
}

/** Helper — número bruto de R$/dose, útil pra comparar entre produtos. */
export function pricePerDoseNumber(
  price: number,
  servings: number | null,
): number | null {
  if (!servings || servings <= 0) return null
  return price / servings
}

/**
 * Busca múltiplos produtos por ID, preservando a ordem do array de entrada.
 * Usado pelo comparador (?ids=1,2,3).
 */
export async function getProductsByIds(ids: number[]): Promise<ProductDetail[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('product')
    .select(`
      id, slug, name,
      brand:brand_id ( name, slug ),
      variants:variant ( id, flavor, size_grams, servings,
        offers:offer ( id, external_id, url, price, available, fetched_at, ml_rank, raw )
      )
    `)
    .in('id', ids)

  if (error || !data) return []

  // Mapeia + ordena pela ordem solicitada
  const byId = new Map<number, ProductDetail>()
  for (const row of data) {
    const variants: Variant[] = (row.variants ?? []).map((v: {
      id: number
      flavor: string | null
      size_grams: number | null
      servings: number | null
      offers: (Offer & { ml_rank?: number | null })[] | null
    }) => ({
      id: v.id,
      flavor: v.flavor,
      size_grams: v.size_grams,
      servings: v.servings,
      offers: (v.offers ?? []).sort(compareOffers),
    }))
    const brand = Array.isArray(row.brand) ? (row.brand[0] ?? null) : row.brand
    byId.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      brand,
      variants,
    })
  }
  return ids.map(id => byId.get(id)).filter((p): p is ProductDetail => !!p)
}

/** Versão "lite" pra picker — só info pra exibir o produto + linkar pelo ID. */
export type ProductLite = {
  id: number
  slug: string
  name: string
  brand: string | null
  thumbnail: string | null
  cheapestPrice: number | null
}

export async function getAllProductsLite(): Promise<ProductLite[]> {
  const { data, error } = await supabase
    .from('product')
    .select(`
      id, slug, name,
      brand:brand_id ( name ),
      variants:variant ( offers:offer ( price, ml_rank, raw ) )
    `)
    .order('id', { ascending: true })

  if (error || !data) return []

  // Cast pra shape mínima — Supabase TS infer pode divergir do select; sabemos
  // que cada offer tem ao menos price, ml_rank, raw (foi o que pedimos no select)
  type LiteRow = {
    id: number
    slug: string
    name: string
    brand: { name: string } | { name: string }[] | null
    variants: Array<{
      offers: Array<{
        price: number
        ml_rank: number | null
        raw: { thumbnail?: string; official_store_id?: number | null } | null
      }> | null
    }> | null
  }

  return (data as unknown as LiteRow[]).map(p => {
    const offers = (p.variants ?? []).flatMap(v => v.offers ?? [])
    const sorted = [...offers].sort(compareOffers)
    const featured = sorted[0]
    const brand = Array.isArray(p.brand) ? p.brand[0] : p.brand
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: brand?.name ?? null,
      thumbnail: featured?.raw?.thumbnail ?? null,
      cheapestPrice: featured?.price ?? null,
    }
  })
}
