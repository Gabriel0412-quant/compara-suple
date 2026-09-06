import { buildMlCatalogLink } from '../affiliate'

export type OfferUrlReason =
  | 'fallback_absent'
  | 'fallback_unverified'
  | 'fallback_url_invalida'
  | 'fallback_protocolo'
  | 'fallback_dominio'
  | 'fallback_wid'

export type OfferUrlResolution = {
  url: string
  destination: 'untracked_fallback'
  origin: 'none' | 'legacy_manual'
  validation: 'absent' | 'unverified' | 'rejected'
  reason: OfferUrlReason
}

export type OfferUrlCounters = Record<OfferUrlReason, number> & {
  fallback: number
}

const DOMINIOS_ML = ['mercadolivre.com.br', 'mercadolibre.com.br', 'mercadolibre.com']

export function newOfferUrlCounters(): OfferUrlCounters {
  return {
    fallback: 0,
    fallback_absent: 0,
    fallback_unverified: 0,
    fallback_url_invalida: 0,
    fallback_protocolo: 0,
    fallback_dominio: 0,
    fallback_wid: 0,
  }
}

function dominioDoMercadoLivre(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return DOMINIOS_ML.some(d => host === d || host.endsWith(`.${d}`))
}

function validarUrlManual(manual: string, externalId: string): OfferUrlReason | null {
  let parsed: URL
  try {
    parsed = new URL(manual)
  } catch {
    return 'fallback_url_invalida'
  }
  if (parsed.protocol !== 'https:') return 'fallback_protocolo'
  if (!dominioDoMercadoLivre(parsed.hostname)) return 'fallback_dominio'
  const wid = parsed.searchParams.getAll('wid')
  if (wid.length !== 1 || wid[0] !== externalId) return 'fallback_wid'
  return null
}

export function resolveOfferUrl(opts: {
  catalogId: string
  externalId: string
  manualByItemId?: Readonly<Record<string, string>>
}): OfferUrlResolution {
  const manual = opts.manualByItemId?.[opts.externalId]
  const url = buildMlCatalogLink(opts.catalogId, opts.externalId)

  if (manual === undefined || manual === '') {
    return {
      url,
      destination: 'untracked_fallback',
      origin: 'none',
      validation: 'absent',
      reason: 'fallback_absent',
    }
  }

  const rejection = validarUrlManual(manual, opts.externalId)
  if (rejection) {
    return {
      url,
      destination: 'untracked_fallback',
      origin: 'legacy_manual',
      validation: 'rejected',
      reason: rejection,
    }
  }

  return {
    url,
    destination: 'untracked_fallback',
    origin: 'legacy_manual',
    validation: 'unverified',
    reason: 'fallback_unverified',
  }
}
