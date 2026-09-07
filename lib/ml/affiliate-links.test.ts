import { describe, expect, it, vi } from 'vitest'
import {
  buildRollbackAffiliateLinks,
  parseAffiliateLinksCliArgs,
  prepareReviewedAffiliateLinks,
} from './affiliate-links'

const offer = {
  external_id: 'MLB5403', seller_id: 5403, source_catalog_id: 'MLB5403CAT',
}

describe('affiliate links offline', () => {
  it('TestRollbackAffiliateLinks_ShouldBuildFallbackWithoutMlClientOrExternalNetwork', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    expect(buildRollbackAffiliateLinks([offer])).toStrictEqual([{
      external_id: 'MLB5403', seller_id: 5403,
      url: 'https://www.mercadolivre.com.br/p/MLB5403CAT?wid=MLB5403',
      affiliate_link: {
        origin: 'none', validation: 'absent', destination: 'untracked_fallback', reason: 'fallback_absent',
      },
    }])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('builds each rollback fallback from the persisted catalog and offer identity', () => {
    expect(buildRollbackAffiliateLinks([
      offer,
      { external_id: 'MLB77', seller_id: 77, source_catalog_id: 'MLBU77' },
    ])).toStrictEqual([
      {
        external_id: 'MLB5403', seller_id: 5403,
        url: 'https://www.mercadolivre.com.br/p/MLB5403CAT?wid=MLB5403',
        affiliate_link: {
          origin: 'none', validation: 'absent', destination: 'untracked_fallback', reason: 'fallback_absent',
        },
      },
      {
        external_id: 'MLB77', seller_id: 77,
        url: 'https://www.mercadolivre.com.br/up/MLBU77?wid=MLB77',
        affiliate_link: {
          origin: 'none', validation: 'absent', destination: 'untracked_fallback', reason: 'fallback_absent',
        },
      },
    ])
  })

  it('TestAffiliateLinksLoader_ShouldIgnoreHistoricalCatalogLinksAndRequireReviewedObjects', () => {
    expect(prepareReviewedAffiliateLinks('MLB5403CAT', [offer], {
      MLB5403: 'https://www.mercadolivre.com.br/social/legado?wid=MLB5403',
    })).toEqual([])
    expect(prepareReviewedAffiliateLinks('MLB5403CAT', [offer], {
      MLB5403: { affiliate_url: 'https://www.mercadolivre.com.br/social/historico?wid=MLB5403' },
    } as never)).toEqual([])
    expect(prepareReviewedAffiliateLinks('MLB5403CAT', [offer], {
      MLB5403: {
        url: 'https://www.mercadolivre.com.br/social/revisada?wid=MLB5403',
        seller_id: 5403, reviewed_at: '2026-09-05', review_ref: 'review-5403',
      },
    })).toStrictEqual([{
      external_id: 'MLB5403', seller_id: 5403,
      url: 'https://www.mercadolivre.com.br/social/revisada?wid=MLB5403',
      affiliate_link: {
        origin: 'reviewed_import', validation: 'reviewed', destination: 'affiliate_link', reason: 'reviewed_import',
        seller_id: 5403, reviewed_at: '2026-09-05', review_ref: 'review-5403',
      },
    }])
  })

  it.each([
    [[], { ok: false, code: 'catalog_required' }],
    [['--apply'], { ok: false, code: 'catalog_required' }],
    [['--catalog', 'MLB5403'], { ok: true, simular: true, catalogId: 'MLB5403' }],
    [['--apply', '--catalog', 'MLB5403'], { ok: true, simular: false, catalogId: 'MLB5403' }],
    [['--rollback', '--catalog', 'x'], { ok: false, code: 'catalog_invalid' }],
    [['--rollback', '--catalog', 'MLB5403'], { ok: true, simular: true, catalogId: 'MLB5403', rollback: true }],
    [['--apply', '--rollback', '--catalog', 'MLB5403'], { ok: true, simular: false, catalogId: 'MLB5403', rollback: true }],
    [['--rollback', '--apply', '--catalog', 'MLB5403'], { ok: true, simular: false, catalogId: 'MLB5403', rollback: true }],
    [['--catalog', 'MLBU5403'], { ok: true, simular: true, catalogId: 'MLBU5403' }],
    [['--catalog', ' mlbu5403 '], { ok: true, simular: true, catalogId: 'MLBU5403' }],
    [['--catalog', 'MLB5403', '--catalog', 'MLB1'], { ok: false, code: 'argument_invalid' }],
    [['--apply', '--apply', '--catalog', 'MLB5403'], { ok: false, code: 'argument_invalid' }],
    [['--rollback', '--rollback', '--catalog', 'MLB5403'], { ok: false, code: 'argument_invalid' }],
    [['--catalog'], { ok: false, code: 'catalog_required' }],
    [['--catalog', ''], { ok: false, code: 'catalog_required' }],
    [['--catalog', '--apply'], { ok: false, code: 'catalog_required' }],
    [['--catalog', 'MLB5403', '--unknown'], { ok: false, code: 'argument_invalid' }],
    [['--catalog', 'MLB5403', 'extra'], { ok: false, code: 'argument_invalid' }],
  ])('TestAffiliateLinksCli_ShouldDefaultToSimulationAndRequireExplicitMutationTarget (%j)', (args, expected) => {
    expect(parseAffiliateLinksCliArgs(args)).toEqual(expected)
  })
})
