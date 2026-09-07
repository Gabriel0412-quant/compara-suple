import { buildMlCatalogLink } from '../affiliate'
import {
  resolveOfferUrl,
  type AffiliateUrlEntry,
  type OfferUrlResolution,
} from './offer-url'
import { classificarIdCatalogo } from './catalog-id'

export type PersistedAffiliateOffer = {
  external_id: string
  seller_id: number
  source_catalog_id: string
}

export type AffiliateLinkItem = {
  external_id: string
  seller_id: number
  url: string
  affiliate_link: Record<string, unknown>
}

type CliArgs =
  | { ok: true; simular: boolean; catalogId: string; rollback?: boolean }
  | { ok: false; code: 'catalog_required' | 'catalog_invalid' | 'argument_invalid' }

type CliFailureCode = Extract<CliArgs, { ok: false }>['code']

type CliParserState = {
  apply?: true
  rollback?: true
  catalogId?: string
}

type CliParserStep =
  | { state: CliParserState; nextIndex: number }
  | { failureCode: CliFailureCode }

function affiliateLinkMetadata(link: OfferUrlResolution & { destination: 'affiliate_link'; seller_id: number; reviewed_at: string; review_ref: string }): Record<string, unknown> {
  return {
    origin: link.origin,
    validation: link.validation,
    destination: link.destination,
    reason: link.reason,
    seller_id: link.seller_id,
    reviewed_at: link.reviewed_at,
    review_ref: link.review_ref,
  }
}

export function prepareReviewedAffiliateLinks(
  catalogId: string,
  offers: readonly PersistedAffiliateOffer[],
  entries: Readonly<Record<string, AffiliateUrlEntry>>,
): AffiliateLinkItem[] {
  return offers.flatMap(offer => {
    const link = resolveOfferUrl({
      catalogId,
      externalId: offer.external_id,
      sellerId: offer.seller_id,
      manualByItemId: entries,
    })
    if (link.destination !== 'affiliate_link') return []
    return [{
      external_id: offer.external_id,
      seller_id: offer.seller_id,
      url: link.url,
      affiliate_link: affiliateLinkMetadata(link as OfferUrlResolution & { destination: 'affiliate_link'; seller_id: number; reviewed_at: string; review_ref: string }),
    }]
  })
}

export function buildRollbackAffiliateLinks(
  offers: readonly PersistedAffiliateOffer[],
): AffiliateLinkItem[] {
  return offers.map(offer => ({
    external_id: offer.external_id,
    seller_id: offer.seller_id,
    url: buildMlCatalogLink(offer.source_catalog_id, offer.external_id),
    affiliate_link: {
      origin: 'none',
      validation: 'absent',
      destination: 'untracked_fallback',
      reason: 'fallback_absent',
    },
  }))
}

export function parseAffiliateLinksCliArgs(args: readonly string[]): CliArgs {
  let state: CliParserState = {}

  for (let index = 0; index < args.length; index += 1) {
    const step = parseCliArgument(args, index, state)
    if ('failureCode' in step) return cliFailure(step.failureCode)
    state = step.state
    index = step.nextIndex
  }

  return finishCliParsing(state)
}

function parseCliArgument(
  args: readonly string[],
  index: number,
  state: CliParserState,
): CliParserStep {
  const argument = args[index]
  if (argument === '--apply') return setUniqueCliFlag(state, 'apply', index)
  if (argument === '--rollback') return setUniqueCliFlag(state, 'rollback', index)
  if (argument === '--catalog') return readCatalogCliArgument(args, index, state)
  return { failureCode: 'argument_invalid' }
}

function setUniqueCliFlag(
  state: CliParserState,
  flag: 'apply' | 'rollback',
  index: number,
): CliParserStep {
  if (state[flag]) return { failureCode: 'argument_invalid' }
  return { state: { ...state, [flag]: true }, nextIndex: index }
}

function readCatalogCliArgument(
  args: readonly string[],
  index: number,
  state: CliParserState,
): CliParserStep {
  const candidate = args[index + 1]
  if (catalogArgumentMissing(candidate)) return { failureCode: 'catalog_required' }
  if (state.catalogId !== undefined) return { failureCode: 'argument_invalid' }
  return { state: { ...state, catalogId: candidate }, nextIndex: index + 1 }
}

function catalogArgumentMissing(candidate: string | undefined): boolean {
  return candidate === undefined || candidate === '' || candidate.startsWith('--')
}

function finishCliParsing(state: CliParserState): CliArgs {
  if (state.catalogId === undefined) return cliFailure('catalog_required')
  const catalogId = state.catalogId.trim().toUpperCase()
  if (!['catalog_product', 'user_product'].includes(classificarIdCatalogo(catalogId))) {
    return cliFailure('catalog_invalid')
  }
  return {
    ok: true,
    simular: !state.apply,
    catalogId,
    ...(state.rollback ? { rollback: true } : {}),
  }
}

function cliFailure(code: CliFailureCode): CliArgs {
  return { ok: false, code }
}
