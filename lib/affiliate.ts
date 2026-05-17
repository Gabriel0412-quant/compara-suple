/**
 * Builders de link com tracking de afiliado por loja.
 *
 * Cada função recebe info do produto e devolve URL com tag de afiliado aplicada.
 *
 * Importante: as tags vêm de env. Sem env, a função devolve o link "limpo"
 * (degrada graceful — não quebra em dev/build sem cadastro de afiliado).
 */

const ML_TAG = process.env.ML_AFFILIATE_TAG ?? ''
const ML_BASE_WEB = 'https://www.mercadolivre.com.br'

/**
 * Mercado Livre — link da página de catálogo com deep-link pro seller específico
 * via `wid={item_id}` e tracking via `affiliate={tag}`.
 *
 * Exemplos:
 *   buildMlCatalogLink('MLB19049048', 'MLB5872093596')
 *     → 'https://www.mercadolivre.com.br/p/MLB19049048?affiliate=...&wid=MLB5872093596'
 *
 *   buildMlCatalogLink('MLBU3907661448', 'MLB6620125422')   // user product
 *     → 'https://www.mercadolivre.com.br/up/MLBU3907661448?affiliate=...&wid=MLB6620125422'
 */
export function buildMlCatalogLink(
  catalogId: string,
  itemId: string,
  tag: string = ML_TAG,
): string {
  // Catalog products começam com MLB; user products com MLBU (rota /up/)
  const path = catalogId.startsWith('MLBU') ? 'up' : 'p'
  const params = new URLSearchParams()
  if (tag)    params.set('affiliate', tag)
  if (itemId) params.set('wid', itemId)
  const qs = params.toString()
  return `${ML_BASE_WEB}/${path}/${encodeURIComponent(catalogId)}${qs ? `?${qs}` : ''}`
}

/**
 * Versão legacy/fallback — recebe um permalink já pronto e só anexa o tracking.
 * Mantida pra casos onde já temos a URL completa (raro com a estratégia atual).
 */
export function buildMlLink(permalink: string, tag: string = ML_TAG): string {
  if (!tag) return permalink
  const sep = permalink.includes('?') ? '&' : '?'
  return `${permalink}${sep}affiliate=${encodeURIComponent(tag)}`
}
