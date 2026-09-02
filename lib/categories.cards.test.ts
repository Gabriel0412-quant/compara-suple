import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filtrarPorTermo } from './busca'
import { getCategoryBySlug, listCategories, type CategoryProduct } from './categories'

/**
 * Contrato de apresentação dos cards de catálogo.
 *
 * A montagem do card (`rowToCard`) é interna ao módulo e já é exercitada pelos
 * testes de categoria; o que se cobre aqui é o que a listagem de `/produtos`
 * decide em cima dela: como o termo filtra e o que o card precisa carregar
 * para ser renderizável sem link morto.
 */

function card(over: Partial<CategoryProduct> = {}): CategoryProduct {
  return {
    id: 1,
    slug: 'whey-growth',
    name: 'Whey Protein Concentrado',
    brand: 'Growth Supplements',
    thumbnail: null,
    offerCount: 3,
    featuredPrice: 100,
    featuredOriginalPrice: null,
    featuredOfferId: 10,
    lowestPrice: null,
    lowestOfferId: null,
    servings: 30,
    sizeGrams: 1000,
    featuredPerDose: 100 / 30,
    ...over,
  }
}

describe('busca sobre o catálogo de cards', () => {
  const catalogo = [
    card(),
    card({ id: 2, name: 'Creatina Monohidratada', brand: 'Integralmédica', slug: 'creatina' }),
    card({ id: 3, name: 'Whey Isolado', brand: 'Max Titanium', slug: 'whey-max' }),
  ]
  const campos = (p: CategoryProduct) => [p.name, p.brand]

  it('filtra por nome', () => {
    const r = filtrarPorTermo(catalogo, 'creatina', campos)
    expect(r.map(p => p.id)).toEqual([2])
  })

  it('filtra por marca ignorando acento', () => {
    expect(filtrarPorTermo(catalogo, 'integralmedica', campos).map(p => p.id)).toEqual([2])
  })

  it('exige todas as palavras do termo', () => {
    expect(filtrarPorTermo(catalogo, 'whey max', campos).map(p => p.id)).toEqual([3])
  })

  it('termo vazio devolve o catálogo inteiro', () => {
    expect(filtrarPorTermo(catalogo, '', campos)).toHaveLength(3)
  })

  it('termo sem correspondência devolve vazio', () => {
    expect(filtrarPorTermo(catalogo, 'bcaa', campos)).toHaveLength(0)
  })
})

describe('dados que o card precisa carregar', () => {
  it('produto com doses expõe preço por dose', () => {
    expect(card().featuredPerDose).toBeCloseTo(3.333, 2)
  })

  it('produto sem doses mas com peso permite calcular preço por quilo', () => {
    const p = card({ servings: null, featuredPerDose: null, sizeGrams: 900, featuredPrice: 90 })
    expect(p.featuredPerDose).toBeNull()
    expect((p.featuredPrice / p.sizeGrams!) * 1000).toBeCloseTo(100, 5)
  })

  it('produto sem doses e sem peso não tem preço normalizado', () => {
    const p = card({ servings: null, featuredPerDose: null, sizeGrams: null })
    expect(p.featuredPerDose).toBeNull()
    expect(p.sizeGrams).toBeNull()
  })

  it('peso zero não vira divisão por zero', () => {
    const p = card({ servings: null, featuredPerDose: null, sizeGrams: 0 })
    // A guarda do card é `sizeGrams && sizeGrams > 0`.
    expect(Boolean(p.sizeGrams && p.sizeGrams > 0)).toBe(false)
  })

  it('sem oferta destacada o card não tem destino de compra', () => {
    expect(card({ featuredOfferId: null }).featuredOfferId).toBeNull()
  })

  it('menor preço só é linha extra quando contradiz o destaque', () => {
    const contradiz = card({ lowestPrice: 80, lowestOfferId: 11 })
    expect(contradiz.lowestPrice! < contradiz.featuredPrice).toBe(true)

    const concorda = card({ lowestPrice: 100, lowestOfferId: 10 })
    expect(concorda.lowestPrice! < concorda.featuredPrice).toBe(false)
  })
})

describe('atalhos de categoria da home', () => {
  it('o slug nunca é derivado do rótulo por transformação de texto', () => {
    // Regressão: a home montava `/categoria/${tag.toLowerCase().replace(...)}`.
    // "Whey Isolado" virava "whey-isolado", que não existe — 404 no primeiro
    // atalho da home. Os slugs agora vêm de listCategories().
    const home = readFileSync(resolve(process.cwd(), 'app/page.tsx'), 'utf8')
    expect(home).not.toContain('`/categoria/${tag')
    expect(home).toContain('`/categoria/${categoria.slug}`')
  })

  it('todo slug de categoria conhecido resolve para uma categoria', () => {
    for (const categoria of listCategories()) {
      expect(getCategoryBySlug(categoria.slug)).not.toBeNull()
    }
  })

  it('slug inventado não resolve', () => {
    expect(getCategoryBySlug('whey-isolado')).toBeNull()
  })
})
