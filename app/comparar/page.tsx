import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus, X, Check, Trophy, ChevronRight } from 'lucide-react'

import Header from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { OffersSection } from '@/components/product/OffersSection'
import {
  getProductsByIds,
  getAllProductsLite,
  flattenOffers,
  formatBRL,
  pricePerKg,
  pricePerDose,
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

        {/* Hero */}
        <header className="mt-6 mb-8 bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="text-5xl md:text-6xl shrink-0">⚖</span>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                Comparador lado a lado
              </h1>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-2xl">
                Compare até <strong>3 suplementos</strong>. Veja preço, custo por dose, peso e marca.
                Escolha o ideal e veja todas as lojas que vendem.
              </p>
              <p className="text-xs text-gray-500 mt-3">
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
    <div className="bg-white rounded-2xl border border-gray-100 p-10 md:p-14 text-center mb-8">
      <p className="text-5xl mb-4">⚖</p>
      <h2 className="text-xl font-bold text-gray-800 mb-2">
        Adicione produtos pra comparar
      </h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Escolha até 3 suplementos da lista abaixo. Quando escolher,
        compare lado a lado e veja onde cada um é vendido.
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
    const cheapest = offers[0]
    const primary = p.variants[0]
    const sizeGrams = primary?.size_grams ?? null
    const servings = primary?.servings ?? null
    return {
      product: p,
      thumbnail: cheapest?.raw?.thumbnail ?? null,
      cheapestPrice: cheapest?.price ?? null,
      perDose: cheapest ? pricePerDoseNumber(cheapest.price, servings) : null,
      perKg: cheapest && sizeGrams ? (cheapest.price / sizeGrams) * 1000 : null,
      sizeGrams,
      servings,
      flavor: primary?.flavor ?? null,
      offerCount: offers.length,
      isOfficial: !!cheapest?.raw?.official_store_id,
    }
  })

  // Winners (menor preço, menor R$/dose, menor R$/kg, mais ofertas)
  const lowestPrice = Math.min(...rows.map(r => r.cheapestPrice ?? Infinity))
  const lowestPerDose = Math.min(...rows.map(r => r.perDose ?? Infinity))
  const lowestPerKg = Math.min(...rows.map(r => r.perKg ?? Infinity))
  const mostOffers = Math.max(...rows.map(r => r.offerCount))

  const cols = rows.length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-bold text-gray-800">Comparação ({cols} {cols === 1 ? 'produto' : 'produtos'})</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          🏆 marca o vencedor em cada métrica.
          {' '}
          Clique em <strong>Escolher este</strong> pra ver os sellers embaixo.
        </p>
      </div>

      {/* Grid responsivo — mobile: 1 col por produto, stack; desktop: lado a lado */}
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
              className={`p-5 flex flex-col gap-3 ${isSelected ? 'bg-green-50/40' : ''}`}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center p-4 relative">
                {r.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.thumbnail}
                    alt={r.product.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-gray-300 text-xs">sem imagem</span>
                )}
                <Link
                  href={buildCompararUrl(remainingIds, newSelectedId)}
                  className="absolute top-2 right-2 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                  title="Remover do comparador"
                  aria-label={`Remover ${r.product.name}`}
                >
                  <X className="w-4 h-4" />
                </Link>
                {isSelected && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold">
                    <Check className="w-3 h-3" />
                    Escolhido
                  </span>
                )}
              </div>

              {/* Brand + name */}
              <div>
                {r.product.brand?.name && (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">
                    {r.product.brand.name}
                  </p>
                )}
                <Link
                  href={`/produto/${r.product.slug}`}
                  className="block"
                >
                  <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-3 hover:text-green-600 transition-colors">
                    {r.product.name}
                  </h3>
                </Link>
              </div>

              {/* Atributos */}
              <dl className="grid grid-cols-1 gap-1.5 text-xs">
                <AttrRow
                  label="Preço destaque"
                  value={r.cheapestPrice != null ? formatBRL(r.cheapestPrice) : '—'}
                  isWinner={r.cheapestPrice === lowestPrice && r.cheapestPrice != null}
                  emphasize
                />
                <AttrRow
                  label="R$/dose"
                  value={r.perDose != null ? formatBRL(r.perDose) : '—'}
                  isWinner={r.perDose === lowestPerDose && r.perDose != null}
                  emphasize
                />
                <AttrRow
                  label="R$/kg"
                  value={r.perKg != null ? formatBRL(r.perKg) : '—'}
                  isWinner={r.perKg === lowestPerKg && r.perKg != null}
                />
                <AttrRow
                  label="Peso"
                  value={r.sizeGrams != null
                    ? r.sizeGrams >= 1000 ? `${r.sizeGrams / 1000} kg` : `${r.sizeGrams} g`
                    : '—'}
                />
                <AttrRow
                  label="Doses"
                  value={r.servings != null ? `${r.servings} porções` : '—'}
                />
                <AttrRow
                  label="Sabor"
                  value={r.flavor ?? '—'}
                />
                <AttrRow
                  label="Lojas comparando"
                  value={`${r.offerCount} ${r.offerCount === 1 ? 'oferta' : 'ofertas'}`}
                  isWinner={r.offerCount === mostOffers && mostOffers > 1}
                />
                {r.isOfficial && (
                  <p className="mt-1 text-[10px] font-semibold text-green-700 inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> Destaque é loja oficial
                  </p>
                )}
              </dl>

              {/* Ações */}
              <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-gray-100">
                {isSelected ? (
                  <span className="text-center py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> Escolhido
                  </span>
                ) : (
                  <Link
                    href={buildCompararUrl(allIds, r.product.id)}
                    className="text-center py-2.5 border border-green-600 text-green-600 rounded-xl text-sm font-semibold hover:bg-green-600 hover:text-white transition-colors"
                    scroll={false}
                  >
                    Escolher este
                  </Link>
                )}
                <Link
                  href={`/produto/${r.product.slug}`}
                  className="text-center py-2 text-xs text-gray-500 hover:text-green-600 transition-colors inline-flex items-center justify-center gap-1"
                >
                  Ver ficha completa <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AttrRow({
  label,
  value,
  isWinner = false,
  emphasize = false,
}: {
  label: string
  value: string
  isWinner?: boolean
  emphasize?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-1">
      <dt className="text-[11px] text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-right flex items-center gap-1 ${
        emphasize ? 'text-sm font-bold' : 'text-xs font-medium'
      } ${
        isWinner ? 'text-green-700' : 'text-gray-800'
      }`}>
        {isWinner && <Trophy className="w-3 h-3 text-amber-500" />}
        {value}
      </dd>
    </div>
  )
}

// ---------- Add product picker (server) ----------

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
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400 mb-6">
        Todos os produtos do catálogo já estão sendo comparados.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-green-600" />
          {hasAny ? 'Adicionar mais produtos' : 'Escolha produtos pra comparar'}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Clique em + pra adicionar ao comparador ({MAX_SLOTS - currentIds.length} {MAX_SLOTS - currentIds.length === 1 ? 'slot disponível' : 'slots disponíveis'})
        </p>
      </div>
      <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {available.map(p => {
          const newIds = [...currentIds, p.id]
          return (
            <li key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center p-1 shrink-0">
                {p.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.thumbnail} alt={p.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-gray-300 text-[10px]">sem img</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {p.brand && (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">{p.brand}</p>
                )}
                <p className="text-sm font-medium text-gray-800 line-clamp-1">{p.name}</p>
                {p.cheapestPrice && (
                  <p className="text-xs text-gray-500">a partir de {formatBRL(p.cheapestPrice)}</p>
                )}
              </div>
              <Link
                href={buildCompararUrl(newIds, selectedId)}
                className="shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
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
      <div className="bg-green-900 text-white rounded-t-2xl px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🛒</span>
          <h2 className="text-lg md:text-xl font-bold">Onde comprar: {product.name}</h2>
        </div>
        <p className="text-green-200 text-xs md:text-sm">
          {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'} ativas.
          Cada botão Comprar vai pro Mercado Livre com link de afiliado rastreado.
        </p>
      </div>

      <OffersSection offers={offers} servings={servings} />
    </section>
  )
}
