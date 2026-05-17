import { getProduct, getProductItems } from './client'
import { buildMlCatalogLink } from '../affiliate'
import { supabaseAdmin } from '../db-admin'
import type { MlAttribute, MlCatalogProduct, MlProductItem } from './types'
import itemsData from '@/data/items.json'

const ML_STORE_SLUG = 'mercado-livre'

// ---------- carregar lista curada ----------

type RawCatalog =
  | string
  | { catalog_id?: string; id?: string; nota?: string }

function loadCatalogIds(): string[] {
  const raw = (itemsData as { items: RawCatalog[] }).items
  const ids: string[] = []
  for (const entry of raw) {
    const id = typeof entry === 'string' ? entry : entry.catalog_id ?? entry.id
    if (typeof id === 'string' && /^MLB(U)?[A-Z0-9]+$/i.test(id)) {
      ids.push(id)
    }
  }
  return ids
}

// ---------- helpers ----------

function getAttr(attrs: MlAttribute[], id: string): string | null {
  return attrs.find(a => a.id === id)?.value_name ?? null
}

function parseGrams(value: string | null): number | null {
  if (!value) return null
  const m = value.match(/([\d.,]+)\s*(g|kg)\b/i)
  if (!m) return null
  const num = parseFloat(m[1].replace(',', '.'))
  if (Number.isNaN(num)) return null
  return m[2].toLowerCase() === 'kg' ? num * 1000 : num
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

// ---------- upserts ----------

async function getStoreId(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('store')
    .select('id')
    .eq('slug', ML_STORE_SLUG)
    .single()
  if (error || !data) {
    throw new Error(
      `Store '${ML_STORE_SLUG}' não encontrada. Rode 0001_initial_schema.sql no Supabase.`,
    )
  }
  return data.id as number
}

async function upsertBrand(name: string): Promise<number> {
  const slug = slugify(name) || 'sem-marca'
  const { data, error } = await supabaseAdmin
    .from('brand')
    .upsert({ slug, name }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (error) throw error
  return data!.id as number
}

async function upsertProduct(opts: {
  catalogId: string
  name: string
  brandId: number
}): Promise<number> {
  // slug determinístico por catalogId — sobreviver a mudanças de nome
  const slug = slugify(`${opts.name}-${opts.catalogId}`)
  const { data, error } = await supabaseAdmin
    .from('product')
    .upsert(
      { slug, name: opts.name, brand_id: opts.brandId },
      { onConflict: 'slug' },
    )
    .select('id')
    .single()
  if (error) throw error
  return data!.id as number
}

async function upsertVariant(opts: {
  productId: number
  flavor: string | null
  sizeGrams: number | null
}): Promise<number> {
  let q = supabaseAdmin
    .from('variant')
    .select('id')
    .eq('product_id', opts.productId)
  q = opts.flavor    ? q.eq('flavor', opts.flavor)    : q.is('flavor', null)
  q = opts.sizeGrams ? q.eq('size_grams', opts.sizeGrams) : q.is('size_grams', null)
  const { data: existing } = await q.maybeSingle()
  if (existing) return existing.id as number

  const { data, error } = await supabaseAdmin
    .from('variant')
    .insert({
      product_id: opts.productId,
      flavor: opts.flavor,
      size_grams: opts.sizeGrams,
    })
    .select('id')
    .single()
  if (error) throw error
  return data!.id as number
}

async function upsertOfferAndHistory(opts: {
  variantId: number
  storeId: number
  externalId: string
  url: string
  price: number
  available: boolean
  raw: unknown
}): Promise<void> {
  const { data: offer, error: offerErr } = await supabaseAdmin
    .from('offer')
    .upsert(
      {
        variant_id: opts.variantId,
        store_id: opts.storeId,
        external_id: opts.externalId,
        url: opts.url,
        price: opts.price,
        available: opts.available,
        raw: opts.raw,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,external_id' },
    )
    .select('id')
    .single()
  if (offerErr || !offer) throw offerErr ?? new Error('upsert offer sem retorno')
  const offerId = offer.id as number

  const today = new Date().toISOString().slice(0, 10)
  const { error: histErr } = await supabaseAdmin
    .from('price_history')
    .upsert(
      {
        offer_id: offerId,
        price: opts.price,
        available: opts.available,
        observed_at: today,
      },
      { onConflict: 'offer_id,observed_at' },
    )
  if (histErr) throw histErr
}

// ---------- processamento de um catalog product ----------

type CatalogResult =
  | { ok: true; offers_ingested: number; offers_total: number }
  | { ok: false; reason: string }

async function ingestCatalog(
  catalogId: string,
  storeId: number,
): Promise<CatalogResult> {
  let product: MlCatalogProduct
  try {
    product = await getProduct(catalogId)
  } catch (e) {
    return { ok: false, reason: `getProduct: ${e instanceof Error ? e.message : String(e)}` }
  }

  let items: MlProductItem[] = []
  try {
    const resp = await getProductItems(catalogId)
    items = resp.results ?? []
  } catch (e) {
    return { ok: false, reason: `getProductItems: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (items.length === 0) {
    return { ok: false, reason: 'sem ofertas ativas (results: [])' }
  }

  // Metadata
  const brandName = getAttr(product.attributes, 'BRAND') ?? 'Sem marca'
  const flavor    = getAttr(product.attributes, 'FLAVOR')
  const sizeGrams = parseGrams(
    getAttr(product.attributes, 'NET_WEIGHT') ??
    getAttr(product.attributes, 'UNIT_WEIGHT'),
  )
  const thumbnail = product.pictures?.[0]?.url ?? null

  const brandId   = await upsertBrand(brandName)
  const productId = await upsertProduct({ catalogId, name: product.name, brandId })
  const variantId = await upsertVariant({ productId, flavor, sizeGrams })

  // Ofertas
  let ingested = 0
  for (const offer of items) {
    const url = buildMlCatalogLink(catalogId, offer.item_id)
    await upsertOfferAndHistory({
      variantId,
      storeId,
      externalId: offer.item_id,
      url,
      price: offer.price,
      available: true,  // /products/{id}/items só devolve ofertas ativas
      raw: {
        ...offer,
        // enriquecemos com info do catalog product (não vem na oferta individual)
        thumbnail,
        product_name: product.name,
        catalog_id: catalogId,
      },
    })
    ingested++
  }

  return { ok: true, offers_ingested: ingested, offers_total: items.length }
}

// ---------- entry points ----------

export type IngestResult = {
  startedAt: string
  durationMs: number
  catalogIds: number
  catalogs_ingested: number
  offers_ingested: number
  per_catalog: Array<{
    catalog_id: string
    status: 'ok' | 'skip' | 'error'
    offers?: number
    reason?: string
  }>
}

export async function runCuratedIngest(): Promise<IngestResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const storeId = await getStoreId()
  const ids = loadCatalogIds()

  const result: IngestResult = {
    startedAt,
    durationMs: 0,
    catalogIds: ids.length,
    catalogs_ingested: 0,
    offers_ingested: 0,
    per_catalog: [],
  }

  for (const catalogId of ids) {
    try {
      const r = await ingestCatalog(catalogId, storeId)
      if (r.ok) {
        result.catalogs_ingested++
        result.offers_ingested += r.offers_ingested
        result.per_catalog.push({ catalog_id: catalogId, status: 'ok', offers: r.offers_ingested })
      } else {
        result.per_catalog.push({ catalog_id: catalogId, status: 'skip', reason: r.reason })
      }
    } catch (e) {
      result.per_catalog.push({
        catalog_id: catalogId,
        status: 'error',
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  result.durationMs = Date.now() - t0
  return result
}

export const runDefaultIngest = runCuratedIngest
