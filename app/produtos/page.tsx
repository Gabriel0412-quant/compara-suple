import Header from '@/components/Header'
import { supabase } from '@/lib/db'

// Página simples de listagem dos produtos ingeridos. Server component:
// faz query no Supabase em tempo de renderização, sem cache.
export const dynamic = 'force-dynamic'

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

export default async function ProdutosPage() {
  const { data, error } = await supabase
    .from('product')
    .select(`
      id, name, slug, created_at,
      brand:brand_id ( name, slug ),
      variant ( id, flavor, size_grams,
        offer ( id, price, url, available, fetched_at, raw )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<ProductRow[]>()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Produtos no comparador
          </h1>
          <p className="text-gray-500">
            Catálogo curado, preços atualizados via API do Mercado Livre.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800 text-sm">
            <strong>Erro carregando produtos:</strong> {error.message}
          </div>
        )}

        {!error && (!data || data.length === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
            <strong>Nenhum produto ainda.</strong> Dispare o cron de ingestão pra popular:
            <code className="block mt-2 px-3 py-2 bg-yellow-100 rounded text-xs font-mono">
              curl -X POST {process.env.NEXT_PUBLIC_SITE_URL ?? 'https://compara-suple-sable.vercel.app'}/api/cron/ml-ingest -H "Authorization: Bearer $CRON_SECRET"
            </code>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.flatMap(product =>
              (product.variant ?? []).flatMap(variant =>
                (variant.offer ?? []).map(offer => {
                  const thumb =
                    offer.raw?.pictures?.[0]?.url ??
                    offer.raw?.thumbnail ??
                    null
                  const sold = offer.raw?.sold_quantity ?? null
                  const perKg = pricePerKg(offer.price, variant.size_grams)

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

                        <h2 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-2">
                          {product.name}
                        </h2>

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
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-2xl font-bold text-green-600">
                              {formatBRL(offer.price)}
                            </span>
                            {perKg && (
                              <span className="text-xs text-gray-500">{perKg}</span>
                            )}
                          </div>

                          <a
                            href={offer.url}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            className="block text-center w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                          >
                            Ver no Mercado Livre →
                          </a>

                          {!offer.available && (
                            <p className="text-xs text-red-600 mt-2 text-center">
                              Indisponível no momento
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                }),
              ),
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-10 text-center">
          Como Afiliado do Mercado Livre, ganhamos por compras qualificadas. O preço pra você é o mesmo.
        </p>
      </main>
    </div>
  )
}
