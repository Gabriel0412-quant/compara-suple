import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildRollbackAffiliateLinks, type PersistedAffiliateOffer } from './affiliate-links'

const persistedOffer = fc.record({
  prefix: fc.constantFrom('MLB', 'MLBU'),
  catalogNumber: fc.integer({ min: 1, max: 999_999_999 }),
  externalNumber: fc.integer({ min: 1, max: 999_999_999 }),
  sellerId: fc.integer({ min: 1, max: 999_999_999 }),
}).map(({ prefix, catalogNumber, externalNumber, sellerId }): PersistedAffiliateOffer => ({
  external_id: `MLB${externalNumber}`,
  seller_id: sellerId,
  source_catalog_id: `${prefix}${catalogNumber}`,
}))

describe('affiliate link rollback property', () => {
  it('TestProperty_BuildRollbackAffiliateLinks_ShouldPreservePersistedOfferIdentity', () => {
    fc.assert(fc.property(
      fc.array(persistedOffer, { maxLength: 30 }),
      offers => {
        const links = buildRollbackAffiliateLinks(offers)

        expect(links).toHaveLength(offers.length)
        links.forEach((link, index) => {
          const offer = offers[index]
          const url = new URL(link.url)
          const path = offer.source_catalog_id.startsWith('MLBU') ? 'up' : 'p'

          expect(link.external_id).toBe(offer.external_id)
          expect(link.seller_id).toBe(offer.seller_id)
          expect(url.pathname).toBe(`/${path}/${offer.source_catalog_id}`)
          expect(url.searchParams.getAll('wid')).toEqual([offer.external_id])
          expect(url.searchParams.has('affiliate')).toBe(false)
          expect(link.affiliate_link).toStrictEqual({
            origin: 'none',
            validation: 'absent',
            destination: 'untracked_fallback',
            reason: 'fallback_absent',
          })
        })
      },
    ), { numRuns: 200 })
  })
})
