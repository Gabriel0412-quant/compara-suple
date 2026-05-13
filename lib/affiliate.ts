/**
 * Builders de link com tracking de afiliado por loja.
 *
 * Cada função recebe o link "limpo" (permalink que veio da API da loja)
 * e devolve o link com a tag de tracking aplicada.
 *
 * Importante: as tags vêm de variáveis de ambiente. Em build/dev local
 * sem env, as funções devolvem o permalink original (degrada graceful).
 */

const ML_TAG = process.env.ML_AFFILIATE_TAG ?? ''

/**
 * Mercado Livre — convenção `?affiliate=TAG` aplicada ao permalink do item.
 * Caso o link já tenha query string, anexa com `&` ao invés de `?`.
 */
export function buildMlLink(permalink: string, tag: string = ML_TAG): string {
  if (!tag) return permalink
  const sep = permalink.includes('?') ? '&' : '?'
  return `${permalink}${sep}affiliate=${encodeURIComponent(tag)}`
}
