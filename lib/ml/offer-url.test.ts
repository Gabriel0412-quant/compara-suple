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

  it('starts all fallback counters at zero', () => {
    expect(newOfferUrlCounters()).toEqual({
      fallback: 0,
      fallback_absent: 0,
      fallback_unverified: 0,
      fallback_url_invalida: 0,
      fallback_protocolo: 0,
      fallback_dominio: 0,
      fallback_wid: 0,
    })
  })
})
