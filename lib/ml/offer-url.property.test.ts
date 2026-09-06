import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { resolveOfferUrl } from './offer-url'

const suffix = fc.string({ minLength: 1, maxLength: 24, unit: 'grapheme-composite' })

describe('resolveOfferUrl property', () => {
  it('TestProperty_ResolveOfferUrl_ShouldPreserveIdentityAndNeverInventAffiliate', () => {
    fc.assert(fc.property(
      fc.constantFrom('MLB', 'MLBU'),
      suffix,
      suffix,
      (prefix, catalogSuffix, externalId) => {
        const catalogId = `${prefix}0${catalogSuffix}`
        const resolution = resolveOfferUrl({ catalogId, externalId })
        const url = new URL(resolution.url)

        expect(url.pathname).toBe(`/${prefix === 'MLBU' ? 'up' : 'p'}/${encodeURIComponent(catalogId)}`)
        expect(url.searchParams.getAll('wid')).toEqual([externalId])
        expect(url.searchParams.has('affiliate')).toBe(false)
      },
    ), { numRuns: 200 })
  })

  it('TestProperty_ResolveOfferUrl_ShouldIsolateReviewedIdentityAndFallback', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 20, unit: 'grapheme-composite' }),
      fc.string({ minLength: 1, maxLength: 20, unit: 'grapheme-composite' }),
      (a, b) => {
        const externalA = `MLB-A-${a}`
        const externalB = `MLB-B-${b}`
        const urlA = `https://www.mercadolivre.com.br/social/${encodeURIComponent(`x${a}`)}?wid=${encodeURIComponent(externalA)}`
        const urlB = `https://www.mercadolivre.com.br/social/${encodeURIComponent(`x${b}`)}?wid=${encodeURIComponent(externalB)}`
        const manualByItemId = {
          [externalA]: { url: urlA, seller_id: 10, reviewed_at: '2026-09-05', review_ref: 'review-a' },
          [externalB]: { url: urlB, seller_id: 20, reviewed_at: '2026-09-05', review_ref: 'review-b' },
        }
        const resolutionA = resolveOfferUrl({ catalogId: 'MLB54', externalId: externalA, sellerId: 10, manualByItemId })
        const resolutionB = resolveOfferUrl({ catalogId: 'MLB54', externalId: externalB, sellerId: 20, manualByItemId })
        const rejected = resolveOfferUrl({ catalogId: 'MLB54', externalId: externalA, sellerId: 9, manualByItemId })

        expect(resolutionA).toMatchObject({ url: urlA, destination: 'affiliate_link', seller_id: 10 })
        expect(resolutionB).toMatchObject({ url: urlB, destination: 'affiliate_link', seller_id: 20 })
        const rejectedUrl = new URL(rejected.url)
        expect(rejected).toMatchObject({
          destination: 'untracked_fallback',
          origin: 'reviewed_import',
          validation: 'rejected',
          reason: 'fallback_seller',
        })
        expect(rejectedUrl.pathname).toBe('/p/MLB54')
        expect(rejectedUrl.searchParams.getAll('wid')).toEqual([externalA])
        expect(rejectedUrl.searchParams.has('affiliate')).toBe(false)
        expect(rejected.url).not.toBe(urlA)
        expect(rejected.url).not.toBe(urlB)
      },
    ), { numRuns: 100 })
  })
})
