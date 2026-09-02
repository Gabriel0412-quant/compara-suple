import type { Metadata } from 'next'
import Link from 'next/link'

import CampoBusca from '@/components/CampoBusca'
import { ComoComparamos } from '@/components/ComoComparamos'
import Header from '@/components/Header'
import { ProductGridCard } from '@/components/category/ProductGridCard'
import { filtrarPorTermo, parseTermoBusca } from '@/lib/busca'
import { getAllProductCards } from '@/lib/categories'
import { getCatalogStats } from '@/lib/stats'

// Server component: consulta o Supabase a cada render, sem cache.
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const termo = parseTermoBusca((await searchParams).q)
  if (!termo) {
    return {
      title: 'Produtos no comparador · ComparaSuple',
      description:
        'Catálogo curado de suplementos com preços do Mercado Livre, custo por dose e custo por quilo.',
    }
  }
  // Resultado de busca não entra no índice: são infinitas combinações do mesmo
  // catálogo, e indexá-las só geraria conteúdo duplicado concorrendo consigo.
  return {
    title: `Busca por "${termo}" · ComparaSuple`,
    robots: { index: false, follow: true },
  }
}

export default async function ProdutosPage({ searchParams }: Props) {
  const termo = parseTermoBusca((await searchParams).q)
  const [catalogo, { lastUpdated }] = await Promise.all([
    getAllProductCards(),
    getCatalogStats(),
  ])

  const resultados = filtrarPorTermo(catalogo, termo, produto => [
    produto.name,
    produto.brand,
  ])

  const buscaSemResultado = termo !== '' && resultados.length === 0
  const catalogoVazio = termo === '' && catalogo.length === 0

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {termo ? `Resultados para "${termo}"` : 'Produtos no comparador'}
          </h1>
          <p className="text-gray-500 mb-5">
            {termo
              ? `${resultados.length} ${resultados.length === 1 ? 'produto encontrado' : 'produtos encontrados'} no catálogo.`
              : 'Catálogo curado, preços atualizados via API do Mercado Livre.'}
          </p>

          <CampoBusca termoInicial={termo} className="max-w-xl" />
        </div>

        <ComoComparamos ultimaColeta={lastUpdated} className="mb-6 max-w-3xl" />

        {catalogoVazio && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
            <strong>Nenhum produto disponível no momento.</strong>{' '}
            O catálogo é atualizado diariamente — tente novamente mais tarde ou{' '}
            <Link href="/" className="underline font-medium">veja as ofertas na home</Link>.
          </div>
        )}

        {buscaSemResultado && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <p className="text-gray-800 font-semibold mb-1">
              Nenhum produto para &ldquo;{termo}&rdquo;.
            </p>
            <p className="text-gray-500 text-sm mb-4">
              Confira a grafia, tente um termo mais curto — &ldquo;whey&rdquo; no
              lugar de &ldquo;whey isolado sabor baunilha&rdquo; — ou navegue por categoria.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/produtos"
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Limpar busca
              </Link>
              <Link
                href="/comparar"
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:border-green-600 hover:text-green-600 transition-colors"
              >
                Abrir comparador
              </Link>
            </div>
          </div>
        )}

        {resultados.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {resultados.map(produto => (
              <ProductGridCard key={produto.id} product={produto} />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-10 text-center">
          Como Afiliado do Mercado Livre, ganhamos por compras qualificadas. O preço pra você é o mesmo.
        </p>
      </main>
    </div>
  )
}
