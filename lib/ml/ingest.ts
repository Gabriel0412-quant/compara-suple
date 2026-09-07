import { randomUUID } from 'node:crypto'

import {
  getProduct,
  getProductItems,
  getUserProduct,
  getUserProductItems,
} from './client'
import { supabaseAdmin } from '../db-admin'
import type { MlAttribute, MlCatalogProduct } from './types'
import type { MlProductItemsSnapshot } from './snapshot'
import {
  newOfferUrlCounters,
  resolveOfferUrl,
  type AffiliateUrlEntry,
  type OfferUrlCounters,
  type OfferUrlResolution,
} from './offer-url'
import { executeIngestionBatch } from './ingestion-orchestrator'
import { supabaseIngestionOrchestrationStore } from './ingestion-run'
import itemsData from '@/data/items.json'
import { classificarIdCatalogo, motivoDeRecusa, type MotivoNaoColetado } from './catalog-id'

const ML_STORE_SLUG = 'mercado-livre'

// ---------- carregar lista curada ----------

type RawCatalog =
  | string
  | {
      catalog_id?: string
      id?: string
      nota?: string
      /** URLs curadas por item_id. Uma por anúncio — nunca uma para o catálogo. */
      affiliate_urls?: Record<string, AffiliateUrlEntry>
      /** Formato antigo: uma URL para o catálogo inteiro. Rejeitado. */
      affiliate_url?: string
    }

export type CuratedItem = {
  catalogId: string
  manualByItemId: Record<string, AffiliateUrlEntry>
}

/** Item da lista curada que a ingestão reconhece mas não sabe coletar. */
export type ItemRecusado = { catalogId: string; motivo: MotivoNaoColetado }

export type ListaCurada = { items: CuratedItem[]; recusados: ItemRecusado[] }

function isAffiliateUrlEntry(value: unknown): value is AffiliateUrlEntry {
  return (typeof value === 'string' && value !== '')
    || (typeof value === 'object' && value !== null)
}

export function loadCuratedItems(
  raw: RawCatalog[] = (itemsData as { items: RawCatalog[] }).items,
): ListaCurada {
  const items: CuratedItem[] = []
  const recusados: ItemRecusado[] = []
  let compartilhadas = 0

  // IDs inválidos são recusados antes de qualquer chamada externa. MLB e MLBU
  // seguem para fluxos distintos dentro de ingestCatalog.
  const classificar = (id: unknown): id is string => {
    const tipo = classificarIdCatalogo(id)
    const motivo = motivoDeRecusa(tipo)
    if (motivo) {
      recusados.push({ catalogId: String(id).trim(), motivo })
    }
    return tipo === 'catalog_product' || tipo === 'user_product'
  }

  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (classificar(entry)) {
        items.push({ catalogId: entry.trim(), manualByItemId: {} })
      }
      continue
    }
    const id = entry.catalog_id ?? entry.id
    if (!classificar(id)) continue
    // Uma URL no nível do catálogo iria para todas as ofertas dele e mandaria
    // o comprador para o anúncio de outro vendedor. Nunca é aproveitável.
    if (entry.affiliate_url) compartilhadas++
    const manual: Record<string, AffiliateUrlEntry> = {}
    for (const [itemId, url] of Object.entries(entry.affiliate_urls ?? {})) {
      if (isAffiliateUrlEntry(url)) {
        manual[itemId] = url
      }
    }
    items.push({ catalogId: id, manualByItemId: manual })
  }
  if (compartilhadas > 0) {
    console.warn('ml_affiliate_url_compartilhada_ignorada', { catalogos: compartilhadas })
  }
  if (recusados.length > 0) {
    console.warn('ml_itens_nao_coletaveis', {
      total: recusados.length,
      motivos: recusados.map(r => r.motivo),
    })
  }
  return { items, recusados }
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
  servings: number | null
}): Promise<number> {
  let q = supabaseAdmin
    .from('variant')
    .select('id, servings')
    .eq('product_id', opts.productId)
  q = opts.flavor    ? q.eq('flavor', opts.flavor)    : q.is('flavor', null)
  q = opts.sizeGrams ? q.eq('size_grams', opts.sizeGrams) : q.is('size_grams', null)
  const { data: existing } = await q.maybeSingle()

  if (existing) {
    // Atualiza servings se a info nova for diferente / chegou agora
    if (opts.servings != null && existing.servings !== opts.servings) {
      await supabaseAdmin
        .from('variant')
        .update({ servings: opts.servings })
        .eq('id', existing.id)
    }
    return existing.id as number
  }

  const { data, error } = await supabaseAdmin
    .from('variant')
    .insert({
      product_id: opts.productId,
      flavor: opts.flavor,
      size_grams: opts.sizeGrams,
      servings: opts.servings,
    })
    .select('id')
    .single()
  if (error) throw error
  return data!.id as number
}

export type ReconciliacaoContadores = {
  /** true quando o efeito foi desfeito: os números são previsão, não fato. */
  simulado: boolean
  recebidas: number
  criadas: number
  atualizadas: number
  reativadas: number
  indisponibilizadas: number
  observado_em: string
}

type OfertaParaReconciliar = {
  external_id: string
  url: string
  price: number
  ml_rank: number
  raw: unknown
}

const CONTADORES_ZERADOS: ReconciliacaoContadores = {
  simulado: false,
  recebidas: 0,
  criadas: 0,
  atualizadas: 0,
  reativadas: 0,
  indisponibilizadas: 0,
  observado_em: '',
}

/**
 * Aplica o snapshot como o estado comercial completo do catálogo.
 *
 * Toda a escrita acontece dentro de reconciliar_catalogo: upsert das ofertas
 * presentes, indisponibilização das ausentes e histórico do dia saem juntos ou
 * não saem. Um array vazio é um snapshot válido e desativa o catálogo inteiro.
 */
async function reconciliarCatalogo(opts: {
  storeId: number
  catalogId: string
  variantId: number | null
  ofertas: OfertaParaReconciliar[]
  simular: boolean
}): Promise<ReconciliacaoContadores> {
  const { data, error } = await supabaseAdmin.rpc('reconciliar_catalogo', {
    p_store_id: opts.storeId,
    p_catalog_id: opts.catalogId,
    p_variant_id: opts.variantId,
    p_items: opts.ofertas,
    p_simular: opts.simular,
  })
  if (error) throw error
  return { ...CONTADORES_ZERADOS, ...(data as Partial<ReconciliacaoContadores>) }
}

// ---------- processamento de um catalog product ----------

type CatalogResult =
  | {
      ok: true
      status: 'success' | 'success_empty'
      offers_ingested: number
      offers_total: number
      reconciliacao: ReconciliacaoContadores
      urls: OfferUrlCounters
      total_received: number
      pages_fetched: number
      rejected_by_reason: MlProductItemsSnapshot['rejectedByReason']
    }
  | {
      ok: false
      status: 'upstream_error' | 'snapshot_invalid' | 'product_error'
      reason: string
      total_received?: number
      pages_fetched?: number
      rejected_by_reason?: MlProductItemsSnapshot['rejectedByReason']
    }

function isConnectionFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith('ML_OAUTH_')
    || message.startsWith('ML_TOKEN_')
    || message.startsWith('ML_REFRESH_')
}

function logSnapshot(catalogId: string, snapshot: MlProductItemsSnapshot): void {
  console.info('ml_snapshot', {
    catalogId,
    status: snapshot.status,
    totalReceived: snapshot.totalReceived,
    pagesFetched: snapshot.pagesFetched,
    rejectedByReason: snapshot.rejectedByReason,
  })
}

function logReconciliacao(
  catalogId: string,
  status: 'success' | 'success_empty',
  contadores: ReconciliacaoContadores,
): void {
  console.info('ml_reconciliacao', { catalogId, status, ...contadores })
}

function affiliateLinkMetadata(link: OfferUrlResolution) {
  return {
    origin: link.origin,
    validation: link.validation,
    destination: link.destination,
    reason: link.reason,
    ...(link.seller_id === undefined ? {} : { seller_id: link.seller_id }),
    ...(link.reviewed_at === undefined ? {} : { reviewed_at: link.reviewed_at }),
    ...(link.review_ref === undefined ? {} : { review_ref: link.review_ref }),
  }
}

function countOfferUrlResolution(counters: OfferUrlCounters, link: OfferUrlResolution): void {
  counters[link.reason]++
  if (link.destination === 'affiliate_link') counters.affiliate_reviewed++
  else counters.fallback++
}

async function ingestCatalog(
  catalogId: string,
  storeId: number,
  manualByItemId: Record<string, AffiliateUrlEntry>,
  simular: boolean,
): Promise<CatalogResult> {
  let product: MlCatalogProduct
  let snapshot: MlProductItemsSnapshot
  try {
    if (classificarIdCatalogo(catalogId) === 'user_product') {
      const userProduct = await getUserProduct(catalogId)
      product = {
        id: userProduct.id,
        catalog_product_id: userProduct.id,
        status: userProduct.status ?? 'active',
        domain_id: userProduct.domain_id,
        name: userProduct.name,
        family_name: userProduct.family_name ?? undefined,
        pictures: userProduct.pictures,
        attributes: userProduct.attributes,
        buy_box_winner: null,
      }
      snapshot = await getUserProductItems(catalogId, userProduct.user_id)
    } else {
      product = await getProduct(catalogId)
      snapshot = await getProductItems(catalogId)
    }
  } catch (error) {
    if (isConnectionFailure(error)) throw error
    return { ok: false, status: 'product_error', reason: 'product_request_failed' }
  }

  logSnapshot(catalogId, snapshot)
  if (snapshot.status === 'upstream_error' || snapshot.status === 'snapshot_invalid') {
    return {
      ok: false,
      status: snapshot.status,
      reason: snapshot.reason,
      total_received: snapshot.totalReceived,
      pages_fetched: snapshot.pagesFetched,
      rejected_by_reason: snapshot.rejectedByReason,
    }
  }

  // Snapshot válido e vazio é informação, não ausência de informação: o catálogo
  // não tem mais oferta ativa, então todas as anteriores precisam cair.
  if (snapshot.status === 'success_empty') {
    const reconciliacao = await reconciliarCatalogo({
      storeId,
      catalogId,
      variantId: null,
      ofertas: [],
      simular,
    })
      logReconciliacao(catalogId, 'success_empty', reconciliacao)
    return {
      ok: true,
      status: 'success_empty',
      offers_ingested: 0,
      offers_total: 0,
      reconciliacao,
      urls: newOfferUrlCounters(),
      total_received: snapshot.totalReceived,
      pages_fetched: snapshot.pagesFetched,
      rejected_by_reason: snapshot.rejectedByReason,
    }
  }

  // Metadata
  const brandName     = getAttr(product.attributes, 'BRAND') ?? 'Sem marca'
  const flavor        = getAttr(product.attributes, 'FLAVOR')
  const sizeGrams     = parseGrams(
    getAttr(product.attributes, 'NET_WEIGHT') ??
    getAttr(product.attributes, 'UNIT_WEIGHT'),
  )
  const servingGrams  = parseGrams(getAttr(product.attributes, 'SERVING_WEIGHT'))
  // Doses = peso total / peso por dose (arredondado para inteiro mais próximo)
  const servings      = sizeGrams && servingGrams && servingGrams > 0
    ? Math.round(sizeGrams / servingGrams)
    : null
  const thumbnail     = product.pictures?.[0]?.url ?? null

  const brandId   = await upsertBrand(brandName)
  const productId = await upsertProduct({ catalogId, name: product.name, brandId })
  const variantId = await upsertVariant({ productId, flavor, sizeGrams, servings })

  // IMPORTANTE: items vem em ordem específica do ML — primeiro = buy box winner.
  // Salvamos essa posição em ml_rank pra preservar o destaque do ML.
  const urlCounters = newOfferUrlCounters()
  const ofertas: OfertaParaReconciliar[] = []
  for (const snapshotItem of snapshot.items) {
    if (snapshotItem.kind === 'invalid') continue
    const offer = snapshotItem.item
    const link = resolveOfferUrl({
      catalogId,
      externalId: offer.item_id,
      sellerId: offer.seller_id,
      manualByItemId,
    })
    countOfferUrlResolution(urlCounters, link)
    ofertas.push({
      external_id: offer.item_id,
      url: link.url,
      price: offer.price,
      ml_rank: snapshotItem.mlRank,
      raw: {
        ...offer,
        // enriquecemos com info do catalog product (não vem na oferta individual)
        thumbnail,
        product_name: product.name,
        catalog_id: catalogId,
        affiliate_link: affiliateLinkMetadata(link),
      },
    })
  }

  const reconciliacao = await reconciliarCatalogo({
    storeId,
    catalogId,
    variantId,
    ofertas,
    simular,
  })
  logReconciliacao(catalogId, 'success', reconciliacao)
  console.info('ml_url_fallback', { catalogId, ...urlCounters })

  return {
    ok: true,
    status: 'success',
    offers_ingested: reconciliacao.criadas + reconciliacao.atualizadas + reconciliacao.reativadas,
    reconciliacao,
    urls: urlCounters,
    offers_total: snapshot.totalReceived,
    total_received: snapshot.totalReceived,
    pages_fetched: snapshot.pagesFetched,
    rejected_by_reason: snapshot.rejectedByReason,
  }
}

// ---------- entry points ----------

export type IngestResult = {
  /** true quando nada foi persistido: o resultado é previsão. */
  simulado: boolean
  startedAt: string
  durationMs: number
  catalogIds: number
  catalogs_ingested: number
  offers_ingested: number
  offers_criadas: number
  offers_atualizadas: number
  offers_reativadas: number
  offers_indisponibilizadas: number
  urls: OfferUrlCounters
  per_catalog: Array<{
    catalog_id: string
    status:
      | 'success'
      | 'success_empty'
      | 'upstream_error'
      | 'snapshot_invalid'
      | 'product_error'
      /** Reconhecido, mas a ingestão não sabe coletar este tipo de id. */
      | 'nao_coletavel'
    offers?: number
    reconciliacao?: ReconciliacaoContadores
    urls?: OfferUrlCounters
    reason?: string
    total_received?: number
    pages_fetched?: number
    rejected_by_reason?: MlProductItemsSnapshot['rejectedByReason']
  }>
}

export type IngestOptions = {
  /**
   * Executa a reconciliação e desfaz o efeito, devolvendo os contadores.
   *
   * O que ela NÃO desfaz: os upserts de brand/product/variant, que acontecem
   * antes da reconciliação e são idempotentes. Nenhuma oferta e nenhum
   * histórico é alterado.
   */
  simular?: boolean
}

export async function runCuratedIngest(
  options: IngestOptions = {},
): Promise<IngestResult> {
  const simular = options.simular ?? false
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const storeId = await getStoreId()
  const { items, recusados } = loadCuratedItems()

  const result: IngestResult = {
    simulado: simular,
    startedAt,
    durationMs: 0,
    catalogIds: items.length + recusados.length,
    catalogs_ingested: 0,
    offers_ingested: 0,
    offers_criadas: 0,
    offers_atualizadas: 0,
    offers_reativadas: 0,
    offers_indisponibilizadas: 0,
    urls: newOfferUrlCounters(),
    per_catalog: [],
  }

  /*
    Os recusados entram no relatório com o motivo. Sem isto, `catalogIds` e
    `catalogs_ingested` fechariam a conta em silêncio e ninguém saberia que um
    item da lista curada nunca foi tentado.
  */
  for (const recusado of recusados) {
    result.per_catalog.push({
      catalog_id: recusado.catalogId,
      status: 'nao_coletavel',
      reason: recusado.motivo,
    })
  }

  for (const item of items) {
    const catalogId = item.catalogId
    try {
      const r = await ingestCatalog(catalogId, storeId, item.manualByItemId, simular)
      if (r.ok) {
        result.catalogs_ingested++
        result.offers_ingested += r.offers_ingested
        result.offers_criadas += r.reconciliacao.criadas
        result.offers_atualizadas += r.reconciliacao.atualizadas
        result.offers_reativadas += r.reconciliacao.reativadas
        result.offers_indisponibilizadas += r.reconciliacao.indisponibilizadas
        for (const [motivo, n] of Object.entries(r.urls)) {
          result.urls[motivo as keyof OfferUrlCounters] += n
        }
        result.per_catalog.push({
          catalog_id: catalogId,
          status: r.status,
          offers: r.offers_ingested,
          reconciliacao: r.reconciliacao,
          urls: r.urls,
          total_received: r.total_received,
          pages_fetched: r.pages_fetched,
          rejected_by_reason: r.rejected_by_reason,
        })
      } else {
        result.per_catalog.push({
          catalog_id: catalogId,
          status: r.status,
          reason: r.reason,
          total_received: r.total_received,
          pages_fetched: r.pages_fetched,
          rejected_by_reason: r.rejected_by_reason,
        })
      }
    } catch (error) {
      if (isConnectionFailure(error)) throw error
      result.per_catalog.push({
        catalog_id: catalogId,
        status: 'product_error',
        reason: 'persistence_failed',
      })
    }
  }

  result.durationMs = Date.now() - t0
  if (result.urls.fallback > 0) {
    console.warn('ml_url_fallback_ativo', {
      destino: 'untracked_fallback',
      fallback: result.urls.fallback,
    })
  }
  return result
}

export const runDefaultIngest = runCuratedIngest

export type OperationalIngestResult = {
  runId: string
  state: import('./ingestion-run').IngestionRunState
  disposition: 'acquired' | 'busy' | 'terminal' | 'blocked' | 'lease_lost'
  processed: number
  succeeded: number
  failed: number
  hasContinuation: boolean
  durationMs: number
  counters?: {
    total: number
    succeeded: number
    failed: number
    skipped: number
    retryScheduled: number
  }
}

function environmentInteger(name: string, fallback: number): number {
  const value = process.env[name]
  if (!value) return fallback
  if (!/^\d+$/.test(value)) throw new Error(`${name}_INVALID`)
  return Number(value)
}

export async function runOperationalCuratedIngest(): Promise<OperationalIngestResult> {
  const startedAt = Date.now()
  const { items } = loadCuratedItems()
  const itemByCatalogId = new Map(items.map(item => [item.catalogId, item]))
  const storeId = await getStoreId()
  const result = await executeIngestionBatch({
    itemKeys: items.map(item => item.catalogId),
    workerId: randomUUID(),
    batchSize: environmentInteger('INGEST_BATCH_SIZE', 12),
    timeBudgetMs: environmentInteger('INGEST_TIME_BUDGET_MS', 240_000),
    leaseSeconds: environmentInteger('INGEST_LEASE_SECONDS', 360),
    codeVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    processItem: async catalogId => {
      const item = itemByCatalogId.get(catalogId)
      if (!item) return { ok: false }
      const catalog = await ingestCatalog(
        item.catalogId,
        storeId,
        item.manualByItemId,
        false,
      )
      return { ok: catalog.ok }
    },
  }, supabaseIngestionOrchestrationStore)

  return { ...result, durationMs: Date.now() - startedAt }
}
