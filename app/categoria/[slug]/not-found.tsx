import Link from 'next/link'
import { listCategories } from '@/lib/categories'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-sm font-semibold text-green-600 mb-2">404</p>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Categoria não encontrada
        </h1>
        <p className="text-gray-500 mb-8">
          Esse link pode estar quebrado ou a categoria ainda não foi adicionada.
        </p>

        <div className="mb-8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Categorias disponíveis
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {listCategories().map(c => (
              <Link
                key={c.slug}
                href={`/categoria/${c.slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-green-600 hover:text-green-600 transition-colors"
              >
                <span>{c.emoji}</span>
                <span>{c.shortName}</span>
              </Link>
            ))}
          </div>
        </div>

        <Link
          href="/"
          className="text-sm font-semibold text-green-600 hover:underline"
        >
          ← Voltar pra home
        </Link>
      </main>
    </div>
  )
}
