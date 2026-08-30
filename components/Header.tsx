import { Search } from 'lucide-react'
import Link from 'next/link'

const navLinks = [
  { label: 'Whey Protein', href: '/categoria/whey-protein' },
  { label: 'Creatina', href: '/categoria/creatina' },
  { label: 'Pré-treino', href: '/categoria/pre-treino' },
  { label: 'BCAA', href: '/categoria/bcaa' },
  { label: 'Vitaminas', href: '/categoria/vitaminas' },
  { label: 'Comparador', href: '/comparar' },
  { label: 'Ofertas', href: '/ofertas' },
]

export default function Header() {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/" className="shrink-0 flex items-center">
          <span className="text-xl font-bold text-green-600">Compara</span>
          <span className="text-xl font-bold text-gray-800">Suple</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-4 text-sm text-gray-600 flex-1 mx-4">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} className="hover:text-green-700 whitespace-nowrap transition-colors">
              {link.label}
            </Link>
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
  )
}
