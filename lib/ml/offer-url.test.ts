import { afterEach, describe, expect, it, vi } from 'vitest'
import { newOfferUrlCounters, resolveOfferUrl } from './offer-url'

const CATALOGO = 'MLB19049048'
const ITEM_A = 'MLB5872093596'
const ITEM_B = 'MLB4169713445'

function fallback(catalogId = CATALOGO, externalId = ITEM_A) {
  return `https://www.mercadolivre.com.br/${catalogId.startsWith('MLBU') ? 'up' : 'p'}/${encodeURIComponent(catalogId)}?wid=${encodeURIComponent(externalId)}`
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveOfferUrl', () => {
  it.each([undefined, 'tag-arbitraria', '   '])(
    'TestResolveOfferUrl_ShouldReturnUntrackedFallbackForMissingArbitraryOrBlankTag (%s)',
    affiliateTag => {
      vi.stubEnv('ML_AFFILIATE_TAG', affiliateTag ?? '')

      const resolution = resolveOfferUrl({ catalogId: CATALOGO, externalId: ITEM_A })

      expect(resolution).toEqual({
        url: fallback(),
        destination: 'untracked_fallback',
        origin: 'none',
        validation: 'absent',
        reason: 'fallback_absent',
      })
      expect(new URL(resolution.url).searchParams.getAll('wid')).toEqual([ITEM_A])
      expect(resolution.url).not.toContain('affiliate')
      if (affiliateTag) expect(resolution.url).not.toContain(affiliateTag)
      expect(resolveOfferUrl({
        catalogId: CATALOGO,
        externalId: ITEM_A,
        manualByItemId: { [ITEM_A]: '' },
      })).toEqual({
        url: fallback(),
        destination: 'untracked_fallback',
        origin: 'none',
        validation: 'absent',
        reason: 'fallback_absent',
      })
    },
  )

  it.each([
    'mercadolivre.com.br',
    'mercadolibre.com.br',
    'mercadolibre.com',
  ])('TestResolveOfferUrl_ShouldClassifyManualUrlWithoutOfficialProvenanceAsUnverifiedFallback (%s)', host => {
    const manual = `https://${host}/p/${CATALOGO}?wid=${ITEM_A}&campaign=legado`

    expect(resolveOfferUrl({
      catalogId: CATALOGO,
      externalId: ITEM_A,
      manualByItemId: { [ITEM_A]: manual },
    })).toEqual({
      url: fallback(),
      destination: 'untracked_fallback',
      origin: 'legacy_manual',
      validation: 'unverified',
      reason: 'fallback_unverified',
    })
  })

  it.each([
    ['somente espaços', '   ', 'fallback_url_invalida'],
    ['http', `http://www.mercadolivre.com.br/p/${CATALOGO}?wid=${ITEM_A}`, 'fallback_protocolo'],
    ['domínio de fora', `https://exemplo.com/p/${CATALOGO}?wid=${ITEM_A}`, 'fallback_dominio'],
    ['domínio parecido', `https://mercadolivre.com.br.exemplo.com/?wid=${ITEM_A}`, 'fallback_dominio'],
    ['sem wid', `https://www.mercadolivre.com.br/p/${CATALOGO}`, 'fallback_wid'],
    ['wid de outra oferta', `https://www.mercadolivre.com.br/p/${CATALOGO}?wid=${ITEM_B}`, 'fallback_wid'],
    ['wid duplicado igual', `https://www.mercadolivre.com.br/p/${CATALOGO}?wid=${ITEM_A}&wid=${ITEM_A}`, 'fallback_wid'],
    ['wid duplicado divergente', `https://www.mercadolivre.com.br/p/${CATALOGO}?wid=${ITEM_A}&wid=${ITEM_B}`, 'fallback_wid'],
    ['não é URL', 'nao-e-uma-url', 'fallback_url_invalida'],
  ] as const)('TestResolveOfferUrl_ShouldUseReasonSpecificFallbackForRejectedManualInputs (%s)', (_case, manual, reason) => {
    expect(resolveOfferUrl({
      catalogId: CATALOGO,
      externalId: ITEM_A,
      manualByItemId: { [ITEM_A]: manual },
    })).toEqual({
      url: fallback(),
      destination: 'untracked_fallback',
      origin: 'legacy_manual',
      validation: 'rejected',
      reason,
    })
  })

  it('TestBuildMlCatalogLink_ShouldEncodeCatalogAndKeepOneFallbackWidForMlbAndMlbu', () => {
    const cases = [
      ['MLB catálogo/54', 'MLB item?54', 'p'],
      ['MLBU catálogo/54', 'MLB item?54', 'up'],
    ] as const

    for (const [catalogId, externalId, route] of cases) {
      const resolution = resolveOfferUrl({ catalogId, externalId })
      const url = new URL(resolution.url)

      expect(url.pathname).toBe(`/${route}/${encodeURIComponent(catalogId)}`)
      expect(url.searchParams.getAll('wid')).toEqual([externalId])
      expect(url.searchParams.has('affiliate')).toBe(false)
    }
  })

  it('TestResolveOfferUrl_ShouldSelectReviewedUrlByteForByteWithFiniteMetadata', () => {
    const url = `https://www.mercadolivre.com.br/social/revisao%2F54?z=1&wid=${ITEM_A}&a=2#fragmento`
    const resolution = resolveOfferUrl({
      catalogId: CATALOGO,
      externalId: ITEM_A,
      sellerId: 99,
      manualByItemId: {
        [ITEM_A]: { url, seller_id: 99, reviewed_at: '2026-09-05', review_ref: 'ML54.02:review-1' },
      },
    } as never)

    expect(resolution).toMatchObject({
      url,
      destination: 'affiliate_link',
      origin: 'reviewed_import',
      validation: 'reviewed',
      reason: 'reviewed_import',
      seller_id: 99,
      reviewed_at: '2026-09-05',
      review_ref: 'ML54.02:review-1',
    })
  })

  it('TestResolveOfferUrl_ShouldRejectLegacyOrMismatchedReviewedEntriesPerOffer', () => {
    const reviewed = (overrides: Record<string, unknown> = {}) => ({
      url: `https://www.mercadolivre.com.br/social/revisao?wid=${ITEM_A}`,
      seller_id: 99,
      reviewed_at: '2026-09-05',
      review_ref: 'review-54',
      ...overrides,
    })
    const cases = [
      ['legado', `https://www.mercadolivre.com.br/social/revisao?wid=${ITEM_A}`, 'legacy_manual', 'unverified', 'fallback_unverified'],
      ['nulo', null, 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['número', 99, 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['booleano', true, 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['função', Object.assign(() => undefined, reviewed()), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['incompleto', { url: 'https://www.mercadolivre.com.br/social/revisao' }, 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['url não textual', reviewed({ url: 9 }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['seller zero', reviewed({ seller_id: 0 }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['seller negativo', reviewed({ seller_id: -1 }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['seller não inteiro', reviewed({ seller_id: 99.5 }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['seller divergente', reviewed({ seller_id: 98 }), 'reviewed_import', 'rejected', 'fallback_seller'],
      ['snapshot sem seller', reviewed(), 'reviewed_import', 'rejected', 'fallback_seller'],
      ['data nula', reviewed({ reviewed_at: null }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['data não textual coerente', reviewed({ reviewed_at: { toString: () => '2026-09-05' } }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['referência nula', reviewed({ review_ref: null }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
      ['objeto ambíguo', reviewed({ extra: 'ambiguous' }), 'reviewed_import', 'rejected', 'fallback_reviewed_metadata'],
    ]

    for (const [name, entry, origin, validation, reason] of cases) {
      const resolution = resolveOfferUrl({
        catalogId: CATALOGO,
        externalId: ITEM_A,
        sellerId: name === 'snapshot sem seller' ? undefined : 99,
        manualByItemId: { [ITEM_A]: entry },
      } as never)
      expect(resolution).toMatchObject({
        url: fallback(),
        destination: 'untracked_fallback',
        origin,
        validation,
        reason,
      })
    }

    expect(resolveOfferUrl({
      catalogId: CATALOGO,
      externalId: ITEM_A,
      sellerId: 99,
      manualByItemId: { [ITEM_B]: reviewed() },
    } as never)).toMatchObject({
      url: fallback(),
      destination: 'untracked_fallback',
      origin: 'none',
      validation: 'absent',
      reason: 'fallback_absent',
    })

    const duplicateUrl = 'https://www.mercadolivre.com.br/social/duplicada'
    const map = {
      [ITEM_A]: reviewed({ url: duplicateUrl }),
      [ITEM_B]: reviewed({ url: duplicateUrl, seller_id: 100 }),
    }
    for (const [externalId, sellerId] of [[ITEM_A, 99], [ITEM_B, 100]] as const) {
      expect(resolveOfferUrl({ catalogId: CATALOGO, externalId, sellerId, manualByItemId: map } as never))
        .toMatchObject({
          url: fallback(CATALOGO, externalId),
          destination: 'untracked_fallback',
          origin: 'reviewed_import',
          validation: 'rejected',
          reason: 'fallback_duplicate',
        })
    }
  })

  it.each([
    ['sem wid', 'https://www.mercadolivre.com.br/social/revisao'],
    ['wid correto', `https://www.mercadolivre.com.br/social/revisao?wid=${ITEM_A}`],
    ['wid duplicado', `https://www.mercadolivre.com.br/social/revisao?wid=${ITEM_A}&wid=${ITEM_A}`],
    ['wid divergente', `https://www.mercadolivre.com.br/social/revisao?wid=${ITEM_B}`],
    ['host parecido', 'https://www.mercadolivre.com.br.evil/social/revisao'],
    ['subdomínio', 'https://social.www.mercadolivre.com.br/social/revisao'],
    ['outro país', 'https://www.mercadolibre.com/social/revisao'],
    ['http', 'http://www.mercadolivre.com.br/social/revisao'],
    ['usuário', 'https://user@www.mercadolivre.com.br/social/revisao'],
    ['porta padrão explícita', 'https://www.mercadolivre.com.br:443/social/revisao'],
    ['porta alternativa', 'https://www.mercadolivre.com.br:444/social/revisao'],
    ['caminho vazio', 'https://www.mercadolivre.com.br/social'],
    ['barra final', 'https://www.mercadolivre.com.br/social/revisao/'],
    ['dot segment', 'https://www.mercadolivre.com.br/social/x/../revisao'],
    ['dot segment único', 'https://www.mercadolivre.com.br/social/.'],
    ['dot segment duplo', 'https://www.mercadolivre.com.br/social/..'],
    ['dot segment codificado', 'https://www.mercadolivre.com.br/social/%2e'],
    ['dot segment duplo codificado', 'https://www.mercadolivre.com.br/social/%2e%2e'],
    ['encoding inválido', 'https://www.mercadolivre.com.br/social/%ZZ'],
    ['barra invertida', 'https://www.mercadolivre.com.br/social/x\\revisao'],
    ['espaço', 'https://www.mercadolivre.com.br/social/revisao com espaço'],
    ['url malformada', 'https://www.mercadolivre.com.br:porta/social/revisao'],
    ['https maiúsculo', 'HTTPS://www.mercadolivre.com.br/social/revisao'],
    ['caminho social vazio', 'https://www.mercadolivre.com.br/social/'],
    ['outro caminho longo', 'https://www.mercadolivre.com.br/outros/segmento-comprido'],
    ['outro caminho', 'https://www.mercadolivre.com.br/p/MLB54'],
  ] as const)('TestResolveOfferUrl_ShouldEnforceExactReviewedSocialUrlAllowlist (%s)', (name, url) => {
    const resolution = resolveOfferUrl({
      catalogId: CATALOGO, externalId: ITEM_A, sellerId: 99,
      manualByItemId: { [ITEM_A]: { url, seller_id: 99, reviewed_at: '2026-09-05', review_ref: 'review-54' } },
    } as never)
    const accepted = name === 'sem wid' || name === 'wid correto'
    expect(resolution).toStrictEqual(accepted ? {
      url,
      destination: 'affiliate_link',
      origin: 'reviewed_import',
      validation: 'reviewed',
      reason: 'reviewed_import',
      seller_id: 99,
      reviewed_at: '2026-09-05',
      review_ref: 'review-54',
    } : {
      url: fallback(),
      destination: 'untracked_fallback',
      origin: 'reviewed_import',
      validation: 'rejected',
      reason: name === 'http' ? 'fallback_protocolo'
        : name.includes('wid') ? 'fallback_wid'
          : name === 'espaço' || name === 'url malformada' || name === 'encoding inválido' ? 'fallback_url_invalida'
            : 'fallback_dominio',
    })
  })

  it.each([
    ['2026-09-05', 'ref.54:ok', true],
    ['2026-09-05', 'token-review-1', true],
    ['2026-02-29', 'ref-54', false],
    ['05-09-2026', 'ref-54', false],
    ['2026-09-05', '', false],
    ['2026-09-05', 'x'.repeat(121), false],
    ['2026-09-05', 'ref/com-barra', false],
    ['2026-09-05', 'https://secret.example', false],
  ])('TestResolveOfferUrl_ShouldValidateReviewedMetadataByFormatOnly (%s, %s)', (reviewedAt, reviewRef, accepted) => {
    const resolution = resolveOfferUrl({
      catalogId: CATALOGO, externalId: ITEM_A, sellerId: 99,
      manualByItemId: { [ITEM_A]: {
        url: 'https://www.mercadolivre.com.br/social/revisao', seller_id: 99,
        reviewed_at: reviewedAt, review_ref: reviewRef,
      } },
    } as never)
    expect(resolution.destination === 'affiliate_link').toBe(accepted)
  })

  it('TestResolveOfferUrl_ShouldValidateReviewedLinksWithoutAdditionalNetworkSideEffect', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const resolution = resolveOfferUrl({
      catalogId: CATALOGO, externalId: ITEM_A, sellerId: 99,
      manualByItemId: { [ITEM_A]: {
        url: 'https://www.mercadolivre.com.br/social/revisao', seller_id: 99,
        reviewed_at: '2026-09-05', review_ref: 'review-54',
      } },
    } as never)

    expect(resolution.destination).toBe('affiliate_link')
    expect(resolveOfferUrl({
      catalogId: CATALOGO, externalId: ITEM_A, sellerId: 99,
      manualByItemId: { [ITEM_A]: {
        url: 'https://www.mercadolivre.com.br/social/.', seller_id: 99,
        reviewed_at: '2026-09-05', review_ref: 'review-invalid',
      } },
    } as never)).toMatchObject({
      destination: 'untracked_fallback', origin: 'reviewed_import', validation: 'rejected',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('starts all fallback counters at zero', () => {
    expect(newOfferUrlCounters()).toEqual({
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
    })
  })
})
