import itemsData from '@/data/items.json'
import { buildRollbackAffiliateLinks, parseAffiliateLinksCliArgs, prepareReviewedAffiliateLinks, type AffiliateLinkItem, type PersistedAffiliateOffer } from './affiliate-links'
import type { AffiliateUrlEntry } from './offer-url'

type CuratedCatalog = { catalog_id?: string; affiliate_urls?: Record<string, AffiliateUrlEntry> }

type PersistedOfferRow = {
  external_id?: unknown
  source_catalog_id?: unknown
  raw?: unknown
}

type SupabaseAdminModule = Pick<typeof import('../db-admin'), 'supabaseAdmin'>

export type AffiliateLinksCliDependencies = {
  findStoreId: () => Promise<number | null>
  loadOffers: (storeId: number, catalogId: string) => Promise<PersistedAffiliateOffer[]>
  apply: (storeId: number, catalogId: string, items: AffiliateLinkItem[], simular: boolean) => Promise<{ recebidas: number; alteradas: number; iguais: number } | null>
  log: (event: string, payload: Record<string, unknown>) => void
}

type RpcResult = { recebidas: number; alteradas: number; iguais: number }
type ParsedCliArgs = Extract<ReturnType<typeof parseAffiliateLinksCliArgs>, { ok: true }>
type CliOperation = { result: RpcResult }

function entriesForCatalog(catalogId: string): Record<string, AffiliateUrlEntry> {
  return (itemsData.items as CuratedCatalog[]).find(item => item.catalog_id === catalogId)?.affiliate_urls ?? {}
}

export function sellerIdFromRaw(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null || !('seller_id' in raw)) return undefined
  return typeof raw.seller_id === 'number' ? raw.seller_id : undefined
}

export function storeIdFromResponse(data: { id?: unknown } | null, error: unknown): number | null {
  const id = data?.id
  if (error !== null || !positiveSafeInteger(id)) return null
  return id
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

export function offerRowsFromResponse(data: unknown, error: unknown): PersistedOfferRow[] | null {
  if (error !== null || !Array.isArray(data)) return null
  return data
}

function validCounter(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

export function rpcResultFromResponse(data: unknown, error: unknown): RpcResult | null {
  if (error !== null || data == null) return null
  const { recebidas, alteradas, iguais } = data as Record<string, unknown>
  if (!validCounter(recebidas) || !validCounter(alteradas) || !validCounter(iguais)) return null
  return { recebidas, alteradas, iguais }
}

export function affiliateOffersFromResponse(
  data: unknown,
  error: unknown,
  catalogId: string,
): PersistedAffiliateOffer[] {
  const rows = offerRowsFromResponse(data, error)
  if (rows === null) throw new Error('offer_response_invalid')
  const offers: PersistedAffiliateOffer[] = []
  for (const row of rows) {
    const offer = persistedAffiliateOfferFromRow(row, catalogId)
    if (offer === null) throw new Error('offer_identity_invalid')
    offers.push(offer)
  }
  return offers
}

export function persistedAffiliateOfferFromRow(
  row: PersistedOfferRow,
  catalogId: string,
): PersistedAffiliateOffer | null {
  const sellerId = sellerIdFromRaw(row.raw)
  if (
    typeof row.external_id !== 'string'
    || row.external_id === ''
    || row.source_catalog_id !== catalogId
    || !positiveSafeInteger(sellerId)
  ) return null
  return {
    external_id: row.external_id,
    seller_id: sellerId,
    source_catalog_id: row.source_catalog_id,
  }
}

export async function runAffiliateLinksCli(
  args: readonly string[],
  dependencies: AffiliateLinksCliDependencies,
): Promise<number> {
  const parsed = parseAffiliateLinksCliArgs(args)
  if (!parsed.ok) {
    dependencies.log('ml_affiliate_links_failed', { code: parsed.code })
    return 1
  }
  const operation = await executeAffiliateLinksCli(parsed, dependencies)
  if (operation === null) {
    dependencies.log('ml_affiliate_links_failed', { code: 'operation_failed' })
    return 1
  }
  logCompletedOperation(parsed, operation, dependencies)
  return 0
}

async function executeAffiliateLinksCli(
  parsed: ParsedCliArgs,
  dependencies: AffiliateLinksCliDependencies,
): Promise<CliOperation | null> {
  try {
    const storeId = await dependencies.findStoreId()
    if (storeId === null) return null
    const offers = await dependencies.loadOffers(storeId, parsed.catalogId)
    const items = parsed.rollback
      ? buildRollbackAffiliateLinks(offers)
      : prepareReviewedAffiliateLinks(
        parsed.catalogId,
        offers,
        entriesForCatalog(parsed.catalogId),
      )
    const result = await dependencies.apply(storeId, parsed.catalogId, items, parsed.simular)
    if (result === null) return null
    return { result }
  } catch {
    return null
  }
}

function logCompletedOperation(
  parsed: ParsedCliArgs,
  operation: CliOperation,
  dependencies: AffiliateLinksCliDependencies,
): void {
  dependencies.log('ml_affiliate_links_completed', {
    catalog_id: parsed.catalogId,
    simulado: parsed.simular,
    recebidas: operation.result.recebidas,
    alteradas: operation.result.alteradas,
    iguais: operation.result.iguais,
  })
}

export async function runDefaultAffiliateLinksCli(
  loadSupabaseAdmin: () => Promise<SupabaseAdminModule> = () => import('../db-admin'),
): Promise<void> {
  try {
    const { supabaseAdmin } = await loadSupabaseAdmin()
    const code = await runAffiliateLinksCli(
      process.argv.slice(2),
      defaultAffiliateLinksCliDependencies(supabaseAdmin),
    )
    process.exitCode = code === 0 ? undefined : 1
  } catch {
    console.error('ml_affiliate_links_failed', { code: 'configuration_error' })
    process.exitCode = 1
  }
}

function defaultAffiliateLinksCliDependencies(
  supabaseAdmin: SupabaseAdminModule['supabaseAdmin'],
): AffiliateLinksCliDependencies {
  return {
    async findStoreId() {
      const { data, error } = await supabaseAdmin
        .from('store')
        .select('id')
        .eq('slug', 'mercado-livre')
        .single()
      return storeIdFromResponse(data, error)
    },
    async loadOffers(storeId, catalogId) {
      const offers: PersistedAffiliateOffer[] = []
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabaseAdmin
          .from('offer')
          .select('external_id, source_catalog_id, raw')
          .eq('store_id', storeId)
          .eq('source_catalog_id', catalogId)
          .order('id')
          .range(from, from + 499)
        const pageOffers = affiliateOffersFromResponse(data, error, catalogId)
        offers.push(...pageOffers)
        if (pageOffers.length < 500) return offers
      }
    },
    async apply(storeId, catalogId, items, simular) {
      const { data, error } = await supabaseAdmin.rpc('aplicar_links_afiliados_ml', {
        p_store_id: storeId,
        p_catalog_id: catalogId,
        p_items: items,
        p_simular: simular,
      })
      return rpcResultFromResponse(data, error)
    },
    log(event, payload) {
      console[event === 'ml_affiliate_links_completed' ? 'info' : 'error'](event, payload)
    },
  }
}
