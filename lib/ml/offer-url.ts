import { buildMlCatalogLink } from '../affiliate'

/**
 * Resolução da URL de compra de uma oferta.
 *
 * Cada oferta representa o anúncio de um vendedor específico dentro de um
 * catálogo. O link precisa levar para esse anúncio — não para o catálogo, e
 * não para o anúncio de outro vendedor. Uma URL curada só é aceita quando ela
 * própria comprova o vínculo, via `wid`; caso contrário caímos no link
 * construído a partir do `catalogId` + `item_id` da oferta.
 */

export type OfferUrlReason =
  /** URL curada validada para este item_id. */
  | 'manual'
  /** Não existe URL curada para este item_id. */
  | 'fallback_sem_manual'
  /** URL curada descartada: não é uma URL absoluta válida. */
  | 'fallback_url_invalida'
  /** URL curada descartada: protocolo diferente de https. */
  | 'fallback_protocolo'
  /** URL curada descartada: domínio fora do Mercado Livre. */
  | 'fallback_dominio'
  /** URL curada descartada: sem `wid`, ou com `wid` de outra oferta. */
  | 'fallback_wid'

export type OfferUrlResolution = {
  url: string
  reason: OfferUrlReason
  /** false quando o link saiu sem tag de afiliado — o clique não gera comissão. */
  tracked: boolean
}

export type OfferUrlCounters = Record<OfferUrlReason, number> & {
  sem_tag_de_afiliado: number
}

const DOMINIOS_ML = ['mercadolivre.com.br', 'mercadolibre.com.br', 'mercadolibre.com']

export function newOfferUrlCounters(): OfferUrlCounters {
  return {
    manual: 0,
    fallback_sem_manual: 0,
    fallback_url_invalida: 0,
    fallback_protocolo: 0,
    fallback_dominio: 0,
    fallback_wid: 0,
    sem_tag_de_afiliado: 0,
  }
}

function dominioDoMercadoLivre(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return DOMINIOS_ML.some(d => host === d || host.endsWith(`.${d}`))
}

/**
 * Aceita a URL curada apenas se ela provar que aponta para esta oferta.
 * Devolve o motivo da recusa em vez de um booleano para que o ingest possa
 * contar cada causa separadamente.
 */
function validarUrlManual(manual: string, externalId: string): OfferUrlReason {
  let parsed: URL
  try {
    parsed = new URL(manual)
  } catch {
    return 'fallback_url_invalida'
  }
  if (parsed.protocol !== 'https:') return 'fallback_protocolo'
  if (!dominioDoMercadoLivre(parsed.hostname)) return 'fallback_dominio'
  // Sem wid, a URL vale para o catálogo inteiro e não distingue o vendedor.
  if (parsed.searchParams.get('wid') !== externalId) return 'fallback_wid'
  return 'manual'
}

export function resolveOfferUrl(opts: {
  catalogId: string
  externalId: string
  /** URLs curadas do catálogo, chaveadas por item_id. */
  manualByItemId?: Readonly<Record<string, string>>
  affiliateTag?: string
}): OfferUrlResolution {
  const tag = opts.affiliateTag ?? process.env.ML_AFFILIATE_TAG ?? ''
  const manual = opts.manualByItemId?.[opts.externalId]

  const reason: OfferUrlReason = manual
    ? validarUrlManual(manual, opts.externalId)
    : 'fallback_sem_manual'

  if (reason === 'manual') {
    return { url: manual!, reason, tracked: true }
  }
  return {
    url: buildMlCatalogLink(opts.catalogId, opts.externalId, tag),
    reason,
    // buildMlCatalogLink omite o parâmetro `affiliate` quando não há tag: o
    // link continua funcionando, mas o clique deixa de ser atribuído.
    tracked: tag !== '',
  }
}
