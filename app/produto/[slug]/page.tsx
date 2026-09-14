import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PaginaDoProduto } from '@/components/produto/PaginaDoProduto'
import { ProdutoSemOfertas } from '@/components/produto/ProdutoSemOfertas'
import { categoriaDoProduto, getProductsByCategory } from '@/lib/categories'
import { estadoDoProduto, relacionadosPorDose } from '@/lib/produto'
import { flattenOffers, formatBRL, getProductBySlug, lowestPriceOffer } from '@/lib/products'

export const dynamic = 'force-dynamic'

/** Quantos relacionados a prateleira do pé carrega. Mesmo teto das da home. */
const RELACIONADOS = 12

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Produto não encontrado · Preço Suplemento' }

  const offers = flattenOffers(product)
  // "a partir de" é uma promessa de que não há nada mais barato. Só o menor
  // preço pode sustentá-la — o destaque do ML costuma ser mais caro.
  const lowest = lowestPriceOffer(offers)
  const priceTxt = lowest ? ` a partir de ${formatBRL(lowest.price)}` : ''

  return {
    title: `${product.name} — Comparar preços${priceTxt} · Preço Suplemento`,
    description: `Compare ${offers.length} ofertas de ${product.name}${
      product.brand ? ` (${product.brand.name})` : ''
    } no Mercado Livre${priceTxt}.`,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const categoria = categoriaDoProduto(product.name)
  const marca = product.brand?.name ?? null
  const offers = flattenOffers(product)

  /*
    Produto existe e nenhuma oferta está ativa. Sai antes de montar o estado
    porque não há preço a apresentar — `estadoDoProduto` devolveria `null` e a
    página teria que decidir a mesma coisa uma linha adiante.
  */
  if (offers.length === 0) {
    return <ProdutoSemOfertas nome={product.name} marca={marca} categoria={categoria} />
  }

  /*
    Dose e peso saem da variante principal, que hoje é a única: 22 produtos e
    23 variantes em produção. Quando o EP15 trouxer variantes de verdade, é
    aqui que a escolha passa a depender de qual está selecionada.
  */
  const primeira = product.variants[0]
  const servings = primeira?.servings ?? null
  const estado = estadoDoProduto(offers, { servings, sizeGrams: primeira?.size_grams ?? null })!

  /*
    Os relacionados só existem quando o produto tem categoria — sem ela não há
    recorte que sustente o título da fileira, e "outros produtos" seria uma
    prateleira sobre nada.
  */
  const relacionados = categoria
    ? relacionadosPorDose(await getProductsByCategory(categoria), product.slug, RELACIONADOS)
    : []

  return (
    <PaginaDoProduto
      nome={product.name}
      marca={marca}
      produtoId={product.id}
      categoria={categoria}
      estado={estado}
      ofertas={offers}
      servings={servings}
      relacionados={relacionados}
    />
  )
}
