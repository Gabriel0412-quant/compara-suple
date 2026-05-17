import type {
  MlCatalogProduct,
  MlProductItemsResponse,
  MlCatalogProductSearchResponse,
} from './types'
import { getValidAccessToken } from './oauth'

const ML_BASE = 'https://api.mercadolibre.com'
const SITE = 'MLB'

const DEFAULT_TIMEOUT_MS = 15_000
// ML permite ~1500 req/min/app. Mantemos 10 req/s pra evitar 429.
const MIN_INTERVAL_MS = 100
const MAX_RETRIES = 4

let lastCallAt = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  const wait = MIN_INTERVAL_MS - (now - lastCallAt)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCallAt = Date.now()
}

async function fetchJson<T>(url: string, attempt = 0): Promise<T> {
  await throttle()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const token = await getValidAccessToken()
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (res.status === 401 && attempt < 1) {
      await new Promise(r => setTimeout(r, 200))
      return fetchJson<T>(url, attempt + 1)
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const delay = 2 ** attempt * 500
      await new Promise(r => setTimeout(r, delay))
      return fetchJson<T>(url, attempt + 1)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`ML API ${res.status}: ${body.slice(0, 200)}`)
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
export async function getProductItems(
  catalogId: string,
): Promise<MlProductItemsResponse> {
  return fetchJson<MlProductItemsResponse>(
    `${ML_BASE}/products/${encodeURIComponent(catalogId)}/items`,
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
