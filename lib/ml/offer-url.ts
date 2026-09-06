import { buildMlCatalogLink } from '../affiliate'

export type ReviewedAffiliateEntry = {
  url: string
  seller_id: number
  reviewed_at: string
  review_ref: string
}

export type AffiliateUrlEntry = string | ReviewedAffiliateEntry

export type OfferUrlReason =
  | 'reviewed_import'
  | 'fallback_absent'
  | 'fallback_unverified'
  | 'fallback_url_invalida'
  | 'fallback_protocolo'
  | 'fallback_dominio'
  | 'fallback_wid'
  | 'fallback_reviewed_metadata'
  | 'fallback_seller'
  | 'fallback_duplicate'

export type OfferUrlResolution = {
  url: string
  destination: 'affiliate_link' | 'untracked_fallback'
  origin: 'none' | 'legacy_manual' | 'reviewed_import'
  validation: 'absent' | 'unverified' | 'rejected' | 'reviewed'
  reason: OfferUrlReason
  seller_id?: number
  reviewed_at?: string
  review_ref?: string
}

export type OfferUrlCounters = Record<OfferUrlReason, number> & {
  affiliate_reviewed: number
  fallback: number
}

type OfferUrlOptions = {
  catalogId: string
  externalId: string
  sellerId?: number
  manualByItemId?: Readonly<Record<string, AffiliateUrlEntry>>
}

type FallbackOptions = Pick<OfferUrlOptions, 'catalogId' | 'externalId'> & {
  origin: 'none' | 'legacy_manual' | 'reviewed_import'
  validation: 'absent' | 'unverified' | 'rejected'
  reason: OfferUrlReason
}

const DOMINIOS_ML = ['mercadolivre.com.br', 'mercadolibre.com.br', 'mercadolibre.com']

export function newOfferUrlCounters(): OfferUrlCounters {
  return {
    affiliate_reviewed: 0,
    fallback: 0,
    reviewed_import: 0,
    fallback_absent: 0,
    fallback_unverified: 0,
    fallback_url_invalida: 0,
    fallback_protocolo: 0,
    fallback_dominio: 0,
    fallback_wid: 0,
    fallback_reviewed_metadata: 0,
    fallback_seller: 0,
    fallback_duplicate: 0,
  }
}

function dominioDoMercadoLivre(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return DOMINIOS_ML.some(domain => host === domain || host.endsWith(`.${domain}`))
}

function parseUrl(url: string): URL | undefined {
  return URL.canParse(url) ? new URL(url) : undefined
}

function rejectionForWid(url: URL, externalId: string): OfferUrlReason | null {
  const wid = url.searchParams.getAll('wid')
  return wid.length === 1 && wid[0] === externalId ? null : 'fallback_wid'
}

function validarUrlManual(manual: string, externalId: string): OfferUrlReason | null {
  const parsed = parseUrl(manual)
  if (!parsed) return 'fallback_url_invalida'
  if (parsed.protocol !== 'https:') return 'fallback_protocolo'
  if (!dominioDoMercadoLivre(parsed.hostname)) return 'fallback_dominio'
  return rejectionForWid(parsed, externalId)
}

function isReviewedEntry(entry: unknown): entry is ReviewedAffiliateEntry {
  return typeof entry === 'object' && entry !== null
}

function validReviewedDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validReviewRef(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,120}$/.test(value)
}

function hasExactReviewedShape(entry: ReviewedAffiliateEntry): boolean {
  return Object.keys(entry).length === 4 && typeof entry.url === 'string'
}

function hasValidReviewedSeller(entry: ReviewedAffiliateEntry): boolean {
  return Number.isInteger(entry.seller_id) && entry.seller_id > 0
}

function hasValidReviewedMetadata(entry: ReviewedAffiliateEntry): boolean {
  return validReviewedDate(entry.reviewed_at)
    && typeof entry.review_ref === 'string'
    && validReviewRef(entry.review_ref)
}

function reviewedEntryIsComplete(entry: ReviewedAffiliateEntry): boolean {
  return hasExactReviewedShape(entry)
    && hasValidReviewedSeller(entry)
    && hasValidReviewedMetadata(entry)
}

function reviewedSocialAuthority(url: string): string | undefined {
  if (!url.startsWith('https://')) return undefined
  return url.slice('https://'.length).split(/[/?#]/, 1)[0]
}

function reviewedSocialPath(url: string): string | undefined {
  const rest = url.slice('https://www.mercadolivre.com.br'.length)
  return rest.split(/[?#]/, 1)[0]
}

function reviewedSocialSegment(url: string): string | null {
  const path = reviewedSocialPath(url)
  if (!path || !path.startsWith('/social/')) return null
  const segment = path.slice('/social/'.length)
  if (segment === '' || segment.includes('/') || segment.includes('\\')) return null
  return segment
}

function decodedSocialSegmentRejection(segment: string): OfferUrlReason | null {
  try {
    return ['.', '..'].includes(decodeURIComponent(segment)) ? 'fallback_dominio' : null
  } catch {
    return 'fallback_url_invalida'
  }
}

function reviewedSocialPathRejection(url: string): OfferUrlReason | null {
  const segment = reviewedSocialSegment(url)
  if (segment === null) return 'fallback_dominio'
  return decodedSocialSegmentRejection(segment)
}

function reviewedUrlStructureRejection(url: string, parsed: URL): OfferUrlReason | null {
  if (parsed.protocol !== 'https:') return 'fallback_protocolo'
  if (reviewedSocialAuthority(url) !== 'www.mercadolivre.com.br') return 'fallback_dominio'
  return reviewedSocialPathRejection(url)
}

function reviewedWidRejection(url: URL, externalId: string): OfferUrlReason | null {
  return url.searchParams.getAll('wid').length === 0 ? null : rejectionForWid(url, externalId)
}

function revisarUrlSocial(url: string, externalId: string): OfferUrlReason | null {
  if (/\s/.test(url)) return 'fallback_url_invalida'
  const parsed = parseUrl(url)
  if (!parsed) return 'fallback_url_invalida'
  const structureRejection = reviewedUrlStructureRejection(url, parsed)
  if (structureRejection !== null) return structureRejection
  return reviewedWidRejection(parsed, externalId)
}

function hasDuplicateReviewedUrl(
  entries: Readonly<Record<string, AffiliateUrlEntry>>,
  url: string,
): boolean {
  return Object.values(entries)
    .filter(entry => isReviewedEntry(entry) && entry.url === url)
    .length > 1
}

function hasAmbiguousReviewedUrl(opts: OfferUrlOptions, entry: ReviewedAffiliateEntry): boolean {
  return hasDuplicateReviewedUrl(opts.manualByItemId ?? {}, entry.url)
}

function fallback(opts: FallbackOptions): OfferUrlResolution {
  return {
    url: buildMlCatalogLink(opts.catalogId, opts.externalId),
    destination: 'untracked_fallback',
    origin: opts.origin,
    validation: opts.validation,
    reason: opts.reason,
  }
}

function resolveLegacyEntry(opts: OfferUrlOptions, entry: string): OfferUrlResolution {
  const rejection = validarUrlManual(entry, opts.externalId)
  if (rejection !== null) {
    return fallback({
      ...opts,
      origin: 'legacy_manual',
      validation: 'rejected',
      reason: rejection,
    })
  }
  return fallback({
    ...opts,
    origin: 'legacy_manual',
    validation: 'unverified',
    reason: 'fallback_unverified',
  })
}

function resolveReviewedEntry(
  opts: OfferUrlOptions,
  entry: unknown,
): OfferUrlResolution {
  if (!isReviewedEntry(entry) || !reviewedEntryIsComplete(entry)) {
    return fallback({
      ...opts,
      origin: 'reviewed_import',
      validation: 'rejected',
      reason: 'fallback_reviewed_metadata',
    })
  }
  if (entry.seller_id !== opts.sellerId) {
    return fallback({
      ...opts,
      origin: 'reviewed_import',
      validation: 'rejected',
      reason: 'fallback_seller',
    })
  }
  if (hasAmbiguousReviewedUrl(opts, entry)) {
    return fallback({
      ...opts,
      origin: 'reviewed_import',
      validation: 'rejected',
      reason: 'fallback_duplicate',
    })
  }
  const rejection = revisarUrlSocial(entry.url, opts.externalId)
  if (rejection !== null) {
    return fallback({
      ...opts,
      origin: 'reviewed_import',
      validation: 'rejected',
      reason: rejection,
    })
  }
  return {
    url: entry.url,
    destination: 'affiliate_link',
    origin: 'reviewed_import',
    validation: 'reviewed',
    reason: 'reviewed_import',
    seller_id: entry.seller_id,
    reviewed_at: entry.reviewed_at,
    review_ref: entry.review_ref,
  }
}

export function resolveOfferUrl(opts: OfferUrlOptions): OfferUrlResolution {
  const entry = opts.manualByItemId?.[opts.externalId]
  if (entry === undefined || entry === '') {
    return fallback({
      ...opts,
      origin: 'none',
      validation: 'absent',
      reason: 'fallback_absent',
    })
  }
  return typeof entry === 'string'
    ? resolveLegacyEntry(opts, entry)
    : resolveReviewedEntry(opts, entry)
}
