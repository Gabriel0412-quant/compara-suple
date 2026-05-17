import { getItems } from './client'
import { buildMlLink } from '../affiliate'
import { supabaseAdmin } from '../db-admin'
import type { MlAttribute, MlItem } from './types'
import itemsData from '@/data/items.json'

const ML_STORE_SLUG = 'mercado-livre'
const ITEMS_PER_BATCH = 20

// ---------- carregar a lista curada ----------

type RawItem = string | { id: string; nota?: string }

function loadCuratedIds(): string[] {
  const raw = (itemsData as { items: RawItem[] }).items
  const ids: string[] = []
  for (const entry of raw) {
    const id = typeof entry === 'string' ? entry : entry.id
    if (typeof id === 'string' && /^MLB\d+$/.test(id)) {
      ids.push(id)
    }
  }
  return ids
}

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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

// ---------- ingest de um único item ----------

async function ingestItem(item: MlItem, storeId: number): Promise<void> {
  const brandName = getAttr(item.attributes, 'BRAND') ?? 'Sem marca'
  const flavor    = getAttr(item.attributes, 'FLAVOR')
  const sizeGrams = parseGrams(
    getAttr(item.attributes, 'NET_WEIGHT') ??
    getAttr(item.attributes, 'UNIT_WEIGHT'),
  )
  const ean       = getAttr(item.attributes, 'GTIN')

  const brandId   = await upsertBrand(brandName)
  const productId = await upsertProduct({ name: item.title, brandId })
  const variantId = await upsertVariant({ productId, ean, flavor, sizeGrams })

  const url = buildMlLink(item.permalink)
  const available = item.status === 'active' && item.available_quantity > 0

  await upsertOfferAndHistory({
    variantId,
    storeId,
    externalId: item.id,
    url,
    price: item.price,
    available,
    raw: item,
  })
}

// ---------- entry points ----------

export type IngestResult = {
  startedAt: string
  durationMs: number
  curatedIds: number
  fetched: number
  ingested: number
  errors: Array<{ itemId: string; error: string }>
}

/**
 * Ingere todos os IDs curados em data/items.json. Faz multi-get em lotes
 * de 20 e processa cada item retornado.
 */
export async function runCuratedIngest(): Promise<IngestResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const storeId = await getStoreId()
  const ids = loadCuratedIds()

  const result: IngestResult = {
    startedAt,
    durationMs: 0,
    curatedIds: ids.length,
    fetched: 0,
    ingested: 0,
    errors: [],
  }

  for (const batchIds of chunk(ids, ITEMS_PER_BATCH)) {
    let items: MlItem[] = []
    try {
      items = await getItems(batchIds)
      result.fetched += items.length
    } catch (e) {
      // Falha no batch inteiro — registra um erro por ID
      const msg = e instanceof Error ? e.message : String(e)
      for (const id of batchIds) result.errors.push({ itemId: id, error: msg })
      continue
    }

    for (const item of items) {
      try {
        await ingestItem(item, storeId)
        result.ingested++
      } catch (e) {
        result.errors.push({
          itemId: item.id,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  result.durationMs = Date.now() - t0
  return result
}

/** Alias mantido por compat com chamadores antigos (cron sem body). */
export const runDefaultIngest = runCuratedIngest
