import Link from 'next/link'
import { Flame, TrendingDown, Trophy } from 'lucide-react'

import CampoBusca from '@/components/CampoBusca'
import Header from '@/components/Header'
import { getProductsOnSale, type CategoryProduct } from '@/lib/categories'
import { formatBRL } from '@/lib/products'
import { getCatalogStats, formatCount, formatUpdatedAt } from '@/lib/stats'

export const dynamic = 'force-dynamic'

const searchTags = ['Whey Isolado', 'Creatina', 'Pré-treino', 'Hipercalórico', 'BCAA']

// ---------- Home ----------

export default async function Home() {
  // Busca os produtos em oferta (já vem ordenado por desconto absoluto)
  const [onSale, stats] = await Promise.all([getProductsOnSale(), getCatalogStats()])
  const topOffers = onSale.slice(0, 2)        // hero
  const fallingProducts = onSale.slice(0, 6)  // "em queda agora"

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* 2. Header */}
      <Header />

      {/* 3. Hero — text à esquerda + top 2 ofertas à direita */}
      <section className="bg-white py-10 md:py-14 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Left column */}
          <div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-gray-800 mb-4">
              O suplemento certo pelo{' '}
              <span className="text-green-600 underline decoration-wavy decoration-green-600">
                menor preço
              </span>{' '}
              do Brasil.
            </h1>
            <p className="text-gray-500 text-base md:text-lg mb-6 leading-relaxed">
              Acompanhamos preço de whey, creatina, pré-treino e mais. Hoje são{' '}
              <strong>{formatCount(stats.offers)} ofertas</strong> de{' '}
              <strong>{formatCount(stats.products)} produtos</strong>, com preço por dose e por
              quilo lado a lado.
            </p>

            <CampoBusca className="mb-3" />

            <p className="text-sm text-gray-500 mb-4">
              Ou{' '}
              <Link href="/comparar" className="text-green-700 font-medium underline hover:text-green-800">
                abra o comparador
              </Link>{' '}
              para ver produtos lado a lado, ou{' '}
              <Link href="/ofertas" className="text-green-700 font-medium underline hover:text-green-800">
                veja as ofertas do dia
              </Link>.
            </p>

            <div className="flex flex-wrap gap-2">
              {searchTags.map(tag => (
                <Link
                  key={tag}
                  href={`/categoria/${tag.toLowerCase().replace(/\s+/g, '-').replace('pré', 'pre').replace('hipercalórico', 'hipercalorico')}`}
                  className="px-3 py-1.5 text-xs font-medium border border-green-600 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {/* Right column — 2 top offers stacked */}
          <div className="flex flex-col gap-3 w-full max-w-md mx-auto md:ml-auto md:mr-0">
            {topOffers.length > 0 ? (
              topOffers.map((p, i) => (
                <TopOfferCard key={p.id} product={p} position={i + 1} />
              ))
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">
                Sem ofertas em destaque no momento — volte em breve.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Stats bar */}
      <section className="bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCount(stats.offers)}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">ofertas comparadas</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCount(stats.products)}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">produtos monitorados</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatUpdatedAt(stats.lastUpdated)}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">última coleta de preços</p>
          </div>
        </div>
      </section>

      {/* 5. Em queda agora — REDESIGN: fundo claro, cards brancos, alta legibilidade */}
      <FallingProductsSection products={fallingProducts} />

      {/* 7. Footer */}
      <footer className="bg-gray-900 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div>
            <Link href="/" className="flex items-center mb-3">
              <span className="text-xl font-bold text-green-600">Compara</span>
              <span className="text-xl font-bold text-white">Suple</span>
            </Link>
            <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
              Alguns links são de afiliados. O preço que você paga é o mesmo.
            </p>
          </div>
          {/* Só destinos que existem. Os links institucionais (Sobre, Blog,
              Privacidade, Termos, Contato) apontavam todos para "#": pareciam
              navegação e não levavam a lugar nenhum. Voltam quando as páginas
              existirem. */}
          <nav
            aria-label="Navegação do rodapé"
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center md:justify-end"
          >
            {[
              { rotulo: 'Produtos', href: '/produtos' },
              { rotulo: 'Ofertas', href: '/ofertas' },
              { rotulo: 'Comparador', href: '/comparar' },
            ].map(({ rotulo, href }) => (
              <Link key={href} href={href} className="text-gray-400 hover:text-white transition-colors">
                {rotulo}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}

// ---------- Top Offer Card (hero direita) ----------
// Horizontal compact card: thumbnail à esquerda + info + CTA

function TopOfferCard({
  product,
  position,
}: {
  product: CategoryProduct
  position: number
}) {
  const hasDiscount =
    product.featuredOriginalPrice != null &&
    product.featuredOriginalPrice > product.featuredPrice
  const discountPct = hasDiscount
    ? Math.round((1 - product.featuredPrice / product.featuredOriginalPrice!) * 100)
    : 0

  return (
    <Link
      href={`/produto/${product.slug}`}
      className="group block bg-white border-2 border-gray-100 hover:border-green-600 hover:shadow-lg rounded-2xl p-4 transition-all"
    >
      <div className="flex gap-3 items-start">
        {/* Thumbnail */}
        <div className="relative w-24 h-24 shrink-0 bg-gray-50 rounded-xl flex items-center justify-center p-2">
          {product.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.thumbnail}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-gray-300 text-[10px]">sem img</span>
          )}
          {position === 1 && (
            <span className="absolute -top-1.5 -left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold shadow-sm">
              <Trophy className="w-2.5 h-2.5" />
              TOP
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-600 text-white">
              Oferta {position}
            </span>
            {hasDiscount && (
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">
                -{discountPct}%
              </span>
            )}
          </div>
          {product.brand && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 truncate">
              {product.brand}
            </p>
          )}
          <h3 className="text-sm font-bold text-gray-800 leading-tight line-clamp-2 mb-1.5 group-hover:text-green-700 transition-colors">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl font-bold text-green-600">
              {formatBRL(product.featuredPrice)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">
                {formatBRL(product.featuredOriginalPrice!)}
              </span>
            )}
            {product.featuredPerDose && (
              <span className="text-[11px] font-semibold text-green-700 ml-1">
                · {formatBRL(product.featuredPerDose)}/dose
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Comparado em {product.offerCount}{' '}
            {product.offerCount === 1 ? 'loja' : 'lojas'}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ---------- Em queda agora — NOVO DESIGN ----------
// Fundo claro com pulse de "atualizando agora" verde
// Cards brancos com sombra, alta legibilidade

function FallingProductsSection({ products }: { products: CategoryProduct[] }) {
  return (
    <section className="bg-white py-14 px-4 border-y border-gray-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-orange-50 text-orange-700 mb-3 border border-orange-100">
              <Flame className="w-3.5 h-3.5" />
              <span className="flex items-center gap-1">
                EM QUEDA
                <span className="relative flex h-1.5 w-1.5 ml-1">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                </span>
              </span>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
              <TrendingDown className="w-7 h-7 text-orange-500" />
              Em queda agora
            </h2>
            <p className="text-gray-500 text-sm mt-2">
              Produtos com maior desconto detectado no Mercado Livre.
            </p>
          </div>
          <Link
            href="/ofertas"
            className="self-start sm:self-auto text-sm font-semibold px-4 py-2 rounded-lg border border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-colors"
          >
            Ver todas as ofertas →
          </Link>
        </div>

        {/* Grid */}
        {products.length === 0 ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-10 text-center text-sm text-gray-400">
            Nenhuma promoção rolando agora. Verificamos o ML diariamente — quando rolar desconto, aparece aqui.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => (
              <FallingCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function FallingCard({ product }: { product: CategoryProduct }) {
  const hasDiscount =
    product.featuredOriginalPrice != null &&
    product.featuredOriginalPrice > product.featuredPrice
  const discountPct = hasDiscount
    ? Math.round((1 - product.featuredPrice / product.featuredOriginalPrice!) * 100)
    : 0
  const economyAbs = hasDiscount
    ? product.featuredOriginalPrice! - product.featuredPrice
    : 0

  return (
    <Link
      href={`/produto/${product.slug}`}
      className="group bg-white border border-gray-100 hover:border-orange-400 hover:shadow-md transition-all rounded-2xl overflow-hidden flex flex-col"
    >
      <div className="flex gap-3 p-4 items-start">
        {/* Thumbnail */}
        <div className="relative w-20 h-20 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center p-1.5">
          {product.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.thumbnail}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-gray-300 text-[9px]">sem img</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {product.brand && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 truncate">
              {product.brand}
            </p>
          )}
          <h3 className="text-sm font-bold text-gray-800 leading-tight line-clamp-2 group-hover:text-orange-600 transition-colors">
            {product.name}
          </h3>
          {product.featuredPerDose && (
            <p className="text-[11px] text-gray-500 mt-1">
              {formatBRL(product.featuredPerDose)}/dose
            </p>
          )}
        </div>
      </div>

      {/* Footer com preço + desconto, destacado em laranja */}
      <div className="px-4 py-3 bg-orange-50/60 border-t border-orange-100/60 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-gray-800">
              {formatBRL(product.featuredPrice)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">
                {formatBRL(product.featuredOriginalPrice!)}
              </span>
            )}
          </div>
          {hasDiscount && (
            <p className="text-[11px] font-semibold text-orange-700 mt-0.5">
              Economiza {formatBRL(economyAbs)}
            </p>
          )}
        </div>
        {hasDiscount && (
          <span className="text-sm font-bold px-2.5 py-1 rounded-lg bg-orange-500 text-white shadow-sm">
            -{discountPct}%
          </span>
        )}
      </div>
    </Link>
  )
}
