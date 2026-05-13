import { searchItems, getItems } from './client'
import { buildMlLink } from '../affiliate'
import { supabaseAdmin } from '../db-admin'
import type { MlItem, MlAttribute } from './types'

const ML_STORE_SLUG = 'mercado-livre'

// Keywords padrão do cron diário — categorias-âncora do MVP
export const DEFAULT_KEYWORDS = [
  'whey protein isolado',
  'creatina monohidratada',
  'multivitaminico',
  'omega 3',
  'pre treino',
] as const

// Atributos pedidos no multi-get para reduzir o payload
const ITEM_ATTRIBUTES =
  'id,title,category_id,price,base_price,original_price,currency_id,' +
  'available_quantity,sold_quantity,condition,permalink,thumbnail,pictures,' +
  'attributes,shipping,catalog_product_id,domain_id,date_created,last_updated'

// ---------- helpers ----------

function getAttr(attrs: MlAttribute[], id: string): string | null {
  const a = attrs.find(x => x.id === id)
  return a?.value_name ?? null
}

/** Converte "900 g" / "1 kg" / "1.5 KG" para gramas. Retorna null se não casar. */
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
      `Store '${ML_STORE_SLUG}' não encontrada. Rode a migration 0001_initial_schema.sql no Supabase.`,
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
  name: string
  brandId: number
}): Promise<number> {
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
  // EAN é a chave forte quando presente
  if (opts.ean) {
    const { data: existing } = await supabaseAdmin
      .from('variant')
      .select('id')
      .eq('product_id', opts.productId)
      .eq('ean', opts.ean)
      .maybeSingle()
    if (existing) return existing.id as number
  }

  // Sem EAN: tenta casar por (flavor, sizeGrams)
  let q = supabaseAdmin
    .from('variant')
    .select('id')
    .eq('product_id', opts.productId)
  q = opts.flavor ? q.eq('flavor', opts.flavor) : q.is('flavor', null)
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
  item: MlItem
}): Promise<void> {
  const url = buildMlLink(opts.item.permalink)
  const available = opts.item.available_quantity > 0

  const { data: offer, error: offerErr } = await supabaseAdmin
    .from('offer')
    .upsert(
      {
        variant_id: opts.variantId,
        store_id: opts.storeId,
        external_id: opts.item.id,
        url,
        price: opts.item.price,
        available,
        raw: opts.item,
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
        price: opts.item.price,
        available,
        observed_at: today,
      },
      { onConflict: 'offer_id,observed_at' },
    )
  if (histErr) throw histErr
}

// ---------- processamento de um item ----------

async function ingestItem(item: MlItem, storeId: number): Promise<void> {
  const brandName = getAttr(item.attributes, 'BRAND') ?? 'Sem marca'
  const flavor    = getAttr(item.attributes, 'FLAVOR')
  const sizeGrams = parseGrams(getAttr(item.attributes, 'NET_WEIGHT'))
  const ean       = getAttr(item.attributes, 'GTIN')

  const brandId   = await upsertBrand(brandName)
  const productId = await upsertProduct({ name: item.title, brandId })
  const variantId = await upsertVariant({ productId, ean, flavor, sizeGrams })

  await upsertOfferAndHistory({ variantId, storeId, item })
}

// ---------- entry points ----------

export type IngestKeywordResult = {
  keyword: string
  category?: string
  total: number
  ingested: number
  errors: string[]
}

export async function ingestKeyword(
  keyword: string,
  category?: string,
): Promise<IngestKeywordResult> {
  const storeId = await getStoreId()
  const search = await searchItems(keyword, { category, limit: 50 })
  const ids = search.results.map(r => r.id)

  // Multi-get em lotes de 20 — pega payload completo de cada item
  const items: MlItem[] = []
  for (let i = 0; i < ids.length; i += 20) {
    const batch = await getItems(ids.slice(i, i + 20), ITEM_ATTRIBUTES)
    items.push(...batch)
  }

  const errors: string[] = []
  let ingested = 0
  for (const item of items) {
    try {
      await ingestItem(item, storeId)
      ingested++
    } catch (e) {
      errors.push(`${item.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { keyword, category, total: items.length, ingested, errors }
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
        errors: [e instanceof Error ? e.message : String(e)],
      })
    }
  }
  return { startedAt, durationMs: Date.now() - t0, results }
}
