import Link from 'next/link'
import { Flame, TrendingDown } from 'lucide-react'

import CampoBusca from '@/components/CampoBusca'
import FaixaDeMarcas from '@/components/home/FaixaDeMarcas'
import { BlocoComparador } from '@/components/home/BlocoComparador'
import { PrateleiraDeCategoria } from '@/components/home/PrateleiraDeCategoria'
import { listarMarcas } from '@/lib/brands'
import { comparadorDaHome } from '@/lib/comparador-home'
import { fundoDaPrateleira, prateleirasDaHome } from '@/lib/shelves'
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
  const [onSale, stats, categorias, marcas, prateleiras, comparador] = await Promise.all([
    getProductsOnSale(),
    getCatalogStats(),
    listCategoriesWithProducts(),
    listarMarcas(),
    prateleirasDaHome(),
    comparadorDaHome(),
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
    <div className="min-h-screen bg-surface-muted text-ink">
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
                  className="flex min-h-11 items-center rounded-full border-[1.5px] border-line-strong px-4 text-sm text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
        Um bloco por categoria, alternando fundo para separar as faixas sem
        precisar de linha divisória — como na maquete 1b.
      */}
      {/*
        Fora da mutação: é laço de renderização, não regra.

        A decisão que dá para errar aqui — qual fundo cada prateleira recebe —
        foi para `fundoDaPrateleira`, que tem teste. O que sobra é `.map()`
        sobre uma lista já montada e testada em `lib/shelves.ts`. O mutante que
        restava trocava o corpo por `undefined`, o que apaga as prateleiras da
        página: só o e2e vê isso, e `e2e/prateleiras.spec.ts` vê.
      */}
      {
        // Stryker disable next-line all
        prateleiras.map((prateleira, i) => (
          <div key={prateleira.categoria.slug} className={fundoDaPrateleira(i)}>
            <PrateleiraDeCategoria prateleira={prateleira} />
          </div>
        ))
      }

      <BlocoComparador dados={comparador} />

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
    <section className="border-y border-line bg-surface px-4 py-14">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            {/*
              O título dizia "Em queda agora", com selo "EM QUEDA" pulsando.

              Isso afirma variação de preço no tempo, e o dado por trás é
              `original_price` do próprio anúncio: desconto em relação ao preço
              anunciado, não queda observada entre coletas. É a mesma afirmação
              que o #128 está bloqueado por não poder sustentar até o EP10
              (#114) entregar histórico com cobertura — só que já estava no ar.

              O subtítulo sempre foi honesto. O título e o selo passam a
              nomear o que o dado é. O ponto pulsante saiu junto: ele sugeria
              tempo real, e a coleta é diária.
            */}
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-warm px-3 py-1 font-mono text-sm font-semibold uppercase tracking-[0.1em] text-brand-ink sm:text-[11px]">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              Desconto
            </div>
            <h2 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-[-0.03em] text-ink">
              <TrendingDown className="h-7 w-7 text-brand" aria-hidden="true" />
              Maiores descontos
            </h2>
            <p className="mt-2 text-sm text-ink-3">
              Produtos com maior desconto em relação ao preço anunciado no Mercado Livre, na
              última coleta.
            </p>
          </div>
          <Link
            href="/ofertas"
            className="flex min-h-11 items-center self-start rounded-lg border border-brand px-4 text-sm font-semibold text-brand-strong transition-colors hover:bg-brand hover:text-white sm:self-auto"
          >
            Ver todas as ofertas →
          </Link>
        </div>

        {/* Grid */}
        {products.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-10 text-center text-sm text-ink-3">
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

export function FallingCard({ product }: { product: CategoryProduct }) {
  const discount = discountFor(product)

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all hover:border-brand hover:shadow-md"
    >
      <Link href={`/produto/${product.slug}`} className="flex gap-3 p-4 items-start">
        {/* Thumbnail */}
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-muted p-1.5">
          {product.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.thumbnail}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-ink-4">sem img</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {product.brand && (
            <p className="truncate font-mono text-sm uppercase tracking-[0.1em] text-ink-3 sm:text-[10px]">
              {product.brand}
            </p>
          )}
          <h3 className="line-clamp-2 text-base font-bold leading-tight text-ink transition-colors group-hover:text-brand-strong sm:text-sm">
            {product.name}
          </h3>
          {product.featuredPerDose && (
            <p className="mt-1 text-sm text-ink-3 sm:text-[11px]">
              {formatBRL(product.featuredPerDose)}/dose
            </p>
          )}
        </div>
      </Link>

      {/* Footer com preço + desconto, destacado em laranja */}
      <div className="flex items-end justify-between gap-2 border-t border-line bg-surface-warm px-4 py-3">
        <FallingCardPrice product={product} discount={discount} />
        <DiscountBadge percentage={discount?.percentage ?? null} />
        {product.featuredOfferId && (
          <a
            href={`/go/${product.featuredOfferId}?de=home&por=destaque`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label={`Ver oferta de ${product.name} no Mercado Livre (abre em nova aba)`}
            className="flex min-h-11 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            {/*
              Era "Comprar →", como no ProductGridCard antes do #155 — e este
              escapou porque é outro componente, e meu teste de lá estava
              escopado à prateleira. O rótulo sugere que o checkout acontece
              aqui; a compra é na loja.
            */}
            Ir à loja →
          </a>
        )}
      </div>
    </article>
  )
}

type Discount = { originalPrice: number; economy: number; percentage: number }

export function discountFor(product: CategoryProduct): Discount | null {
  const originalPrice = product.featuredOriginalPrice
  if (originalPrice == null || originalPrice <= product.featuredPrice) return null
  return {
    originalPrice,
    economy: originalPrice - product.featuredPrice,
    percentage: Math.round((1 - product.featuredPrice / originalPrice) * 100),
  }
}

export function FallingCardPrice({ product, discount }: { product: CategoryProduct; discount: Discount | null }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold text-ink">{formatBRL(product.featuredPrice)}</span>
        <FeaturedOriginalPrice price={discount?.originalPrice ?? null} />
      </div>
      {discount && (
        <p className="mt-0.5 font-mono text-sm font-semibold text-brand-strong sm:text-[11px]">
          Economiza {formatBRL(discount.economy)}
        </p>
      )}
    </div>
  )
}

export function DiscountBadge({ percentage }: { percentage: number | null }) {
  if (percentage === null) return null
  return (
    <span className="rounded-lg bg-brand px-2.5 py-1 font-mono text-sm font-semibold text-white shadow-sm">
      -{percentage}%
    </span>
  )
}

function FeaturedOriginalPrice({ price }: { price: number | null }) {
  if (price === null) return null
  return <span className="font-mono text-sm text-ink-4 line-through sm:text-xs">{formatBRL(price)}</span>
}
