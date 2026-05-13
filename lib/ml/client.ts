import type {
  MlSearchResponse,
  MlItem,
  MlMultiGetEntry,
} from './types'

const ML_BASE = 'https://api.mercadolibre.com'
const SITE = 'MLB'

const DEFAULT_TIMEOUT_MS = 15_000
// ML permite ~1500 req/min/app (~25/s). Mantemos folga grande (10/s) para evitar 429.
const MIN_INTERVAL_MS = 100
const MAX_RETRIES = 4
const MULTI_GET_MAX = 20

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
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })

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
  category?: string
  limit?: number          // default 50, máx 50
  offset?: number         // default 0, máx ~1000
  sort?: 'price_asc' | 'price_desc' | 'relevance'
  condition?: 'new' | 'used'
}

export async function searchItems(
  keyword: string,
  opts: SearchOptions = {},
): Promise<MlSearchResponse> {
  const params = new URLSearchParams({ q: keyword })
  if (opts.category)            params.set('category', opts.category)
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.offset !== undefined) params.set('offset', String(opts.offset))
  if (opts.sort)                params.set('sort', opts.sort)
  if (opts.condition)           params.set('condition', opts.condition)
  return fetchJson<MlSearchResponse>(
    `${ML_BASE}/sites/${SITE}/search?${params.toString()}`,
  )
}

/** Multi-get de até 20 ASINs por chamada. Items com code != 200 são descartados. */
export async function getItems(
  ids: string[],
  attributes?: string,
): Promise<MlItem[]> {
  if (ids.length === 0) return []
  if (ids.length > MULTI_GET_MAX) {
    throw new Error(`getItems: máximo ${MULTI_GET_MAX} ids por chamada (recebeu ${ids.length})`)
  }
  const params = new URLSearchParams({ ids: ids.join(',') })
  if (attributes) params.set('attributes', attributes)
  const data = await fetchJson<MlMultiGetEntry[]>(
    `${ML_BASE}/items?${params.toString()}`,
  )
  return data.filter(d => d.code === 200).map(d => d.body)
}

export async function getItem(id: string): Promise<MlItem> {
  return fetchJson<MlItem>(`${ML_BASE}/items/${encodeURIComponent(id)}`)
}
