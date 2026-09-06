const ML_BASE_WEB = 'https://www.mercadolivre.com.br'

export function buildMlCatalogLink(catalogId: string, itemId: string): string {
  const path = catalogId.startsWith('MLBU') ? 'up' : 'p'
  const params = new URLSearchParams()
  params.set('wid', itemId)
  return `${ML_BASE_WEB}/${path}/${encodeURIComponent(catalogId)}?${params.toString()}`
}
