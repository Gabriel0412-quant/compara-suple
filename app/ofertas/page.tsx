import type { Metadata } from 'next'
import Link from 'next/link'

import Header from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ProductGridCard } from '@/components/category/ProductGridCard'
import { getProductsOnSale } from '@/lib/categories'
import { getCatalogStats, formatUpdatedAt } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ofertas em suplementos · Preço Suplemento',
  description:
    'Suplementos em promoção no Mercado Livre — wheys, creatina, pré-treino e mais com desconto.',
}

export default async function OfertasPage() {
  const [products, { lastUpdated }] = await Promise.all([
    getProductsOnSale(),
    getCatalogStats(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Ofertas' },
          ]}
        />

        <header className="mt-6 mb-8 bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="text-5xl md:text-6xl shrink-0">🔥</span>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                Ofertas em destaque
              </h1>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-2xl">
                Suplementos com desconto agora no Mercado Livre. Ordenados pelo maior desconto absoluto.
              </p>
              <p className="text-xs text-gray-500 mt-3">
                {products.length}{' '}
                {products.length === 1 ? 'produto em promoção' : 'produtos em promoção'}
                {' '}· preços coletados {formatUpdatedAt(lastUpdated)}
              </p>
            </div>
          </div>
        </header>

        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 md:p-16 text-center">
            <p className="text-4xl mb-4">😴</p>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Nenhuma promoção rolando agora
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Verificamos o ML diariamente — quando rolar desconto, aparece aqui.
            </p>
            <Link
              href="/produtos"
              className="inline-block px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Ver todos os produtos →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map(p => (
              <ProductGridCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
