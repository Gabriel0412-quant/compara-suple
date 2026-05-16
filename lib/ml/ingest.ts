import { searchProducts, getProduct } from './client'
import { buildMlLink } from '../affiliate'
import { supabaseAdmin } from '../db-admin'
import type { MlAttribute, MlCatalogProduct } from './types'

const ML_STORE_SLUG = 'mercado-livre'
const SUPPLEMENTS_DOMAIN = 'MLB-SUPPLEMENTS'

// Keywords padrão do cron diário
export const DEFAULT_KEYWORDS = [
  'whey protein isolado',
  'creatina monohidratada',
  'multivitaminico',
  'omega 3',
  'pre treino',
] as const

// ---------- helpers ----------

function getAttr(attrs: MlAttribute[], id: string): string | null {
  return attrs.find(a => a.id === id)?.value_name ?? null
}

/** Converte "900 g" / "1 kg" / "1.5 KG" para gramas. */
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
      `Store '${ML_STORE_SLUG}' não encontrada. Rode a migration 0001_initial_schema.sql.`,
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

async function upsertProduct(opts: { name: string; brandId: number }): Promise<number> {
  const slug = slugify(`${opts.name}-${opts.brandId}`)
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
  ean: string | null
  flavor: string | null
  sizeGrams: number | null
}): Promise<number> {
  if (opts.ean) {
    const { data: existing } = await supabaseAdmin
      .from('variant')
      .select('id')
      .eq('product_id', opts.productId)
      .eq('ean', opts.ean)
      .maybeSingle()
    if (existing) return existing.id as number
  }
  let q = supabaseAdmin
    .from('variant')
    .select('id')
    .eq('product_id', opts.productId)
  q = opts.flavor    ? q.eq('flavor', opts.flavor)    : q.is('flavor', null)
  q = opts.sizeGrams ? q.eq('size_grams', opts.sizeGrams) : q.is('size_grams', null)
  const { data: existingByAttr } = await q.maybeSingle()
  if (existingByAttr) return existingByAttr.id as number

  const { data, error } = await supabaseAdmin
    .from('variant')
    .insert({
      product_id: opts.productId,
      ean: opts.ean,
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

// ---------- core: ingest de um catalog product ----------

type IngestOutcome =
  | { ok: true }
  | { ok: false; reason: 'inactive' | 'no_winner' }

async function ingestCatalogProduct(
  catalog: MlCatalogProduct,
  storeId: number,
): Promise<IngestOutcome> {
  if (catalog.status !== 'active') return { ok: false, reason: 'inactive' }
  if (!catalog.buy_box_winner)     return { ok: false, reason: 'no_winner' }

  const brandName = getAttr(catalog.attributes, 'BRAND') ?? 'Sem marca'
  const flavor    = getAttr(catalog.attributes, 'FLAVOR')
  const sizeGrams = parseGrams(
    getAttr(catalog.attributes, 'NET_WEIGHT') ??
    getAttr(catalog.attributes, 'UNIT_WEIGHT'),
  )
  const ean       = getAttr(catalog.attributes, 'GTIN')

  const brandId   = await upsertBrand(brandName)
  const productId = await upsertProduct({ name: catalog.name, brandId })
  const variantId = await upsertVariant({ productId, ean, flavor, sizeGrams })

  const winner = catalog.buy_box_winner
  const url = buildMlLink(winner.permalink)

  await upsertOfferAndHistory({
    variantId,
    storeId,
    externalId: winner.item_id,
    url,
    price: winner.price,
    available: (winner.available_quantity ?? 0) > 0 ||
               winner.available_quantity === undefined,
    raw: catalog,
  })

  return { ok: true }
}

// ---------- entry points ----------

export type IngestKeywordResult = {
  keyword: string
  total: number
  ingested: number
  skipped_inactive: number
  skipped_no_winner: number
  errors: string[]
}

export async function ingestKeyword(keyword: string): Promise<IngestKeywordResult> {
  const storeId = await getStoreId()
  // Filtra pelo domínio de suplementos pra reduzir lixo (barras de cereal, snacks, etc)
  const search = await searchProducts(keyword, {
    limit: 50,
    domainId: SUPPLEMENTS_DOMAIN,
  })

  const result: IngestKeywordResult = {
    keyword,
    total: search.results.length,
    ingested: 0,
    skipped_inactive: 0,
    skipped_no_winner: 0,
    errors: [],
  }

  for (const summary of search.results) {
    try {
      const detail = await getProduct(summary.id)
      const r = await ingestCatalogProduct(detail, storeId)
      if (r.ok) result.ingested++
      else if (r.reason === 'inactive')  result.skipped_inactive++
      else if (r.reason === 'no_winner') result.skipped_no_winner++
    } catch (e) {
      result.errors.push(
        `${summary.id}: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return result
}

export type RunIngestResult = {
  startedAt: string
  durationMs: number
  results: IngestKeywordResult[]
}

export async function runDefaultIngest(): Promise<RunIngestResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const results: IngestKeywordResult[] = []
  for (const kw of DEFAULT_KEYWORDS) {
    try {
      results.push(await ingestKeyword(kw))
    } catch (e) {
      results.push({
        keyword: kw,
        total: 0,
        ingested: 0,
        skipped_inactive: 0,
        skipped_no_winner: 0,
        errors: [e instanceof Error ? e.message : String(e)],
      })
    }
  }
  return { startedAt, durationMs: Date.now() - t0, results }
}
