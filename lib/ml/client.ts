import type {
  MlCatalogProductSearchResponse,
  MlCatalogProduct,
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
      // Token pode ter expirado entre a leitura no DB e a chamada — força refresh+retry
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

export type SearchOptions = {
  category?: string        // ex.: 'MLB264201' (Suplementos Alimentares)
  domainId?: string        // ex.: 'MLB-SUPPLEMENTS'
  limit?: number           // default 50, máx 50
  offset?: number          // default 0
}

/**
 * Busca catalog products no Mercado Livre (substitui o antigo /sites/MLB/search).
 * Retorna até 50 produtos canônicos por chamada.
 */
export async function searchProducts(
  keyword: string,
  opts: SearchOptions = {},
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

/**
 * Detalhe completo de um catalog product, incluindo `buy_box_winner`
 * (a oferta vencedora — preço, seller, permalink).
 */
export async function getProduct(id: string): Promise<MlCatalogProduct> {
  return fetchJson<MlCatalogProduct>(
    `${ML_BASE}/products/${encodeURIComponent(id)}`,
  )
}
