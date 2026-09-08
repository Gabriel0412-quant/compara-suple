import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DiscountBadge, FallingCard, FallingCardPrice, discountFor } from './page'

const product = {
  id: 1, slug: 'whey-54', name: 'Whey 54', brand: 'Growth', thumbnail: null, offerCount: 2,
  featuredPrice: 90, featuredOriginalPrice: 120, lowestPrice: 80, lowestOfferId: 9,
  servings: 30, sizeGrams: 900, featuredPerDose: 3, featuredOfferId: 54,
}

describe('FallingCard', () => {
  it('renders sibling detail and tracked CTA for the featured offer', () => {
    const html = renderToStaticMarkup(<FallingCard product={product} />)
    expect(html).toContain('href="/produto/whey-54"')
    expect(html).toContain('href="/go/54?de=home&amp;por=destaque"')
    // O rótulo era "Comprar ...": sugeria que o checkout acontece aqui. Este
    // teste quebrou ao trocá-lo, que é exatamente o que ele deveria fazer.
    expect(html).toContain('aria-label="Ver oferta de Whey 54 no Mercado Livre (abre em nova aba)"')
    expect(html).toContain('Ir à loja')
    expect(html).toContain('-25%')
  })
  it('does not render the CTA without a featured offer', () => {
    const html = renderToStaticMarkup(<FallingCard product={{ ...product, featuredOfferId: null }} />)
    expect(html).toContain('href="/produto/whey-54"')
    expect(html).not.toContain('/go/')
  })
  it('renders image and omits discount branches when no discount applies', () => {
    const html = renderToStaticMarkup(<FallingCard product={{
      ...product, brand: null, thumbnail: 'https://img.test/whey.png', featuredPerDose: null,
      featuredOriginalPrice: 90, featuredOfferId: null,
    }} />)
    expect(html).toContain('src="https://img.test/whey.png"')
    expect(html).not.toContain('Economiza')
    expect(html).not.toContain('line-through')
    expect(html).not.toContain('Growth')
    expect(html).not.toContain('/dose')
  })
  it('computes and renders the exact discount values', () => {
    expect(discountFor(product)).toEqual({ originalPrice: 120, economy: 30, percentage: 25 })
    expect(discountFor({ ...product, featuredOriginalPrice: null })).toBeNull()
    expect(discountFor({ ...product, featuredOriginalPrice: undefined as unknown as null })).toBeNull()
    expect(discountFor({ ...product, featuredOriginalPrice: 80 })).toBeNull()
    const discountedPrice = renderToStaticMarkup(<FallingCardPrice product={product} discount={{ originalPrice: 120, economy: 30, percentage: 25 }} />)
    expect(discountedPrice).toContain('Economiza R$ 30,00')
    expect(discountedPrice).toContain('R$ 120,00')
    expect(discountedPrice).toContain('line-through')
    expect(renderToStaticMarkup(<DiscountBadge percentage={25} />)).toContain('-25%')
    expect(renderToStaticMarkup(<DiscountBadge percentage={null} />)).toBe('')
  })
  it('keeps discount markup absent for every non-discount boundary', () => {
    expect(discountFor({ ...product, featuredOriginalPrice: 90 })).toBeNull()
    expect(discountFor({ ...product, featuredOriginalPrice: null })).toBeNull()
    const html = renderToStaticMarkup(<FallingCardPrice product={product} discount={null} />)
    expect(html).toContain('R$ 90,00')
    expect(html).not.toContain('line-through')
    expect(html).not.toContain('Economiza')
  })
})
