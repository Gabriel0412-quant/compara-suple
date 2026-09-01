import { Star, Heart, Bell, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import Header from '@/components/Header'
import { OffersSection } from '@/components/product/OffersSection'
import {
  getProductBySlug,
  flattenOffers,
  featuredOffer,
  lowestPriceOffer,
  formatBRL,
  pricePerKg,
  pricePerDose,
} from '@/lib/products'

export const dynamic = 'force-dynamic'

/** Produto sem nenhuma oferta ativa: identidade preservada, comércio ausente. */
function SemOfertasAtivas({ product }: { product: { name: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />
      <nav className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1 text-xs text-gray-500 flex-wrap">
        <Link href="/" className="hover:text-green-600 transition-colors">Suplementos</Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <Link href="/produtos" className="hover:text-green-600 transition-colors">Produtos</Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <span className="text-gray-800 font-medium truncate max-w-md">{product.name}</span>
      </nav>
      <main className="max-w-7xl mx-auto px-4 pb-16">
        <h1 className="text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-800 mb-1">
            Sem ofertas disponíveis no momento
          </p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Nenhum vendedor deste produto estava ativo na última coleta. Não
            exibimos o último preço conhecido porque ele não representa mais o
            que você pagaria hoje.
          </p>
          <Link
            href="/produtos"
            className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Ver produtos com oferta ativa
          </Link>
        </div>
      </main>
    </div>
  )
}

type Props = { params: Promise<{ slug: string }> }

// ─── Mock fallbacks (sections sem dado real ainda) ─────────────────────────────
// TODO: derivar de attributes ML quando disponível
const NUTRICAO_PLACEHOLDER: Array<{ label: string; valor: string }> = [
  { label: 'Valor energético', valor: '—' },
  { label: 'Proteínas',        valor: '—' },
  { label: 'Carboidratos',     valor: '—' },
  { label: 'Açúcares',         valor: '—' },
  { label: 'Gorduras totais',  valor: '—' },
  { label: 'Sódio',            valor: '—' },
]

// SVG chart — mock até termos 90 dias reais em price_history
// TODO: substituir por dados reais quando price_history tiver histórico
const CHART_W = 600
const CHART_H = 150
const PRICE_MIN = 100
const PRICE_MAX = 250
const DAY_MAX = 90

function toSvg(day: number, price: number): [number, number] {
  const x = (day / DAY_MAX) * CHART_W
  const y = CHART_H - ((price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * (CHART_H - 16) - 8
  return [Math.round(x), Math.round(y)]
}

// ─── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Produto não encontrado · ComparaSuple' }

  const offers = flattenOffers(product)
  // "a partir de" é uma promessa de que não há nada mais barato. Só o menor
  // preço pode sustentá-la — o destaque do ML costuma ser mais caro.
  const lowest = lowestPriceOffer(offers)
  const priceTxt = lowest ? ` a partir de ${formatBRL(lowest.price)}` : ''

  return {
    title: `${product.name} — Comparar preços${priceTxt} · ComparaSuple`,
    description: `Compare ${offers.length} ofertas de ${product.name}${
      product.brand ? ` (${product.brand.name})` : ''
    } no Mercado Livre${priceTxt}.`,
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.5
  const empty = 5 - full - (hasHalf ? 1 : 0)
  const cls = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5'

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={i} className={`${cls} fill-amber-400 text-amber-400`} />
      ))}
      {hasHalf && (
        <span className={`relative inline-block ${cls}`}>
          <Star className={`absolute inset-0 ${cls} text-amber-200`} />
          <span className="absolute inset-0 overflow-hidden" style={{ width: '60%' }}>
            <Star className={`${cls} fill-amber-400 text-amber-400`} />
          </span>
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className={`${cls} text-amber-200`} />
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const offers = flattenOffers(product)
  // Produto existe, mas nenhuma oferta está ativa. `notFound()` seria mentira —
  // a página existe e deve continuar indexável. O EP02-05 pede estado explícito:
  // sem preço, sem economia e sem botão de compra apontando para anúncio morto.
  if (offers.length === 0) return <SemOfertasAtivas product={product} />

  const featured        = featuredOffer(offers) ?? offers[0]
  const lowest          = lowestPriceOffer(offers)
  // Só contradiz o destaque quando existe algo realmente mais barato.
  const temMaisBarata   = !!lowest && lowest.id !== featured.id && lowest.price < featured.price
  const primaryVariant  = product.variants[0]
  const sizeGrams       = primaryVariant?.size_grams ?? null
  const servings        = primaryVariant?.servings ?? null
  const thumbnail       = featured.raw?.thumbnail ?? null
  const originalPrice   = featured.raw?.original_price ?? null
  const hasDiscount     = !!originalPrice && originalPrice > featured.price
  const descontoPct     = hasDiscount
    ? Math.round((1 - featured.price / originalPrice) * 100)
    : 0
  const perKgStr        = pricePerKg(featured.price, sizeGrams) ?? '—'
  const perDoseStr      = pricePerDose(featured.price, servings)
  const pesoTxt         = sizeGrams
    ? sizeGrams >= 1000 ? `${sizeGrams / 1000} kg` : `${sizeGrams} g`
    : '—'
  const featuredFreeShipping = !!featured.raw?.shipping?.free_shipping
  const featuredSellerLabel  = featured.raw?.official_store_id
    ? 'Loja Oficial'
    : (featured.raw?.seller_address?.city?.name
        ? `Vendedor em ${featured.raw.seller_address.city.name}`
        : 'Mercado Livre')

  // Chart mock — TODO: trocar quando tivermos histórico real (>30 dias)
  const chartPoints: Array<[number, number]> = [
    [0,  featured.price * 1.10],
    [30, featured.price * 1.05],
    [60, featured.price * 1.02],
    [90, featured.price],
  ]
  const linePts = chartPoints.map(([d, p]) => toSvg(d, p).join(',')).join(' ')
  const areaPts = [
    ...chartPoints.map(([d, p]) => toSvg(d, p).join(',')),
    `${CHART_W},${CHART_H}`, `0,${CHART_H}`,
  ].join(' ')

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      {/* Breadcrumb */}
      <nav className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1 text-xs text-gray-500 flex-wrap">
        <Link href="/" className="hover:text-green-600 transition-colors">Suplementos</Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <Link href="/produtos" className="hover:text-green-600 transition-colors">Produtos</Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <span className="text-gray-800 font-medium truncate max-w-md">{product.name}</span>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pb-12">

        {/* ── Main product section ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8 mb-10">

          {/* Left — image + thumbnails */}
          <div>
            <div className="flex gap-2 mb-3 flex-wrap">
              {hasDiscount && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700">
                  -{descontoPct}% no melhor preço
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700">
                ● {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'} comparadas
              </span>
            </div>

            <div className="bg-gray-100 rounded-2xl aspect-square flex items-center justify-center mb-3 border border-gray-200 overflow-hidden">
              {thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={thumbnail}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain p-8"
                />
              ) : (
                <span className="text-gray-400 text-sm font-medium select-none">
                  sem imagem disponível
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="bg-gray-100 rounded-xl aspect-square flex items-center justify-center border-2 border-transparent"
                >
                  <span className="text-gray-300 text-[10px] font-medium select-none">—</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — product details */}
          <div className="flex flex-col gap-4">
            <div>
              {product.brand?.name && (
                <p className="text-xs font-bold tracking-widest text-green-600 uppercase mb-1">
                  {product.brand.name}
                </p>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
                {product.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StarRating rating={4.5} size="md" />
              <span className="text-gray-400 text-xs italic">
                Avaliações em breve
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Destaque entre {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'}
              </span>
              <span className="text-xs font-semibold text-gray-700 truncate max-w-[60%]">
                {featuredSellerLabel}
              </span>
            </div>

            <div>
              {hasDiscount && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-400 line-through text-base">
                    {formatBRL(originalPrice!)}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-600 text-white">
                    -{descontoPct}%
                  </span>
                </div>
              )}
              <p className="text-4xl font-bold text-green-600">
                {formatBRL(featured.price)}
              </p>
              {temMaisBarata && (
                <a
                  href={`/go/${lowest!.id}`}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-block text-sm font-semibold text-green-700 mt-1 hover:underline"
                >
                  Menor preço: {formatBRL(lowest!.price)} →
                </a>
              )}
              <p className="text-sm text-gray-400 mt-1">
                {featuredFreeShipping ? 'frete grátis nesta oferta' : 'consulte frete na loja'}
                {perDoseStr && (
                  <>
                    {' · '}
                    <span className="text-gray-600 font-semibold">{perDoseStr}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href={`/go/${featured.id}`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex-1 py-3.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors text-center"
              >
                Comprar agora →
              </a>
              <button className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-300 hover:text-red-400 transition-colors">
                <Heart className="w-5 h-5" />
              </button>
              <button className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-green-600 hover:text-green-600 transition-colors">
                <Bell className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>✓ Compra segura no ML</span>
              <span>✓ Link de afiliado</span>
              <span>✓ Atualizado diariamente</span>
            </div>

            {/* Metrics grid — agora com R$/DOSE quando temos servings */}
            <div className="flex border border-gray-100 rounded-xl overflow-hidden">
              {[
                { label: 'MARCA',   value: product.brand?.name ?? '—' },
                { label: 'PESO',    value: pesoTxt },
                { label: 'DOSES',   value: servings ? `${servings} porções` : '—' },
                { label: 'R$/DOSE', value: perDoseStr ? perDoseStr.replace(' / dose', '') : '—', emphasize: true },
                { label: 'R$/KG',   value: perKgStr },
              ].map((m, i) => (
                <div
                  key={m.label}
                  className={`flex-1 p-3 text-center ${i > 0 ? 'border-l border-gray-100' : ''}`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 leading-tight mb-1">
                    {m.label}
                  </p>
                  <p
                    className={`text-sm font-bold leading-tight truncate ${
                      m.emphasize ? 'text-green-600' : 'text-gray-800'
                    }`}
                  >
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Offers table (client component com filtros) ──────────────────── */}
        <div className="mb-10">
          <OffersSection offers={offers} servings={servings} />
        </div>

        {/* ── Lower section ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Price history — mock até termos 90 dias reais */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-0.5">Histórico de preço</h2>
            <p className="text-xs text-gray-400 mb-4">
              Em breve — coletando histórico real (precisa de 30+ dias de dados)
            </p>

            <div className="flex gap-1 mb-5 opacity-50">
              {['30d', '90d', '6m', '1a', 'Tudo'].map(tab => (
                <button
                  key={tab}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    tab === '90d' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  disabled
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Atual',         value: formatBRL(featured.price), color: 'text-green-600' },
                { label: 'Mínimo 90d',    value: '—',                       color: 'text-gray-400' },
                { label: 'Máximo 90d',    value: '—',                       color: 'text-gray-400' },
                { label: 'Variação 30d',  value: '—',                       color: 'text-gray-400' },
              ].map(m => (
                <div key={m.label}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}</p>
                  <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100 mb-4 opacity-60">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full"
                style={{ height: 140 }}
                preserveAspectRatio="none"
              >
                <polygon points={areaPts} fill="#16a34a" fillOpacity="0.08" />
                <polyline
                  points={linePts}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                />
                <circle cx={CHART_W} cy={toSvg(90, featured.price)[1]} r="5" fill="#16a34a" />
              </svg>
            </div>

            <button
              disabled
              className="w-full py-2.5 border-2 border-gray-200 text-gray-400 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Bell className="w-4 h-4" />
              Avisar quando baixar (em breve)
            </button>
          </div>

          {/* Nutritional info — placeholder */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-0.5">Informação nutricional</h2>
            <p className="text-xs text-gray-400 mb-4">
              Em breve — extração automática da ficha do ML
            </p>

            <table className="w-full">
              <tbody>
                {NUTRICAO_PLACEHOLDER.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2.5 text-sm text-gray-600 rounded-l-lg">{row.label}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-gray-400 text-right rounded-r-lg">{row.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── CTA card ─────────────────────────────────────────────────────────── */}
      <section className="bg-green-900 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-5">
          <span className="text-4xl">⚖</span>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-white mb-1">Compare com outros produtos</h3>
            <p className="text-green-200 text-sm leading-relaxed">
              Adicione até 3 suplementos lado-a-lado para comparar preço, marca e gramatura.
            </p>
          </div>
          <a
            href="/comparar"
            className="shrink-0 px-6 py-3 bg-white text-green-900 font-bold text-sm rounded-xl hover:bg-green-50 transition-colors whitespace-nowrap"
          >
            Abrir comparador →
          </a>
        </div>
      </section>
    </div>
  )
}
