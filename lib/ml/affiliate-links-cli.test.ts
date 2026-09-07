import { describe, expect, it, vi } from 'vitest'

vi.mock('@/data/items.json', () => ({
  default: {
    items: [{
      catalog_id: 'MLB2',
      affiliate_urls: {
        MLB2: {
          url: 'https://www.mercadolivre.com.br/social/outro',
          seller_id: 10,
          reviewed_at: '2026-09-05',
          review_ref: 'ML54.02:outro',
        },
      },
    }, {
      catalog_id: 'MLB1',
      affiliate_urls: {
        MLB1: {
          url: 'https://www.mercadolivre.com.br/social/revisado',
          seller_id: 9,
          reviewed_at: '2026-09-05',
          review_ref: 'ML54.02:revisado',
        },
      },
    }],
  },
}))

import { affiliateOffersFromResponse, offerRowsFromResponse, persistedAffiliateOfferFromRow, rpcResultFromResponse, runAffiliateLinksCli, sellerIdFromRaw, storeIdFromResponse } from './affiliate-links-cli'

const offer = { external_id: 'MLB1', seller_id: 9, source_catalog_id: 'MLB1' }

function deps(overrides: Partial<Parameters<typeof runAffiliateLinksCli>[1]> = {}) {
  return {
    findStoreId: vi.fn().mockResolvedValue(77), loadOffers: vi.fn().mockResolvedValue([offer]),
    apply: vi.fn().mockResolvedValue({ recebidas: 1, alteradas: 1, iguais: 0 }), log: vi.fn(), ...overrides,
  }
}

describe('runAffiliateLinksCli', () => {
  it('uses the resolved store and defaults to simulation', async () => {
    const d = deps()
    await expect(runAffiliateLinksCli(['--catalog', 'MLB1'], d)).resolves.toBe(0)
    expect(d.loadOffers).toHaveBeenCalledWith(77, 'MLB1')
    expect(d.apply).toHaveBeenCalledWith(77, 'MLB1', [{
      external_id: 'MLB1',
      seller_id: 9,
      url: 'https://www.mercadolivre.com.br/social/revisado',
      affiliate_link: {
        origin: 'reviewed_import',
        validation: 'reviewed',
        destination: 'affiliate_link',
        reason: 'reviewed_import',
        seller_id: 9,
        reviewed_at: '2026-09-05',
        review_ref: 'ML54.02:revisado',
      },
    }], true)
    expect(d.log).toHaveBeenCalledWith('ml_affiliate_links_completed', { catalog_id: 'MLB1', simulado: true, recebidas: 1, alteradas: 1, iguais: 0 })
  })
  it.each([
    [[], 'catalog_required', deps()],
    [['--catalog', 'invalid'], 'catalog_invalid', deps()],
    [['--catalog', 'MLB1', '--catalog', 'MLB2'], 'argument_invalid', deps()],
  ])('rejects invalid arguments before querying dependencies', async (args, code, d) => {
    await expect(runAffiliateLinksCli(args, d)).resolves.toBe(1)
    expect(d.findStoreId).not.toHaveBeenCalled()
    expect(d.log).toHaveBeenCalledWith('ml_affiliate_links_failed', { code })
  })

  it.each([
    [['--catalog', 'MLB1'], deps({ findStoreId: vi.fn().mockResolvedValue(null) })],
    [['--catalog', 'MLB1'], deps({ loadOffers: vi.fn().mockRejectedValue(new Error('secret-canary')) })],
    [['--catalog', 'MLB1'], deps({ apply: vi.fn().mockResolvedValue(null) })],
  ])('returns a finite failure without raw errors', async (args, d) => {
    await expect(runAffiliateLinksCli(args, d)).resolves.toBe(1)
    expect(d.log).toHaveBeenCalledWith('ml_affiliate_links_failed', expect.objectContaining({ code: expect.any(String) }))
    expect(JSON.stringify(vi.mocked(d.log).mock.calls)).not.toContain('secret-canary')
  })
  it('makes rollback mutate only with apply', async () => {
    const d = deps()
    await expect(runAffiliateLinksCli(['--apply', '--rollback', '--catalog', 'MLB1'], d)).resolves.toBe(0)
    expect(d.apply).toHaveBeenCalledWith(77, 'MLB1', expect.any(Array), false)
  })

  it('uses an empty reviewed catalog as a fallback batch instead of failing', async () => {
    const d = deps({ loadOffers: vi.fn().mockResolvedValue([{ ...offer, external_id: 'MLB3', source_catalog_id: 'MLB3' }]) })

    await expect(runAffiliateLinksCli(['--catalog', 'MLB3'], d)).resolves.toBe(0)

    expect(d.apply).toHaveBeenCalledWith(77, 'MLB3', [], true)
  })
})

describe('persistedAffiliateOfferFromRow', () => {
  it('preserves only a matching catalog and positive safe-integer seller identity', () => {
    expect(persistedAffiliateOfferFromRow({ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: 9 } }, 'MLB1')).toEqual(offer)
  })

  it.each([
    [{ source_catalog_id: 'MLB1', raw: { seller_id: 9 } }],
    [{ external_id: '', source_catalog_id: 'MLB1', raw: { seller_id: 9 } }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB2', raw: { seller_id: 9 } }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: null }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: 'seller=9' }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: '9' } }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: 9.5 } }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: 0 } }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: -1 } }],
    [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: Number.MAX_SAFE_INTEGER + 1 } }],
  ])('rejects an unsafe or mismatched persisted identity', row => {
    expect(persistedAffiliateOfferFromRow(row, 'MLB1')).toBeNull()
  })
})

describe('affiliate-links CLI response boundaries', () => {
  it.each([
    [null, null, null],
    [{ id: 0 }, null, null],
    [{ id: 9.5 }, null, null],
    [{ id: Number.MAX_SAFE_INTEGER + 1 }, null, null],
    [{ id: 9 }, { code: 'db' }, null],
    [{ id: 9 }, null, 9],
  ])('accepts only a positive safe store ID', (data, error, expected) => {
    expect(storeIdFromResponse(data, error)).toBe(expected)
  })

  it.each([
    [null, null, null],
    [{}, null, null],
    [[], { code: 'db' }, null],
    [[{ external_id: 'MLB1' }], null, [{ external_id: 'MLB1' }]],
  ])('accepts offer rows only when the database response has no error', (data, error, expected) => {
    expect(offerRowsFromResponse(data, error)).toEqual(expected)
  })

  it.each([
    [null, null, null],
    [undefined, null, null],
    ['contador', null, null],
    [{ recebidas: 1, alteradas: 1, iguais: 0 }, { code: 'db' }, null],
    [{ recebidas: '1', alteradas: 1, iguais: 0 }, null, null],
    [{ recebidas: 1, alteradas: Number.NaN, iguais: 0 }, null, null],
    [{ recebidas: 1, alteradas: 1, iguais: -1 }, null, null],
    [{ recebidas: Number.MAX_SAFE_INTEGER + 1, alteradas: 1, iguais: 0 }, null, null],
    [{ recebidas: 1, alteradas: 1, iguais: 0 }, null, { recebidas: 1, alteradas: 1, iguais: 0 }],
  ])('accepts the RPC result only without a database error', (data, error, expected) => {
    expect(rpcResultFromResponse(data, error)).toEqual(expected)
  })

  it('turns a response failure or invalid identity into a finite loader failure', () => {
    expect(() => affiliateOffersFromResponse(null, null, 'MLB1')).toThrow('offer_response_invalid')
    expect(() => affiliateOffersFromResponse([{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: 0 } }], null, 'MLB1')).toThrow('offer_identity_invalid')
    expect(affiliateOffersFromResponse([{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: { seller_id: 9 } }], null, 'MLB1')).toEqual([offer])
  })

  it.each([
    [null, undefined],
    ['seller=9', undefined],
    [{}, undefined],
    [{ seller_id: '9' }, undefined],
    [{ seller_id: 9 }, 9],
  ])('extracts only numeric seller IDs from raw metadata', (raw, expected) => {
    expect(sellerIdFromRaw(raw)).toBe(expected)
  })
})
