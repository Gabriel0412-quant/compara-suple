import type { Metadata } from 'next'
import Link from 'next/link'
import CampoBusca from '@/components/CampoBusca'
import Header from '@/components/Header'
import { filtrarPorTermo, parseTermoBusca } from '@/lib/busca'
import { supabase } from '@/lib/db'

// Página simples de listagem dos produtos ingeridos. Server component:
// faz query no Supabase em tempo de renderização, sem cache.
export const dynamic = 'force-dynamic'

// Era a única página de listagem sem metadata própria, então herdava o título
// do layout — aparecia como "Create Next App" no Google e na aba do navegador.
type Props = { searchParams: Promise<{ q?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const termo = parseTermoBusca((await searchParams).q)
  if (!termo) {
    return {
      title: 'Produtos no comparador · ComparaSuple',
      description:
        'Catálogo curado de suplementos com preços do Mercado Livre, custo por dose e custo por quilo.',
    }
  }
  // Resultado de busca não entra no índice: são infinitas combinações do mesmo
  // catálogo, e indexá-las só geraria conteúdo duplicado concorrendo consigo.
  return {
    title: `Busca por "${termo}" · ComparaSuple`,
    robots: { index: false, follow: true },
  }
}

type OfferRow = {
  id: number
  price: number
  url: string
  available: boolean
  fetched_at: string
  raw: {
    thumbnail?: string
    pictures?: Array<{ url: string }>
    sold_quantity?: number
    permalink?: string
  } | null
}

type VariantRow = {
  id: number
  flavor: string | null
  size_grams: number | null
  servings: number | null
  offer: OfferRow[] | null
}

type ProductRow = {
  id: number
  name: string
  slug: string
  created_at: string
  brand: { name: string; slug: string } | null
  variant: VariantRow[] | null
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function pricePerKg(price: number, sizeGrams: number | null): string | null {
  if (!sizeGrams || sizeGrams <= 0) return null
  const perKg = (price / sizeGrams) * 1000
  return `${formatBRL(perKg)} / kg`
}

function pricePerDose(price: number, servings: number | null): string | null {
  if (!servings || servings <= 0) return null
  return `${formatBRL(price / servings)} / dose`
}

export default async function ProdutosPage({ searchParams }: Props) {
  const termo = parseTermoBusca((await searchParams).q)

  const { data, error } = await supabase
    .from('product')
    .select(`
      id, name, slug, created_at,
      brand:brand_id ( name, slug ),
      variant ( id, flavor, size_grams, servings,
        offer ( id, price, url, available, fetched_at, raw )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<ProductRow[]>()

  // Uma linha por oferta comprável. Ofertas indisponíveis ficam de fora aqui,
  // e não escondidas atrás de um aviso: desde que a reconciliação passou a
  // marcar o que saiu do ar, elas são centenas, e um card que não leva a uma
  // compra é ruído. Mesmo critério que `flattenOffers` aplica no resto do site.
  const itens = (data ?? []).flatMap(product =>
    (product.variant ?? []).flatMap(variant =>
      (variant.offer ?? [])
        .filter(offer => offer.available)
        .map(offer => ({ product, variant, offer })),
    ),
  )

  const resultados = filtrarPorTermo(itens, termo, item => [
    item.product.name,
    item.product.brand?.name,
    item.variant.flavor,
  ])

  const buscaSemResultado = termo !== '' && resultados.length === 0
  const catalogoVazio = termo === '' && itens.length === 0

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {termo ? `Resultados para "${termo}"` : 'Produtos no comparador'}
          </h1>
          <p className="text-gray-500 mb-5">
            {termo
              ? `${resultados.length} ${resultados.length === 1 ? 'oferta encontrada' : 'ofertas encontradas'} no catálogo.`
              : 'Catálogo curado, preços atualizados via API do Mercado Livre.'}
          </p>

          <CampoBusca termoInicial={termo} className="max-w-xl" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800 text-sm">
            <strong>Não conseguimos carregar o catálogo agora.</strong>{' '}
            Tente recarregar a página em alguns instantes ou{' '}
            <Link href="/" className="underline font-medium">volte para a home</Link>.
          </div>
        )}

        {!error && catalogoVazio && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
            <strong>Nenhum produto disponível no momento.</strong>{' '}
            O catálogo é atualizado diariamente — tente novamente mais tarde ou{' '}
            <Link href="/" className="underline font-medium">veja as ofertas na home</Link>.
          </div>
        )}

        {!error && buscaSemResultado && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <p className="text-gray-800 font-semibold mb-1">
              Nenhuma oferta para &ldquo;{termo}&rdquo;.
            </p>
            <p className="text-gray-500 text-sm mb-4">
              Confira a grafia, tente um termo mais curto — &ldquo;whey&rdquo; no
              lugar de &ldquo;whey isolado sabor baunilha&rdquo; — ou navegue por categoria.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/produtos"
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Limpar busca
              </Link>
              <Link
                href="/comparar"
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:border-green-600 hover:text-green-600 transition-colors"
              >
                Abrir comparador
              </Link>
            </div>
          </div>
        )}

        {resultados.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {resultados.map(({ product, variant, offer }) => {
              const thumb =
                offer.raw?.pictures?.[0]?.url ??
                offer.raw?.thumbnail ??
                null
              const sold = offer.raw?.sold_quantity ?? null
              const perKg = pricePerKg(offer.price, variant.size_grams)
              const perDose = pricePerDose(offer.price, variant.servings)

              return (
                <article
                  key={offer.id}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {thumb && (
                    <div className="aspect-square bg-gray-50 flex items-center justify-center p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    {product.brand?.name && (
                      <span className="text-xs font-semibold text-green-600 mb-1">
                        {product.brand.name}
                      </span>
                    )}

                    <Link
                      href={`/produto/${product.slug}`}
                      className="block mb-2"
                    >
                      <h2 className="font-semibold text-sm text-gray-800 line-clamp-2 hover:text-green-600 transition-colors">
                        {product.name}
                      </h2>
                    </Link>

                    <div className="text-xs text-gray-500 mb-3 flex gap-2 flex-wrap">
                      {variant.flavor && <span>{variant.flavor}</span>}
                      {variant.size_grams && (
                        <span>· {variant.size_grams >= 1000
                          ? `${variant.size_grams / 1000} kg`
                          : `${variant.size_grams} g`}
                        </span>
                      )}
                      {sold !== null && <span>· {sold}+ vendidos</span>}
                    </div>

                    <div className="mt-auto">
                      <div className="mb-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-green-600">
                            {formatBRL(offer.price)}
                          </span>
                          {perDose && (
                            <span className="text-xs font-semibold text-green-700">
                              {perDose.replace(' / dose', '/dose')}
                            </span>
                          )}
                        </div>
                        {perKg && (
                          <span className="text-xs text-gray-400">{perKg}</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/produto/${product.slug}`}
                          className="flex-1 text-center py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:border-green-600 hover:text-green-600 transition-colors"
                        >
                          Comparar
                        </Link>
                        <a
                          href={`/go/${offer.id}`}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="flex-1 text-center py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                        >
                          Comprar →
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-10 text-center">
          Como Afiliado do Mercado Livre, ganhamos por compras qualificadas. O preço pra você é o mesmo.
        </p>
      </main>
    </div>
  )
}
