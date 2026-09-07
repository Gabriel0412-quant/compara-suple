import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OffersSection } from './OffersSection'

const offers = [
  { id: 10, external_id: 'MLB10', url: 'https://x', price: 80, available: true, fetched_at: '2026-01-01', ml_rank: 0, raw: { seller_id: 1 } },
  { id: 20, external_id: 'MLB20', url: 'https://x', price: 100, available: true, fetched_at: '2026-01-01', ml_rank: 1, raw: { seller_id: 2, official_store_id: 2 } },
]

describe('OffersSection', () => {
  it('uses produto by default and classifies the lowest price', () => {
    const html = renderToStaticMarkup(<OffersSection offers={offers} servings={20} />)

    expect(html).toContain('href="/go/10?de=produto&amp;por=menor_preco"')
    expect(html).toContain('href="/go/20?de=produto&amp;por=destaque"')
    expect(html).toContain('MENOR PREÇO')
  })

  it('uses comparador when requested', () => {
    const html = renderToStaticMarkup(<OffersSection offers={offers} servings={20} superficie="comparador" />)

    expect(html).toContain('href="/go/10?de=comparador&amp;por=menor_preco"')
    expect(html).toContain('href="/go/20?de=comparador&amp;por=destaque"')
  })
})
