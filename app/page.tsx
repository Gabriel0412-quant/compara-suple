import Link from 'next/link'
import { Flame, TrendingDown } from 'lucide-react'

import CampoBusca from '@/components/CampoBusca'
import FaixaDeMarcas from '@/components/home/FaixaDeMarcas'
import { listarMarcas } from '@/lib/brands'
import {
  getProductsOnSale,
  listCategoriesWithProducts,
  type CategoryProduct,
} from '@/lib/categories'
import { formatBRL } from '@/lib/products'
import { getCatalogStats, formatCount, formatUltimaColeta } from '@/lib/stats'

export const dynamic = 'force-dynamic'

// ---------- Home ----------

export default async function Home() {
  // Busca os produtos em oferta (já vem ordenado por desconto absoluto)
  const [onSale, stats, categorias, marcas] = await Promise.all([
    getProductsOnSale(),
    getCatalogStats(),
    listCategoriesWithProducts(),
    listarMarcas(),
  ])
  /*
    A faixa mostra as cinco primeiras, mas o texto do recorte precisa do total
    para não afirmar um corte que não houve — dizer "as 5 com mais ofertas"
    com três marcas no catálogo seria inventar uma seleção.
  */
  const marcasEmDestaque = marcas.slice(0, 5)
  /*
    `TopOfferCard` e o `topOffers` saíram junto com a coluna direita do hero.

    Não era perda de informação: `topOffers` era `onSale.slice(0, 2)` e
    `fallingProducts` é `onSale.slice(0, 6)` — os dois primeiros produtos
    apareciam duas vezes na mesma página, no hero e na faixa logo abaixo. O
    card do hero da maquete 1b é outro (maior queda do dia), e nasce no #128
    com o dado que o sustente.
  */
  const fallingProducts = onSale.slice(0, 6)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/*
        A home era a única das nove páginas sem landmark `main` — as outras
        oito já tinham. Passou despercebido enquanto o `<Header />` era
        importado por cada página; com header e rodapé no layout, a falta
        fica evidente, e quem navega por landmarks não tinha como pular a
        navegação para chegar ao conteúdo.
      */}
      <main>

      {/*
        Hero da maquete 1b: a busca é o centro da página, não um acessório do
        header. O desenho tem uma segunda coluna à direita — o card de maior
        queda do dia — que não entra aqui: ela afirma variação de preço no
        tempo, e o histórico ainda não sustenta isso (#128). Por isso o hero
        precisa ficar bem numa coluna só, e não com um buraco no grid.
      */}
      <section className="bg-surface px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-ink sm:text-5xl md:text-[52px]">
            Quanto custa a sua dose hoje?
          </h1>

          {/*
            Os três números saem de `lib/stats.ts`, que existe justamente porque
            esta home já exibiu "1.482 produtos monitorados" e "R$4,2M
            economizados" — nenhum dos dois com origem no banco.
          */}
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-2 md:text-lg">
            Acompanhamos <strong className="font-semibold text-ink">{formatCount(stats.offers)} ofertas</strong>{' '}
            de <strong className="font-semibold text-ink">{formatCount(stats.products)} produtos</strong> e
            mostramos o preço por dose e por quilo lado a lado. Última coleta{' '}
            {formatUltimaColeta(stats.lastUpdated)}.
          </p>

          <CampoBusca tamanho="hero" className="mt-7 max-w-2xl" />

          {categorias.length > 0 && (
            <nav aria-label="Categorias em destaque" className="mt-5 flex flex-wrap gap-2">
              {categorias.slice(0, 6).map(categoria => (
                <Link
                  key={categoria.slug}
                  href={`/categoria/${categoria.slug}`}
                  className="rounded-full border-[1.5px] border-line-strong px-4 py-2 text-sm text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {categoria.name}
                </Link>
              ))}
            </nav>
          )}

          <p className="mt-5 text-sm text-ink-3">
            Ou{' '}
            <Link href="/comparar" className="font-medium text-brand-strong underline hover:text-brand-deep">
              abra o comparador
            </Link>{' '}
            para ver produtos lado a lado, ou{' '}
            <Link href="/ofertas" className="font-medium text-brand-strong underline hover:text-brand-deep">
              veja as ofertas do dia
            </Link>.
          </p>
        </div>
      </section>

      <FaixaDeMarcas marcas={marcasEmDestaque} total={marcas.length} />

      {/*
        A faixa de números saiu daqui.

        Ela repetia ofertas, produtos e última coleta logo abaixo do parágrafo
        do hero, que agora carrega os três. A maquete 1b não tem essa faixa
        justamente por isso: o mesmo dado dito duas vezes na mesma dobra não
        informa mais, só ocupa altura antes do conteúdo.
      */}
      {/* 5. Em queda agora — REDESIGN: fundo claro, cards brancos, alta legibilidade */}
      <FallingProductsSection products={fallingProducts} />

      {/* 7. Footer */}
      </main>
    </div>
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
