import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import { ProductGridCard } from '@/components/category/ProductGridCard'
import {
  getCategoryBySlug,
  getProductsByCategory,
  listCategories,
} from '@/lib/categories'
import { getCatalogStats, formatUpdatedAt } from '@/lib/stats'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) {
    return { title: 'Categoria não encontrada · Preço Suplemento' }
  }
  return {
    title: `${cat.name} — Comparar preços · Preço Suplemento`,
    description: `${cat.description} Compare preços entre múltiplas lojas do Mercado Livre.`,
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const [products, { lastUpdated }] = await Promise.all([
    getProductsByCategory(cat),
    getCatalogStats(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: cat.name },
          ]}
        />

        {/* Hero da categoria */}
        <header className="mt-6 mb-8 bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="text-5xl md:text-6xl shrink-0">{cat.emoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                {cat.name}
              </h1>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-2xl">
                {cat.description}
              </p>
              <p className="text-xs text-gray-500 mt-3">
                {products.length}{' '}
                {products.length === 1 ? 'produto comparado' : 'produtos comparados'}
                {' '}· preços coletados {formatUpdatedAt(lastUpdated)}
              </p>
            </div>
          </div>
        </header>

        {/* Grid de produtos */}
        {products.length === 0 ? (
          <EmptyState categoryName={cat.shortName} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map(p => (
              <ProductGridCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Outras categorias (cross-nav SEO) */}
        <section className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            Outras categorias
          </h2>
          <div className="flex flex-wrap gap-2">
            {listCategories()
              .filter(c => c.slug !== cat.slug)
              .map(c => (
                <Link
                  key={c.slug}
                  href={`/categoria/${c.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-green-600 hover:text-green-600 transition-colors"
                >
                  <span>{c.emoji}</span>
                  <span>{c.shortName}</span>
                </Link>
              ))}
          </div>
        </section>

        <p className="text-xs text-gray-400 mt-10 text-center max-w-2xl mx-auto">
          Como Afiliado do Mercado Livre, ganhamos por compras qualificadas.
          O preço pra você é o mesmo.
        </p>
      </main>
    </div>
  )
}

function EmptyState({ categoryName }: { categoryName: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 md:p-16 text-center">
      <p className="text-4xl mb-4">📭</p>
      <h3 className="text-xl font-bold text-gray-800 mb-2">
        Ainda não temos {categoryName} no catálogo
      </h3>
      <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
        Estamos curando produtos novos toda semana. Em breve essa categoria estará bombando aqui.
      </p>
      <Link
        href="/produtos"
        className="inline-block px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
      >
        Ver todos os produtos →
      </Link>
    </div>
  )
}
