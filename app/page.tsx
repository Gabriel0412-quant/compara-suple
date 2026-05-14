import { Search, Star, ArrowRight } from 'lucide-react'

const fallingProducts = [
  { initial: 'P', category: 'Whey', name: 'Pure Whey 1kg', price: 154, oldPrice: 181, drop: 15 },
  { initial: 'M', category: 'Whey', name: 'Hydro Whey 900g', price: 219, oldPrice: 258, drop: 15 },
  { initial: 'P', category: 'Creatina', name: 'Creatina Mono 300g', price: 89, oldPrice: 105, drop: 14 },
  { initial: 'V', category: 'Pré-treino', name: 'Pré-treino 300g', price: 119, oldPrice: 140, drop: 14 },
  { initial: 'G', category: 'Vegano', name: 'Vegan Protein 900g', price: 169, oldPrice: 199, drop: 14 },
  { initial: 'Z', category: 'BCAA', name: 'BCAA 2:1:1 250g', price: 59, oldPrice: 69, drop: 14 },
]

const smallCategories = [
  { name: 'Creatina', count: 86, slug: 'creatina' },
  { name: 'Pré-treino', count: 127, slug: 'pre-treino' },
  { name: 'BCAA', count: 61, slug: 'bcaa' },
  { name: 'Vitaminas', count: 340, slug: 'vitaminas' },
  { name: 'Vegano', count: 74, slug: 'vegano' },
  { name: 'Hipercalórico', count: 38, slug: 'hipercalorico' },
  { name: 'Termogênicos', count: 52, slug: 'termogenicos' },
]

const navLinks = [
  { label: 'Whey Protein', href: '/categoria/whey-protein' },
  { label: 'Creatina', href: '/categoria/creatina' },
  { label: 'Pré-treino', href: '/categoria/pre-treino' },
  { label: 'BCAA', href: '/categoria/bcaa' },
  { label: 'Vitaminas', href: '/categoria/vitaminas' },
  { label: 'Comparador', href: '/comparar' },
  { label: 'Ofertas', href: '/ofertas' },
]

const searchTags = ['Whey Isolado', 'Creatina', 'Pré-treino', 'Hipercalórico', 'BCAA']

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.5
  const empty = 5 - full - (hasHalf ? 1 : 0)

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
      ))}
      {hasHalf && (
        <span className="relative inline-block w-4 h-4">
          <Star className="absolute inset-0 w-4 h-4 text-amber-200" />
          <span className="absolute inset-0 overflow-hidden" style={{ width: '60%' }}>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </span>
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className="w-4 h-4 text-amber-200" />
      ))}
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* 1. Announcement bar */}
      <div className="bg-green-900 py-2 px-4 text-center text-sm text-white">
        Alertas de preço por WhatsApp já estão no ar.{' '}
        <a href="#alertas" className="font-semibold underline text-green-400">
          Ativar agora →
        </a>
      </div>

      {/* 2. Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/" className="shrink-0 flex items-center">
            <span className="text-xl font-bold text-green-600">Compara</span>
            <span className="text-xl font-bold text-gray-800">Suple</span>
          </a>

          <nav className="hidden lg:flex items-center gap-4 text-sm text-gray-600 flex-1 mx-4">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="hover:text-green-700 whitespace-nowrap transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar suplemento..."
                className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            <button className="text-sm font-medium px-4 py-1.5 rounded-lg border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-colors shrink-0">
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* 3. Hero section */}
      <section className="bg-white py-12 px-4">
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
              Acompanhamos o preço de whey, creatina, pré-treino e mais — em tempo real, em 8 lojas. Compare, receba alertas e nunca mais pague caro.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ex: whey protein, creatina..."
                  className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
              <button className="px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors whitespace-nowrap">
                Comparar agora →
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {searchTags.map(tag => (
                <button
                  key={tag}
                  className="px-3 py-1.5 text-xs font-medium border border-green-600 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Right column — offer card */}
          <div className="flex justify-center md:justify-end">
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-lg w-full max-w-sm">
              <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-green-600 text-white mb-4">
                Oferta da Semana
              </span>
              <h3 className="font-bold text-lg text-gray-800 mb-1">
                Atlas Nutrition — Whey Iso 900g
              </h3>
              <p className="text-sm text-gray-400 mb-3">Baunilha</p>
              <div className="flex items-center gap-2 mb-4">
                <StarRating rating={4.7} />
                <span className="text-sm font-semibold text-gray-700">4.7</span>
              </div>
              <div className="flex items-end gap-2 mb-5">
                <span className="text-3xl font-bold text-green-600">R$169,90</span>
                <span className="text-gray-400 line-through text-sm mb-1">R$189,90</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-600 text-white mb-1">
                  -11%
                </span>
              </div>
              <button className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                Comprar na NutriPrime →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Stats bar */}
      <section className="bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">R$4,2M</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">economizados pelos usuários em 2026</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">1.482</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">produtos monitorados</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">30 min</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">intervalo de atualização</p>
          </div>
        </div>
      </section>

      {/* 5. Em queda agora */}
      <section className="bg-green-900 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-green-800 text-green-400 mb-3">
                ● ATUALIZANDO AGORA
              </span>
              <h2 className="text-3xl font-bold text-white">
                Em queda <span className="text-green-400">agora.</span>
              </h2>
              <p className="text-green-200 text-sm mt-2">Os 6 produtos que mais caíram nas últimas 24h</p>
            </div>
            <button className="self-start sm:self-auto text-sm font-semibold px-4 py-2 rounded-lg border border-green-400 text-green-400 hover:bg-green-800 transition-colors">
              Ver todas as quedas +
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fallingProducts.map((product, i) => (
              <div key={i} className="rounded-xl p-5 flex flex-col gap-3" style={{ backgroundColor: '#0d3320' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {product.initial}
                  </div>
                  <span className="text-xs font-semibold text-green-400">{product.category}</span>
                </div>
                <p className="text-white font-semibold text-sm">{product.name}</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-white">R${product.price}</span>
                  <span className="text-gray-400 line-through text-sm mb-0.5">R${product.oldPrice}</span>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-green-800 text-green-400">
                    -{product.drop}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Categories */}
      <section className="bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-800">O que você procura hoje?</h2>
            <a href="/categorias" className="text-sm font-semibold text-green-600 hover:underline">
              Explorar todas →
            </a>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Large card */}
            <div className="col-span-2 lg:row-span-2 bg-green-600 rounded-2xl p-6 flex flex-col justify-between min-h-52 text-white">
              <div>
                <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-full bg-green-900 text-green-400 mb-3">
                  Mais Comparado
                </span>
                <h3 className="text-2xl font-bold mb-2">Whey Protein</h3>
                <p className="text-green-100 text-sm leading-relaxed mb-3">
                  412 produtos: concentrado, isolado, hidrolisado e vegano. Comparamos teor de proteína por real.
                </p>
                <p className="text-sm font-semibold text-green-100">a partir de R$85,00 / kg</p>
              </div>
              <div className="flex justify-end mt-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow">
                  <ArrowRight className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>

            {/* 7 small cards */}
            {smallCategories.map(cat => (
              <a
                key={cat.slug}
                href={`/categoria/${cat.slug}`}
                className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow group min-h-32"
              >
                <div>
                  <h3 className="font-bold text-sm text-gray-800 mb-1">{cat.name}</h3>
                  <p className="text-xs text-gray-400">{cat.count} produtos</p>
                </div>
                <div className="flex justify-end mt-4">
                  <span className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-lg font-bold group-hover:bg-green-700 transition-colors">
                    +
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Price alert */}
      <section id="alertas" className="bg-green-900 py-16 px-4">
        <div className="max-w-xl mx-auto text-center">
          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-green-800 text-green-400 mb-4">
            ALERTAS INTELIGENTES
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Defina seu preço.</h2>
          <h2 className="text-3xl md:text-4xl font-bold text-green-400 mb-6">A gente avisa.</h2>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto mb-4">
            <input
              type="email"
              placeholder="seu@email.com"
              className="flex-1 px-4 py-3 rounded-xl text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button className="px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors whitespace-nowrap">
              Criar alerta →
            </button>
          </div>
          <p className="text-green-300 text-sm">Grátis sempre · Cancele quando quiser · 38k+ cadastros</p>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="bg-gray-900 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div>
            <a href="/" className="flex items-center mb-3">
              <span className="text-xl font-bold text-green-600">Compara</span>
              <span className="text-xl font-bold text-white">Suple</span>
            </a>
            <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
              Alguns links são de afiliados. O preço que você paga é o mesmo.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center md:justify-end">
            {['Sobre', 'Blog', 'Afiliados', 'Privacidade', 'Termos', 'Contato'].map(link => (
              <a key={link} href="#" className="text-gray-400 hover:text-white transition-colors">
                {link}
              </a>
            ))}
          </nav>
        </div>
      </footer>

    </div>
  )
}
