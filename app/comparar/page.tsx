import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { after } from 'next/server'
import { Plus, X, Check, Trophy } from 'lucide-react'

import { ComoComparamos } from '@/components/ComoComparamos'
import Header from '@/components/Header'
import { filtrarPorTermo, parseTermoBusca } from '@/lib/busca'
import { ehBot, registrarEvento } from '@/lib/eventos'
import { getCatalogStats } from '@/lib/stats'
import {
  MAX_SLOTS,
  buildCompararUrl,
  destacarMelhor,
  parseIdsComparados,
  separarComparaveis,
} from '@/lib/comparador'
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
type Props = {
  searchParams: Promise<{ ids?: string; selected?: string; q?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams
  const ids = parseIdsComparados(sp.ids)

  if (ids.length === 0) {
    return {
      title: 'Comparador lado a lado · Preço Suplemento',
      description:
        'Compare até 3 suplementos lado a lado: preço, R$/dose, R$/kg e ofertas. Escolha o melhor e veja onde comprar.',
    }
  }

  /*
    Cada seleção de produtos é uma URL distinta, e o catálogo gera muito mais
    combinações do que páginas de conteúdo — todas mostrando o mesmo catálogo
    rearranjado. Indexá-las produziria exatamente o que o #16 proíbe:
    combinações ilimitadas e conteúdo duplicado concorrendo consigo. A raiz
    `/comparar` continua indexável, porque é a página de verdade; as seleções
    são estado, não conteúdo.
  */
  return {
    title: `Comparação de ${ids.length} ${ids.length === 1 ? 'suplemento' : 'suplementos'} · Preço Suplemento`,
    robots: { index: false, follow: true },
  }
}

// ---------- main page ----------

export default async function CompararPage({ searchParams }: Props) {
  const sp = await searchParams
  const ids = parseIdsComparados(sp.ids)
  const requestedSelected = parseInt(sp.selected ?? '', 10)
  const encontrados = await getProductsByIds(ids)

  /*
    Produto sem nenhuma oferta comprável não entra na matriz: ocuparia um slot
    para mostrar uma coluna de "não informado" e um botão que leva a uma lista
    de lojas vazia. Mesmo critério que as listagens já aplicam.
  */
  const { comparaveis: products, descartados: semOferta } = separarComparaveis(
    encontrados,
    p => flattenOffers(p).length > 0,
  )
  // A partir daqui, só os ids que sobraram — para que os links não recriem a URL descartada.
  const idsAtivos = products.map(p => p.id)

  // valida 'selected' contra ids reais; default = primeiro produto
  const selectedId = products.find(p => p.id === requestedSelected)?.id ?? products[0]?.id ?? null
  const selectedProduct = products.find(p => p.id === selectedId) ?? null

  const [allProducts, { lastUpdated }] = await Promise.all([
    getAllProductsLite(),
    getCatalogStats(),
  ])
  /*
    Fora os que já estão na comparação, e fora os que a matriz recusaria.
    `lowestPrice` só é null quando nenhuma oferta do produto está disponível —
    `lowestPriceOffer` filtra por disponibilidade antes de escolher.
  */
  const naoComparados = allProducts.filter(
    p => !idsAtivos.includes(p.id) && p.lowestPrice != null,
  )
  const termo = parseTermoBusca(sp.q)
  const available = filtrarPorTermo(naoComparados, termo, p => [p.name, p.brand])

  // Comparação de verdade começa com dois itens: um produto sozinho não compara
  // nada, e contá-lo inflaria a métrica com quem só abriu a página.
  if (products.length >= 2) {
    const ua = (await headers()).get('user-agent')
    const nProdutos = products.length
    after(async () => {
      if (ehBot(ua)) return
      await registrarEvento({
        evento: 'comparacao_montada',
        superficie: 'comparador',
        nProdutos,
      })
    })
  }

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
                {idsAtivos.length}/{MAX_SLOTS} selecionados · ordem reflete o destaque do ML
              </p>
            </div>
          </div>
        </header>

        {/*
          Dizer que um item saiu, e por quê. Sumir em silêncio faria o visitante
          que salvou o link achar que o comparador perdeu a seleção dele.
        */}
        {semOferta > 0 && (
          <p
            role="status"
            className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5"
          >
            {semOferta === 1
              ? '1 produto saiu da comparação por não ter nenhuma oferta disponível agora.'
              : `${semOferta} produtos saíram da comparação por não terem nenhuma oferta disponível agora.`}{' '}
            Ofertas somem quando o anúncio sai do ar no Mercado Livre.
          </p>
        )}

        {products.length === 0 ? (
          <EmptyState />
        ) : (
          <ComparisonGrid
            products={products}
            selectedId={selectedId}
            allIds={idsAtivos}
          />
        )}

        {idsAtivos.length < MAX_SLOTS && (
          <AddProductPicker
            available={available}
            totalDisponivel={naoComparados.length}
            termo={termo}
            currentIds={idsAtivos}
            selectedId={selectedId}
            hasAny={products.length > 0}
          />
        )}

        <ComoComparamos ultimaColeta={lastUpdated} className="mb-4" />

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

  /*
    Destaque por critério, e nunca um "melhor produto" geral: o mais barato por
    quilo raramente é o mais barato por dose. `destacarMelhor` também se recusa
    a coroar quem venceu sozinho — antes, um produto que era o único a informar
    doses ganhava troféu por isso.
  */
  const destPreco = destacarMelhor(rows.map(r => r.lowestPrice))
  const destPorDose = destacarMelhor(rows.map(r => r.perDose))
  const destPorKg = destacarMelhor(rows.map(r => r.perKg))
  const destOfertas = destacarMelhor(rows.map(r => r.offerCount), 'max')

  const cols = rows.length

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4 shadow-sm">
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-gray-800 text-sm">
          Comparação <span className="text-gray-400 font-normal">({cols})</span>
        </h2>
        <p className="text-[11px] text-gray-500">
          Destaque por critério, não um melhor geral · clique{' '}
          <strong>Escolher</strong> pra ver as lojas
        </p>
      </div>

      {/*
        Empilha em telas estreitas. Antes o número de colunas vinha de um
        `style` inline com `repeat(${cols}, ...)`, que não tem media query: em
        320 px três produtos viravam três colunas de ~100 px, com nome e preço
        cortados. As classes abaixo são literais para sobreviverem ao purge.
      */}
      <div
        className={`grid divide-y divide-gray-100 sm:divide-y-0 sm:divide-x ${
          cols === 1
            ? 'grid-cols-1'
            : cols === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {rows.map((r, i) => {
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
                    destPreco.indices.includes(i) ? 'text-green-700' : 'text-green-600'
                  }`}>
                    {r.lowestPrice != null ? formatBRL(r.lowestPrice) : 'não informado'}
                  </span>
                </div>
                {destPreco.indices.includes(i) && (
                  <Selo criterio="menor preço" />
                )}
                {r.perDose != null ? (
                  <p className={`text-[11px] font-semibold ${
                    destPorDose.indices.includes(i) ? 'text-green-700' : 'text-gray-500'
                  }`}>
                    {formatBRL(r.perDose)}/dose
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400">R$/dose não informado</p>
                )}
                {destPorDose.indices.includes(i) && (
                  <Selo criterio="menor R$/dose" />
                )}
              </div>

              {/* Atributos em grid 2col compacto */}
              <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1 border-t border-gray-100">
                <CompactAttr
                  label="Peso"
                  value={r.sizeGrams != null
                    ? r.sizeGrams >= 1000 ? `${r.sizeGrams / 1000} kg` : `${r.sizeGrams}g`
                    : 'não informado'}
                />
                <CompactAttr
                  label="Doses"
                  value={r.servings != null ? `${r.servings}` : 'não informado'}
                />
                <CompactAttr
                  label="R$/kg"
                  value={r.perKg != null ? formatBRL(r.perKg) : 'não informado'}
                  isWinner={destPorKg.indices.includes(i)}
                  criterio="menor R$/kg"
                />
                <CompactAttr
                  label="Lojas"
                  value={`${r.offerCount}`}
                  isWinner={destOfertas.indices.includes(i)}
                  criterio="mais ofertas"
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

/**
 * Selo de destaque de um critério.
 *
 * O troféu sozinho não dizia por que aquele produto estava marcado, e o mesmo
 * ícone aparecia em quatro critérios diferentes. Nomear o critério é o que
 * separa "este é o melhor" — que o comparador não afirma — de "este é o mais
 * barato por dose", que ele consegue sustentar.
 */
function Selo({ criterio }: { criterio: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 mt-0.5">
      <Trophy className="w-2.5 h-2.5" aria-hidden="true" />
      {criterio}
    </span>
  )
}

function CompactAttr({
  label,
  value,
  isWinner = false,
  criterio,
  colSpan = false,
}: {
  label: string
  value: string
  isWinner?: boolean
  criterio?: string
  colSpan?: boolean
}) {
  return (
    <div className={`flex justify-between items-baseline gap-1 ${colSpan ? 'col-span-2' : ''}`}>
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className={`font-medium truncate ${isWinner ? 'text-green-700' : 'text-gray-700'}`}>
        {isWinner && criterio && (
          <span className="sr-only">{criterio}: </span>
        )}
        {isWinner && <Trophy className="w-2.5 h-2.5 text-amber-500 inline mr-0.5" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  )
}

// ---------- Add product picker (compacto) ----------

function AddProductPicker({
  available,
  totalDisponivel,
  termo,
  currentIds,
  selectedId,
  hasAny,
}: {
  available: ProductLite[]
  totalDisponivel: number
  termo: string
  currentIds: number[]
  selectedId: number | null
  hasAny: boolean
}) {
  if (totalDisponivel === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center text-xs text-gray-400 mb-4">
        Todos os produtos do catálogo já estão sendo comparados.
      </div>
    )
  }

  const slotsLeft = MAX_SLOTS - currentIds.length

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4 shadow-sm">
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-green-600" />
          {hasAny ? 'Adicionar' : 'Escolha pra comparar'}
        </h2>
        <p className="text-[11px] text-gray-500">
          {slotsLeft} {slotsLeft === 1 ? 'slot livre' : 'slots livres'} ·{' '}
          {termo ? `${available.length} de ${totalDisponivel}` : `${totalDisponivel} disponíveis`}
        </p>
      </div>

      {/*
        Filtrar pelo próprio comparador, sem sair dele. Os ids e o item ativo
        viajam como campos ocultos para que a busca não descarte a comparação
        em andamento — a URL continua restaurando tudo.
      */}
      <form action="/comparar" method="get" role="search" className="px-3 py-2 border-b border-gray-100 flex gap-2">
        {currentIds.length > 0 && (
          <input type="hidden" name="ids" value={currentIds.join(',')} />
        )}
        {selectedId != null && (
          <input type="hidden" name="selected" value={String(selectedId)} />
        )}
        <label htmlFor="q-comparador" className="sr-only">
          Filtrar produtos para comparar
        </label>
        <input
          id="q-comparador"
          name="q"
          type="search"
          defaultValue={termo}
          maxLength={100}
          placeholder="Filtrar por nome ou marca..."
          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-1 transition-colors"
        >
          Filtrar
        </button>
      </form>

      {available.length === 0 && (
        <div className="px-4 py-4 text-center text-xs text-gray-500">
          Nenhum produto para &ldquo;{termo}&rdquo;.{' '}
          <Link
            href={buildCompararUrl(currentIds, selectedId)}
            className="text-green-700 font-semibold underline"
          >
            Limpar filtro
          </Link>
        </div>
      )}

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
