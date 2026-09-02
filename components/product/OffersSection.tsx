'use client'

import { useMemo, useState } from 'react'
import { Truck, ShieldCheck, MapPin, ArrowDownAZ } from 'lucide-react'
import { formatBRL, pricePerDose, type Offer } from '@/lib/products'
import {
  filtrarRows,
  menorPrecoRow,
  offerToRow,
  ordenarRows,
  rotuloFrete,
  type SortBy,
} from '@/lib/offers-table'

export function OffersSection({
  offers,
  servings,
}: {
  offers: Offer[]
  servings: number | null
}) {
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(false)
  const [onlyOfficial, setOnlyOfficial] = useState(false)
  const [onlyFull, setOnlyFull] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('featured')

  const allLojas = useMemo(() => offers.map(offerToRow), [offers])

  const filteredLojas = useMemo(
    () => ordenarRows(
      filtrarRows(allLojas, { onlyFreeShipping, onlyOfficial, onlyFull }),
      sortBy,
    ),
    [allLojas, onlyFreeShipping, onlyOfficial, onlyFull, sortBy],
  )

  const cheapestLoja = menorPrecoRow(filteredLojas)
  const cheapestPreco = cheapestLoja?.preco ?? 0
  const activeFiltersCount = [onlyFreeShipping, onlyOfficial, onlyFull].filter(Boolean).length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Comparar em {filteredLojas.length}
              {activeFiltersCount > 0 && (
                <span className="text-sm font-normal text-gray-400">
                  {' '}de {allLojas.length}
                </span>
              )}
              {' '}
              {filteredLojas.length === 1 ? 'loja' : 'lojas'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Preços atualizados via API · ordenação Destaque prioriza loja oficial
            </p>
          </div>
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center bg-gray-50">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mr-1">
          Filtros
        </span>
        <FilterChip
          active={onlyFreeShipping}
          onToggle={() => setOnlyFreeShipping(v => !v)}
          icon={<Truck className="w-3.5 h-3.5" />}
        >
          Frete grátis
        </FilterChip>
        <FilterChip
          active={onlyOfficial}
          onToggle={() => setOnlyOfficial(v => !v)}
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
        >
          Loja oficial
        </FilterChip>
        <FilterChip
          active={onlyFull}
          onToggle={() => setOnlyFull(v => !v)}
        >
          Full (envio rápido)
        </FilterChip>
        {activeFiltersCount > 0 && (
          <button
            onClick={() => {
              setOnlyFreeShipping(false)
              setOnlyOfficial(false)
              setOnlyFull(false)
            }}
            className="ml-auto text-xs text-gray-500 hover:text-gray-800 underline"
          >
            limpar
          </button>
        )}
      </div>

      {/* Table */}
      {filteredLojas.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400">
          Nenhuma oferta atende a esses filtros.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['LOJA', 'PREÇO', 'R$/DOSE', 'ENTREGA', 'AÇÃO'].map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[10px] font-bold tracking-widest text-gray-400 uppercase"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLojas.map(loja => {
                const isCheapest = loja.offerId === cheapestLoja?.offerId
                const perDose = pricePerDose(loja.preco, servings)
                const diff = isCheapest ? null : loja.preco - cheapestPreco
                return (
                  <tr
                    key={loja.offerId}
                    className={`border-b border-gray-50 last:border-0 ${
                      isCheapest ? 'bg-green-50' : 'hover:bg-gray-50'
                    } transition-colors`}
                  >
                    {/* Loja */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full ${loja.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                        >
                          {loja.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800 truncate">
                              {loja.nome}
                            </span>
                            {isCheapest && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white whitespace-nowrap">
                                MENOR PREÇO
                              </span>
                            )}
                            {loja.isOfficial && !isCheapest && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                OFICIAL
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {loja.freeShipping && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-700">
                                <Truck className="w-2.5 h-2.5" />
                                Frete grátis
                              </span>
                            )}
                            {loja.city && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                                <MapPin className="w-2.5 h-2.5" />
                                {loja.city}{loja.state ? `, ${loja.state}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Preço — do item. O frete depende do CEP e não é calculado aqui. */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatBRL(loja.preco)}
                      </p>
                      {loja.originalPrice && loja.originalPrice > loja.preco && (
                        <p className="text-[10px] text-gray-400 line-through">
                          {formatBRL(loja.originalPrice)}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        {rotuloFrete(loja)}
                      </p>
                      {diff !== null && diff > 0 && (
                        <p className="text-[10px] text-gray-400">
                          +{formatBRL(diff)} vs. menor preço
                        </p>
                      )}
                    </td>

                    {/* R$/Dose */}
                    <td className="px-4 py-3">
                      {perDose ? (
                        <p className="text-sm font-medium text-gray-700">
                          {perDose.replace(' / dose', '')}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">—</p>
                      )}
                    </td>

                    {/* Entrega */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">{loja.entrega}</p>
                    </td>

                    {/* Ação */}
                    <td className="px-4 py-3">
                      <a
                        href={`/go/${loja.offerId}?de=produto&por=${isCheapest ? 'menor_preco' : 'destaque'}`}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                          isCheapest
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'border border-gray-200 text-gray-700 hover:border-green-600 hover:text-green-600'
                        }`}
                      >
                        Comprar →
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3 text-[10px] text-gray-500 border-t border-gray-50 leading-relaxed bg-amber-50/30">
        <p className="font-semibold text-amber-800 mb-1">⚠ Como funciona o redirecionamento</p>
        <p>
          Ao clicar em <strong>Comprar</strong>, você vai pra página do produto no Mercado Livre.
          O ML decide qual seller destacar baseado em <strong>frete, CEP, estoque e reputação</strong> —
          pode mostrar uma oferta diferente da que você clicou (geralmente a loja oficial).
          Os preços acima refletem as ofertas ativas via API; o ML pode atualizar a qualquer momento.
        </p>
        <p className="mt-1.5">
          Os valores são <strong>o preço do item</strong>. O frete depende do seu CEP e não
          está somado aqui — consulte na loja antes de fechar. Onde a oferta tem frete grátis,
          isso vem indicado na linha.
        </p>
        <p className="mt-1.5">
          ComparaSuple recebe comissão de afiliado nas vendas, sem custo extra para você.
        </p>
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onToggle,
  icon,
  children,
}: {
  active: boolean
  onToggle: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors border ${
        active
          ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
          : 'bg-white text-gray-700 border-gray-200 hover:border-green-600 hover:text-green-600'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function SortDropdown({
  value,
  onChange,
}: {
  value: SortBy
  onChange: (v: SortBy) => void
}) {
  const labels: Record<SortBy, string> = {
    featured: 'Destaque (loja oficial primeiro)',
    preco: 'Menor preço',
    discount: 'Maior desconto',
  }
  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <ArrowDownAZ className="w-3.5 h-3.5 text-gray-400" />
      <select
        value={value}
        onChange={e => onChange(e.target.value as SortBy)}
        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
      >
        {(Object.keys(labels) as SortBy[]).map(k => (
          <option key={k} value={k}>{labels[k]}</option>
        ))}
      </select>
    </div>
  )
}
