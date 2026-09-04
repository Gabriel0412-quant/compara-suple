import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-sm font-semibold text-green-600 mb-2">404</p>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Produto não encontrado
        </h1>
        <p className="text-gray-500 mb-8">
          O link pode estar quebrado ou o produto saiu do nosso catálogo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/produtos"
            className="px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Ver todos os produtos
          </Link>
          <Link
            href="/"
            className="px-5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Voltar pra home
          </Link>
        </div>
      </main>
    </div>
  )
}
