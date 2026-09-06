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
})
