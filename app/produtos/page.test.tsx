import { describe, expect, it } from 'vitest'
import { filtrarPorTermo, parseTermoBusca } from '@/lib/busca'

/**
 * Contrato da listagem: o que a página faz entre receber `?q=` e renderizar.
 * O JSX em si não é exercitado aqui — o projeto ainda não tem infra de E2E
 * (ver EP14) —, mas as duas decisões que quebram a página em produção são
 * puras e cabem em teste: quais ofertas entram na lista e como o termo filtra.
 */

type Oferta = { id: number; available: boolean }
type Variante = { flavor: string | null; offer: Oferta[] | null }
type Produto = { name: string; brand: { name: string } | null; variant: Variante[] | null }

/** Espelha o achatamento feito na página. */
function achatar(produtos: Produto[]) {
  return produtos.flatMap(product =>
    (product.variant ?? []).flatMap(variant =>
      (variant.offer ?? [])
        .filter(offer => offer.available)
        .map(offer => ({ product, variant, offer })),
    ),
  )
}

const camposDe = (i: ReturnType<typeof achatar>[number]) => [
  i.product.name,
  i.product.brand?.name,
  i.variant.flavor,
]

const catalogo: Produto[] = [
  {
    name: 'Whey Protein Concentrado',
    brand: { name: 'Growth Supplements' },
    variant: [{ flavor: 'Baunilha', offer: [{ id: 1, available: true }, { id: 2, available: false }] }],
  },
  {
    name: 'Creatina Monohidratada',
    brand: { name: 'Integralmédica' },
    variant: [{ flavor: null, offer: [{ id: 3, available: true }] }],
  },
  {
    name: 'Whey Isolado',
    brand: { name: 'Max Titanium' },
    variant: [{ flavor: 'Chocolate', offer: [{ id: 4, available: false }] }],
  },
]

describe('listagem de produtos', () => {
  it('deixa de fora oferta indisponível', () => {
    const itens = achatar(catalogo)
    expect(itens.map(i => i.offer.id)).toEqual([1, 3])
  })

  it('não quebra com produto sem variante ou variante sem oferta', () => {
    expect(achatar([{ name: 'X', brand: null, variant: null }])).toEqual([])
    expect(achatar([{ name: 'X', brand: null, variant: [{ flavor: null, offer: null }] }])).toEqual([])
  })

  it('sem termo, devolve todas as ofertas compráveis', () => {
    const itens = achatar(catalogo)
    expect(filtrarPorTermo(itens, '', camposDe)).toHaveLength(2)
  })

  it('filtra por nome do produto', () => {
    const itens = achatar(catalogo)
    const r = filtrarPorTermo(itens, 'creatina', camposDe)
    expect(r).toHaveLength(1)
    expect(r[0].offer.id).toBe(3)
  })

  it('filtra por marca ignorando acento', () => {
    const itens = achatar(catalogo)
    expect(filtrarPorTermo(itens, 'integralmedica', camposDe)).toHaveLength(1)
  })

  it('filtra por sabor da variante', () => {
    const itens = achatar(catalogo)
    const r = filtrarPorTermo(itens, 'baunilha', camposDe)
    expect(r).toHaveLength(1)
    expect(r[0].offer.id).toBe(1)
  })

  it('não devolve produto cuja única oferta está indisponível', () => {
    const itens = achatar(catalogo)
    // "Whey Isolado" existe no catálogo, mas só com oferta fora do ar.
    expect(filtrarPorTermo(itens, 'isolado', camposDe)).toHaveLength(0)
  })

  it('busca sem resultado é distinguível de catálogo vazio', () => {
    const itens = achatar(catalogo)
    const termo = parseTermoBusca('bcaa')
    const resultados = filtrarPorTermo(itens, termo, camposDe)
    expect(termo !== '' && resultados.length === 0).toBe(true)
    expect(termo === '' && itens.length === 0).toBe(false)
  })
})
