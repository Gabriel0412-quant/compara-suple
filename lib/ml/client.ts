import type {
  MlCatalogProduct,
  MlItemDetail,
  MlProductItemsResponse,
  MlCatalogProductSearchResponse,
  MlSellerItemsSearchResponse,
  MlUserProduct,
} from './types'
import { getValidAccessToken } from './oauth'
import {
  collectMlProductItemsSnapshot,
  type MlProductItemsSnapshot,
} from './snapshot'

const ML_BASE = 'https://api.mercadolibre.com'
const SITE = 'MLB'

const DEFAULT_TIMEOUT_MS = 15_000
// ML permite ~1500 req/min/app. Mantemos 10 req/s pra evitar 429.
const MIN_INTERVAL_MS = 100

let lastCallAt = 0

export class MlRequestError extends Error {
  constructor(
    readonly kind: 'auth' | 'transient' | 'permanent' | 'timeout',
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(`ML_REQUEST_${kind.toUpperCase()}`)
  }
}

function retryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1_000
  const retryAt = Date.parse(value)
  return Number.isNaN(retryAt) ? undefined : Math.max(0, retryAt - now)
}

async function throttle(): Promise<void> {
  const now = Date.now()
  const wait = MIN_INTERVAL_MS - (now - lastCallAt)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCallAt = Date.now()
}

async function fetchJson<T>(url: string): Promise<T> {
  await throttle()
  const token = await getValidAccessToken()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MlRequestError('timeout')
      }
      throw new MlRequestError('transient')
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new MlRequestError('auth', res.status)
      }
      if (res.status === 408 || res.status === 429 || res.status >= 500) {
        throw new MlRequestError(
          'transient',
          res.status,
          retryAfterMilliseconds(res.headers.get('retry-after')),
        )
      }
      throw new MlRequestError('permanent', res.status)
    }

    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

// ---------- core: produto de catálogo + suas ofertas ----------

/** Metadata do catalog product: nome, atributos estruturados, fotos. */
export async function getProduct(catalogId: string): Promise<MlCatalogProduct> {
  return fetchJson<MlCatalogProduct>(
    `${ML_BASE}/products/${encodeURIComponent(catalogId)}`,
  )
}

/**
 * Lista de ofertas (sellers) vendendo um catalog product.
 * Retorna `results: []` (mas não 404) quando há catalog product sem sellers ativos.
 */
async function getProductItemsPage(
  catalogId: string,
  options: { offset: number; limit: number },
): Promise<MlProductItemsResponse> {
  const params = new URLSearchParams({
    offset: String(options.offset),
    limit: String(options.limit),
  })
  return fetchJson<MlProductItemsResponse>(
    `${ML_BASE}/products/${encodeURIComponent(catalogId)}/items?${params.toString()}`,
  )
}

export function getProductItems(catalogId: string): Promise<MlProductItemsSnapshot> {
  return collectMlProductItemsSnapshot(catalogId, getProductItemsPage)
}

// ---------- user product + anúncios do vendedor ----------

export async function getUserProduct(userProductId: string): Promise<MlUserProduct> {
  return fetchJson<MlUserProduct>(
    `${ML_BASE}/user-products/${encodeURIComponent(userProductId)}`,
  )
}

function normalizeUserProductItem(
  item: MlItemDetail,
  userProductId: string,
): MlProductItemsResponse['results'][number] {
  return {
    item_id: item.id,
    site_id: item.site_id,
    seller_id: item.seller_id,
    price: item.price,
    original_price: item.original_price ?? null,
    currency_id: item.currency_id,
    category_id: item.category_id,
    condition: item.condition,
    warranty: item.warranty,
    listing_type_id: item.listing_type_id,
    tags: item.tags,
    official_store_id: item.official_store_id ?? null,
    accepts_mercadopago: item.accepts_mercadopago,
    shipping: item.shipping,
    seller_address: item.seller_address,
    sale_terms: item.sale_terms,
    user_product_id: item.user_product_id ?? userProductId,
    min_purchase_unit: item.min_purchase_unit,
    international_delivery_mode: item.international_delivery_mode,
  }
}

async function getUserProductItemsPage(
  userProductId: string,
  sellerId: number,
  options: { offset: number; limit: number },
): Promise<MlProductItemsResponse> {
  const params = new URLSearchParams({
    user_product_id: userProductId,
    status: 'active',
    offset: String(options.offset),
    limit: String(options.limit),
  })
  const search = await fetchJson<MlSellerItemsSearchResponse>(
    `${ML_BASE}/users/${sellerId}/items/search?${params.toString()}`,
  )
  const details: MlItemDetail[] = []
  for (const itemId of search.results) {
    const item = await fetchJson<MlItemDetail>(
      `${ML_BASE}/items/${encodeURIComponent(itemId)}`,
    )
    details.push(item)
  }
  return {
    paging: {
      total: search.paging.total,
      offset: search.paging.offset,
      limit: search.paging.limit,
    },
    results: details.map(item => normalizeUserProductItem(item, userProductId)),
  }
}

export function getUserProductItems(
  userProductId: string,
  sellerId: number,
): Promise<MlProductItemsSnapshot> {
  return collectMlProductItemsSnapshot(
    userProductId,
    (id, options) => getUserProductItemsPage(id, sellerId, options),
  )
}

// ---------- descoberta (futuro, não usado pelo ingest atual) ----------

export type SearchProductsOptions = {
  category?: string
  domainId?: string
  limit?: number
  offset?: number
}

export async function searchProducts(
  keyword: string,
  opts: SearchProductsOptions = {},
): Promise<MlCatalogProductSearchResponse> {
  const params = new URLSearchParams({
    site_id: SITE,
    q: keyword,
    limit: String(opts.limit ?? 50),
    offset: String(opts.offset ?? 0),
  })
  if (opts.category)  params.set('category',  opts.category)
  if (opts.domainId)  params.set('domain_id', opts.domainId)
  return fetchJson<MlCatalogProductSearchResponse>(
    `${ML_BASE}/products/search?${params.toString()}`,
  )
}
