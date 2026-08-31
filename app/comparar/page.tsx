import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus, X, Check, Trophy } from 'lucide-react'

import Header from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { OffersSection } from '@/components/product/OffersSection'
import {
  getProductsByIds,
  getAllProductsLite,
  flattenOffers,
  featuredOffer,
  lowestPriceOffer,
  formatBRL,
  pricePerDoseNumber,
  type ProductDetail,
  type ProductLite,
} from '@/lib/products'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Comparador lado a lado · ComparaSuple',
  description:
    'Compare até 3 suplementos lado a lado: preço, R$/dose, R$/kg e ofertas. Escolha o melhor e veja onde comprar.',
}

const MAX_SLOTS = 3

type Props = {
  searchParams: Promise<{ ids?: string; selected?: string }>
}

// ---------- helpers de URL ----------

function parseIds(raw: string | undefined): number[] {
  return (raw ?? '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .slice(0, MAX_SLOTS)
}

function buildCompararUrl(ids: number[], selected?: number | null): string {
  const params = new URLSearchParams()
  if (ids.length > 0) params.set('ids', ids.join(','))
  if (selected) params.set('selected', String(selected))
  const qs = params.toString()
  return qs ? `/comparar?${qs}` : '/comparar'
}

// ---------- main page ----------

export default async function CompararPage({ searchParams }: Props) {
  const sp = await searchParams
  const ids = parseIds(sp.ids)
  const requestedSelected = parseInt(sp.selected ?? '', 10)
  const products = await getProductsByIds(ids)

  // valida 'selected' contra ids reais; default = primeiro produto
  const selectedId = products.find(p => p.id === requestedSelected)?.id ?? products[0]?.id ?? null
  const selectedProduct = products.find(p => p.id === selectedId) ?? null

  const allProducts = await getAllProductsLite()
  const available = allProducts.filter(p => !ids.includes(p.id))

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Comparador' }]} />

        {/* Hero — compacto */}
        <header className="mt-4 mb-5 bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl px-4 py-3 md:px-5 md:py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl md:text-3xl shrink-0">⚖</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-gray-800 leading-tight">
                Comparador <span className="text-gray-400 font-normal">·</span>{' '}
                <span className="text-gray-500 font-normal text-sm">até 3 produtos lado a lado</span>
              </h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {ids.length}/{MAX_SLOTS} selecionados · ordem reflete o destaque do ML
              </p>
            </div>
          </div>
        </header>

        {products.length === 0 ? (
          <EmptyState />
        ) : (
          <ComparisonGrid
            products={products}
            selectedId={selectedId}
            allIds={ids}
          />
        )}

        {ids.length < MAX_SLOTS && (
          <AddProductPicker
            available={available}
            currentIds={ids}
            selectedId={selectedId}
            hasAny={products.length > 0}
          />
        )}

        {selectedProduct && (
          <SellersOfSelected product={selectedProduct} />
        )}
      </main>
    </div>
  )
}

// ---------- Empty state ----------

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-6 py-5 text-center mb-4">
      <p className="text-2xl mb-1">⚖</p>
      <p className="text-sm text-gray-600">
        Escolha até 3 suplementos da lista abaixo pra começar a comparar.
      </p>
    </div>
  )
}

// ---------- Comparison grid (server) ----------

function ComparisonGrid({
  products,
  selectedId,
  allIds,
}: {
  products: ProductDetail[]
  selectedId: number | null
  allIds: number[]
}) {
  // Computa atributos por produto + winners
  const rows = products.map(p => {
    const offers = flattenOffers(p)
    const featured = featuredOffer(offers)
    /*
     * O comparador existe para responder "qual entrega mais por menos". Usar o
     * preço destacado pelo ML distorceria a resposta: um produto venceria por
     * ter uma oferta promovida barata, não por ser o melhor negócio. Todas as
     * métricas comparáveis saem do menor preço disponível.
     */
    const lowest = lowestPriceOffer(offers)
    const primary = p.variants[0]
    const sizeGrams = primary?.size_grams ?? null
    const servings = primary?.servings ?? null
    return {
      product: p,
      thumbnail: featured?.raw?.thumbnail ?? null,
      lowestPrice: lowest?.price ?? null,
      perDose: lowest ? pricePerDoseNumber(lowest.price, servings) : null,
      perKg: lowest && sizeGrams ? (lowest.price / sizeGrams) * 1000 : null,
      sizeGrams,
      servings,
      flavor: primary?.flavor ?? null,
      offerCount: offers.length,
      isOfficial: !!featured?.raw?.official_store_id,
    }
  })

  // Winners (menor preço, menor R$/dose, menor R$/kg, mais ofertas)
  const bestPrice = Math.min(...rows.map(r => r.lowestPrice ?? Infinity))
  const lowestPerDose = Math.min(...rows.map(r => r.perDose ?? Infinity))
  const lowestPerKg = Math.min(...rows.map(r => r.perKg ?? Infinity))
  const mostOffers = Math.max(...rows.map(r => r.offerCount))

  const cols = rows.length

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4 shadow-sm">
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-gray-800 text-sm">
          Comparação <span className="text-gray-400 font-normal">({cols})</span>
        </h2>
        <p className="text-[11px] text-gray-500">
          🏆 = vencedor · clique <strong>Escolher</strong> pra ver sellers
        </p>
      </div>

      {/* Grid: mobile 1col, sm 2col, lg = cols (até 3) */}
      <div
        className="grid divide-x divide-gray-100"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {rows.map(r => {
          const isSelected = r.product.id === selectedId
          const remainingIds = allIds.filter(id => id !== r.product.id)
          const newSelectedId = selectedId === r.product.id
            ? (remainingIds[0] ?? null)
            : selectedId

          return (
            <div
              key={r.product.id}
              className={`p-3 flex flex-col gap-2 ${isSelected ? 'bg-green-50/40' : ''}`}
            >
              {/* Image — h-24 (~96px), bem menor que aspect-square */}
              <div className="h-24 bg-gray-50 rounded-lg flex items-center justify-center p-2 relative">
                {r.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.thumbnail}
                    alt={r.product.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-gray-300 text-[10px]">sem img</span>
                )}
                <Link
                  href={buildCompararUrl(remainingIds, newSelectedId)}
                  className="absolute top-1 right-1 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                  title="Remover"
                  aria-label={`Remover ${r.product.name}`}
                >
                  <X className="w-3 h-3" />
                </Link>
                {isSelected && (
                  <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-600 text-white text-[9px] font-bold">
                    <Check className="w-2.5 h-2.5" />
                    Escolhido
                  </span>
                )}
              </div>

              {/* Brand + name — compacto */}
              <div>
                {r.product.brand?.name && (
                  <p className="text-[9px] font-bold uppercase tracking-wide text-green-600 truncate">
                    {r.product.brand.name}
                  </p>
                )}
                <Link href={`/produto/${r.product.slug}`}>
                  <h3 className="text-xs font-bold text-gray-800 leading-tight line-clamp-2 hover:text-green-600 transition-colors">
                    {r.product.name}
                  </h3>
                </Link>
              </div>

              {/* Preço — sempre em destaque */}
              <div>
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className={`text-lg font-bold ${
                    r.lowestPrice === bestPrice && r.lowestPrice != null
                      ? 'text-green-700' : 'text-green-600'
                  }`}>
                    {r.lowestPrice != null ? formatBRL(r.lowestPrice) : '—'}
                  </span>
                  {r.lowestPrice === bestPrice && r.lowestPrice != null && (
                    <Trophy className="w-3 h-3 text-amber-500" />
                  )}
                </div>
                {r.perDose != null && (
                  <p className={`text-[11px] font-semibold ${
                    r.perDose === lowestPerDose ? 'text-green-700' : 'text-gray-500'
                  }`}>
                    {formatBRL(r.perDose)}/dose
                    {r.perDose === lowestPerDose && <span className="ml-1">🏆</span>}
                  </p>
                )}
              </div>

              {/* Atributos em grid 2col compacto */}
              <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1 border-t border-gray-100">
                <CompactAttr
                  label="Peso"
                  value={r.sizeGrams != null
                    ? r.sizeGrams >= 1000 ? `${r.sizeGrams / 1000} kg` : `${r.sizeGrams}g`
                    : '—'}
                />
                <CompactAttr
                  label="Doses"
                  value={r.servings != null ? `${r.servings}` : '—'}
                />
                <CompactAttr
                  label="R$/kg"
                  value={r.perKg != null ? formatBRL(r.perKg) : '—'}
                  isWinner={r.perKg === lowestPerKg && r.perKg != null}
                />
                <CompactAttr
                  label="Lojas"
                  value={`${r.offerCount}`}
                  isWinner={r.offerCount === mostOffers && mostOffers > 1}
                />
                {r.flavor && (
                  <CompactAttr label="Sabor" value={r.flavor} colSpan />
                )}
                {r.isOfficial && (
                  <p className="col-span-2 mt-0.5 text-[9px] font-semibold text-green-700 inline-flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Loja oficial no destaque
                  </p>
                )}
              </dl>

              {/* Ação — um botão só */}
              <div className="mt-auto pt-2">
                {isSelected ? (
                  <span className="block text-center py-2 bg-green-600 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1 w-full">
                    <Check className="w-3.5 h-3.5" /> Escolhido
                  </span>
                ) : (
                  <Link
                    href={buildCompararUrl(allIds, r.product.id)}
                    className="block text-center py-2 border border-green-600 text-green-600 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-colors"
                    scroll={false}
                  >
                    Escolher
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompactAttr({
  label,
  value,
  isWinner = false,
  colSpan = false,
}: {
  label: string
  value: string
  isWinner?: boolean
  colSpan?: boolean
}) {
  return (
    <div className={`flex justify-between items-baseline gap-1 ${colSpan ? 'col-span-2' : ''}`}>
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className={`font-medium truncate ${isWinner ? 'text-green-700' : 'text-gray-700'}`}>
        {isWinner && <Trophy className="w-2.5 h-2.5 text-amber-500 inline mr-0.5" />}
        {value}
      </dd>
    </div>
  )
}

// ---------- Add product picker (compacto) ----------

function AddProductPicker({
  available,
  currentIds,
  selectedId,
  hasAny,
}: {
  available: ProductLite[]
  currentIds: number[]
  selectedId: number | null
  hasAny: boolean
}) {
  if (available.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center text-xs text-gray-400 mb-4">
        Todos os produtos do catálogo já estão sendo comparados.
      </div>
    )
  }

  const slotsLeft = MAX_SLOTS - currentIds.length

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4 shadow-sm">
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-green-600" />
          {hasAny ? 'Adicionar' : 'Escolha pra comparar'}
        </h2>
        <p className="text-[11px] text-gray-500">
          {slotsLeft} {slotsLeft === 1 ? 'slot livre' : 'slots livres'} · {available.length} disponíveis
        </p>
      </div>
      <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {available.map(p => {
          const newIds = [...currentIds, p.id]
          return (
            <li
              key={p.id}
              className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 bg-gray-50 rounded flex items-center justify-center p-0.5 shrink-0">
                {p.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.thumbnail} alt={p.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-gray-300 text-[8px]">—</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {p.brand && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-600 mr-1.5">
                      {p.brand}
                    </span>
                  )}
                  {p.name}
                </p>
              </div>
              {p.lowestPrice != null && (
                <span className="text-[11px] text-gray-500 shrink-0 hidden sm:inline">
                  {formatBRL(p.lowestPrice)}
                </span>
              )}
              <Link
                href={buildCompararUrl(newIds, selectedId)}
                className="shrink-0 w-7 h-7 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors inline-flex items-center justify-center"
                title="Adicionar ao comparador"
                aria-label={`Adicionar ${p.name}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- Sellers do selecionado (server) ----------

function SellersOfSelected({ product }: { product: ProductDetail }) {
  const offers = flattenOffers(product)
  const primary = product.variants[0]
  const servings = primary?.servings ?? null

  return (
    <section className="mt-2">
      <div className="bg-green-900 text-white rounded-t-xl px-4 py-3 flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">🛒</span>
          <h2 className="text-sm md:text-base font-bold truncate">
            Onde comprar: <span className="font-normal text-green-100">{product.name}</span>
          </h2>
        </div>
        <p className="text-green-200 text-[11px] shrink-0">
          {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'} · afiliado rastreado
        </p>
      </div>

      <OffersSection offers={offers} servings={servings} />
    </section>
  )
}
