import { ChevronRight, Star } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Cor = 'green' | 'purple' | 'blue'

interface Produto {
  id: number
  marca: string
  avatar: string
  cor: Cor
  nome: string
  rating: number
  avaliacoes: number
  badge: string
  top: boolean
  score: number
  scoreProteina: number
  scorePreco: number
  scoreSabor: number
  scoreMarca: number
  precoPorDose: number
  precoTotal: number
  doses: number
  proteinaPorDose: number
  pesoPercentual: number
  tipo: string
  tipoDesc: string
  atributos: string[]
  sabores: number
  estoque: string
  estoqueColor: string
  loja: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const produtos: Produto[] = [
  {
    id: 1, marca: 'Atlas Nutrition', avatar: 'AN', cor: 'green',
    nome: 'Whey Iso 900g · Baunilha', rating: 4.7, avaliacoes: 1284,
    badge: 'Melhor custo-benefício', top: true,
    score: 9.2, scoreProteina: 9.4, scorePreco: 9.1, scoreSabor: 8.8, scoreMarca: 9.5,
    precoPorDose: 5.66, precoTotal: 169.90, doses: 30,
    proteinaPorDose: 27, pesoPercentual: 90,
    tipo: 'Isolado', tipoDesc: 'sem lactose, alta pureza',
    atributos: ['Sem açúcar', 'Sem glúten'], sabores: 4,
    estoque: 'Em estoque', estoqueColor: 'green', loja: 'NutriPrime',
  },
  {
    id: 2, marca: 'PrimeFit', avatar: 'P', cor: 'purple',
    nome: 'Pure Whey 1kg · Chocolate', rating: 4.5, avaliacoes: 3140,
    badge: 'Menor preço por dose', top: false,
    score: 8.6, scoreProteina: 8.2, scorePreco: 9.6, scoreSabor: 8.9, scoreMarca: 8.0,
    precoPorDose: 4.67, precoTotal: 154.00, doses: 33,
    proteinaPorDose: 24, pesoPercentual: 80,
    tipo: 'Concentrado', tipoDesc: 'fórmula clássica',
    atributos: ['Lactose 1.8g'], sabores: 6,
    estoque: 'Em estoque', estoqueColor: 'green', loja: 'Loja Atleta',
  },
  {
    id: 3, marca: 'MaxNutri', avatar: 'M', cor: 'blue',
    nome: 'Hydro Whey 900g · Morango', rating: 4.8, avaliacoes: 612,
    badge: 'Maior teor de proteína', top: false,
    score: 8.9, scoreProteina: 9.7, scorePreco: 7.4, scoreSabor: 9.2, scoreMarca: 9.4,
    precoPorDose: 7.30, precoTotal: 219.00, doses: 30,
    proteinaPorDose: 28, pesoPercentual: 93,
    tipo: 'Hidrolisado', tipoDesc: 'absorção mais rápida',
    atributos: ['Sem açúcar', 'Vegano-ready', 'Probiótico'], sabores: 3,
    estoque: 'Últimas 4 unid.', estoqueColor: 'orange', loja: 'SuplementaJá',
  },
]

// ─── Color maps ───────────────────────────────────────────────────────────────

const corMap: Record<Cor, { bg: string; text: string; border: string; badgeBg: string }> = {
  green:  { bg: 'bg-green-600',  text: 'text-green-600',  border: 'border-green-600',  badgeBg: 'bg-green-50 text-green-700' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-600', badgeBg: 'bg-purple-50 text-purple-700' },
  blue:   { bg: 'bg-blue-600',   text: 'text-blue-600',   border: 'border-blue-600',   badgeBg: 'bg-blue-50 text-blue-700' },
}

const estoqueColorMap: Record<string, string> = {
  green: 'text-green-600',
  orange: 'text-orange-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals).replace('.', ',')
}

function StarRow({ rating, size = 'xs' }: { rating: number; size?: 'xs' | 'sm' }) {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.5
  const empty = 5 - full - (hasHalf ? 1 : 0)
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-3 h-3'
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

// Row label cell (left column)
function LabelCell({ label, desc }: { label: string; desc?: string }) {
  return (
    <div className="p-4 flex flex-col justify-center">
      <p className={`font-bold text-gray-800 text-sm ${!desc ? 'text-[10px] tracking-widest uppercase text-gray-400' : ''}`}>
        {label}
      </p>
      {desc && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</p>}
    </div>
  )
}

// Badge component
function Badge({ label, variant = 'green' }: { label: string; variant?: 'green' | 'gray' }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
      variant === 'green' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
    }`}>
      {label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Page-specific header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center">
              <span className="text-xl font-bold text-green-600">Compara</span>
              <span className="text-xl font-bold text-gray-800">Suple</span>
            </a>
            <div className="flex items-center gap-2">
              <button className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                Compartilhar
              </button>
              <button className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors hidden sm:block">
                Salvar comparação
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-xs">
            <a href="/categoria/whey-protein" className="text-green-600 hover:underline">Whey Protein</a>
            <ChevronRight className="w-3 h-3 text-green-600" />
            <span className="text-green-600 font-medium">Comparador</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Comparator heading ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <span className="inline-block mb-2 px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700">
              Comparando 3 produtos · Whey Protein
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">
              Qual whey tem melhor custo-benefício?
            </h1>
            <p className="text-sm text-gray-500 max-w-xl leading-relaxed">
              Score calculado com base em proteína por real, qualidade da fórmula, sabor e confiança da marca.
              Atualizado em 10/05/2026.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Adicionar 4° produto +
            </button>
            <button className="text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Ordenar por: Score ▾
            </button>
          </div>
        </div>

        {/* ── Comparison table ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto mb-6">
          <div className="min-w-[700px]">

            {/* Product header row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b-2 border-gray-100">
              <div className="p-4" />
              {produtos.map(p => {
                const c = corMap[p.cor]
                return (
                  <div key={p.id} className="p-4 flex flex-col items-center text-center gap-2">
                    {/* Image placeholder with TOP badge */}
                    <div className="relative w-full max-w-[120px] aspect-square bg-gray-100 rounded-xl flex items-center justify-center self-center">
                      <span className="text-gray-400 text-[10px] font-medium">produto img</span>
                      {p.top && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">
                          ★ TOP
                        </span>
                      )}
                    </div>
                    {/* Avatar + brand */}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                        {p.avatar}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${c.text}`}>
                        {p.marca}
                      </span>
                    </div>
                    {/* Product name */}
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{p.nome}</p>
                    {/* Stars */}
                    <div className="flex items-center gap-1">
                      <StarRow rating={p.rating} />
                      <span className="text-xs font-semibold text-gray-700">{p.rating}</span>
                      <span className="text-[10px] text-gray-400">({p.avaliacoes.toLocaleString('pt-BR')})</span>
                    </div>
                    {/* Badge */}
                    <Badge label={p.badge} variant={p.top ? 'green' : 'gray'} />
                  </div>
                )
              })}
            </div>

            {/* PRODUTO row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
              <div className="p-4 flex items-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">PRODUTO</p>
              </div>
              {produtos.map(p => (
                <div key={p.id} className="p-4 flex items-center justify-center">
                  <Badge label={p.badge} variant={p.top ? 'green' : 'gray'} />
                </div>
              ))}
            </div>

            {/* Score geral row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100">
              <LabelCell label="Score geral" desc="Combinação ponderada das métricas abaixo" />
              {produtos.map(p => {
                const c = corMap[p.cor]
                return (
                  <div key={p.id} className="p-4 flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-full border-4 ${c.border} flex flex-col items-center justify-center shrink-0`}>
                      <span className={`text-lg font-bold leading-none ${c.text}`}>{p.score}</span>
                      <span className="text-[9px] text-gray-400">/10</span>
                    </div>
                    <div className="text-xs space-y-1 text-gray-600">
                      <p>Proteína <span className="font-bold text-gray-800">{p.scoreProteina}</span></p>
                      <p>Preço <span className="font-bold text-gray-800">{p.scorePreco}</span></p>
                      <p>Sabor <span className="font-bold text-gray-800">{p.scoreSabor}</span></p>
                      <p>Marca <span className="font-bold text-gray-800">{p.scoreMarca}</span></p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Preço por dose row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
              <LabelCell label="Preço por dose" desc="Custo de uma dose individual" />
              {produtos.map(p => {
                const bestDose = Math.min(...produtos.map(x => x.precoPorDose))
                const isBest = p.precoPorDose === bestDose
                return (
                  <div key={p.id} className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold text-gray-800">R$ {fmt(p.precoPorDose)}</span>
                      {isBest && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">MELHOR</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      R${fmt(p.precoTotal)} por pote · {p.doses} doses
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Proteína por dose row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100">
              <LabelCell label="Proteína por dose" desc="Quantos gramas de proteína em uma dose" />
              {produtos.map(p => {
                const bestProtein = Math.max(...produtos.map(x => x.proteinaPorDose))
                const isBest = p.proteinaPorDose === bestProtein
                return (
                  <div key={p.id} className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold text-gray-800">{p.proteinaPorDose} g</span>
                      {isBest && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">MELHOR</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      em 30g de pó · {p.pesoPercentual}% do peso
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Tipo de whey row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
              <LabelCell label="Tipo de whey" />
              {produtos.map(p => (
                <div key={p.id} className="p-4">
                  <p className="text-sm font-bold text-gray-800 mb-0.5">{p.tipo}</p>
                  <p className="text-[11px] text-gray-400">{p.tipoDesc}</p>
                </div>
              ))}
            </div>

            {/* Avaliação row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100">
              <LabelCell label="Avaliação" />
              {produtos.map(p => (
                <div key={p.id} className="p-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <StarRow rating={p.rating} size="sm" />
                    <span className="text-sm font-bold text-gray-800">{p.rating}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{p.avaliacoes.toLocaleString('pt-BR')} avaliações</p>
                </div>
              ))}
            </div>

            {/* Atributos row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
              <LabelCell label="Atributos" />
              {produtos.map(p => (
                <div key={p.id} className="p-4">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {p.atributos.map(a => (
                      <span key={a} className="text-[10px] font-medium px-2 py-0.5 border border-gray-300 rounded-full text-gray-600">
                        ✓ {a}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">{p.sabores} sabores</p>
                </div>
              ))}
            </div>

            {/* Disponibilidade row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100 border-b border-gray-100">
              <LabelCell label="Disponibilidade" />
              {produtos.map(p => (
                <div key={p.id} className="p-4">
                  <p className={`text-sm font-semibold mb-0.5 ${estoqueColorMap[p.estoqueColor] ?? 'text-gray-600'}`}>
                    ● {p.estoque}
                  </p>
                  <p className="text-[11px] text-gray-400">menor preço: {p.loja}</p>
                </div>
              ))}
            </div>

            {/* COMPRAR row */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr] divide-x divide-gray-100">
              <div className="p-4 flex items-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">COMPRAR</p>
              </div>
              {produtos.map((p, i) => (
                <div key={p.id} className={`p-4 ${i === 0 ? 'bg-green-50' : ''}`}>
                  <p className={`text-2xl font-bold mb-0.5 ${i === 0 ? 'text-green-600' : 'text-gray-800'}`}>
                    R$ {fmt(p.precoTotal)}
                  </p>
                  <p className="text-[11px] text-gray-400 mb-3">na {p.loja}</p>
                  <a
                    href={`/go/${p.id}-${p.marca.toLowerCase().replace(' ', '-')}`}
                    className={`block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-colors ${
                      i === 0
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'border border-gray-200 text-gray-700 hover:border-green-600 hover:text-green-600'
                    }`}
                  >
                    Ir para a loja →
                  </a>
                  <p className="text-[10px] text-gray-400 text-center mt-1.5">link de afiliado</p>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Verdict card ─────────────────────────────────────────────────────── */}
        <div className="bg-green-900 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5">
          <span className="text-4xl shrink-0">⚖</span>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">
              VEREDITO DO COMPARASUPLE
            </p>
            <p className="text-white text-sm leading-relaxed">
              Para quem busca <strong>maior pureza com menor custo</strong>, o{' '}
              <strong>Atlas Iso 900g</strong> lidera. Se preço por dose é o único critério,
              o PrimeFit ganha. Para absorção e qualidade premium, MaxNutri Hydro.
            </p>
          </div>
          <a
            href="/go/atlas-whey-iso-900g-baunilha-nutriPrime"
            className="shrink-0 px-6 py-3 bg-white text-green-900 font-bold text-sm rounded-xl hover:bg-green-50 transition-colors whitespace-nowrap"
          >
            Comprar vencedor →
          </a>
        </div>

      </div>
    </div>
  )
}
