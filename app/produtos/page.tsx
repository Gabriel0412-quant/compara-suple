import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { after } from 'next/server'

import { Breadcrumb } from '@/components/Breadcrumb'
import CampoBusca from '@/components/CampoBusca'
import { ComoComparamos } from '@/components/ComoComparamos'
import { TelaDeBusca, contarOfertas, contarResultados } from '@/components/busca/TelaDeBusca'
import { ehBot, registrarEvento } from '@/lib/eventos'
import { getAllProductCards } from '@/lib/categories'
import { parseFiltros, semFiltro } from '@/lib/filtros'
import { formatCount, formatUltimaColeta, getCatalogStats } from '@/lib/stats'

// Server component: consulta o Supabase a cada render, sem cache.
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filtros = parseFiltros(await searchParams)
  if (semFiltro(filtros)) {
    return {
      title: 'Produtos no comparador · Preço Suplemento',
      description:
        'Catálogo curado de suplementos com preços do Mercado Livre, custo por dose e custo por quilo.',
    }
  }
  /*
    Resultado filtrado não entra no índice: são infinitas combinações do mesmo
    catálogo, e indexá-las geraria conteúdo duplicado concorrendo consigo.

    É também o motivo de `/categoria/[slug]` continuar existindo: aquela rota é
    a versão indexável desta tela, com um recorte só e texto próprio.
  */
  return {
    title: filtros.termo
      ? `Busca por "${filtros.termo}" · Preço Suplemento`
      : 'Produtos filtrados · Preço Suplemento',
    robots: { index: false, follow: true },
  }
}

export default async function ProdutosPage({ searchParams }: Props) {
  const filtros = parseFiltros(await searchParams)
  const [catalogo, { lastUpdated }] = await Promise.all([
    getAllProductCards(),
    getCatalogStats(),
  ])

  const nResultados = contarResultados(catalogo, filtros)
  const ofertas = contarOfertas(catalogo, filtros)

  /*
    Registrado depois da resposta: `after()` roda quando a página já foi
    enviada, então medir não atrasa quem está lendo. Sem identificador, uma
    recarga conta como busca nova — a leitura é agregada, e é assim que a #17
    a define.
  */
  if (filtros.termo !== '') {
    const ua = (await headers()).get('user-agent')
    after(async () => {
      if (ehBot(ua)) return
      await registrarEvento({
        evento: 'busca_enviada',
        superficie: 'lista',
        nResultados,
        termo: filtros.termo,
      })
    })
  }

  const catalogoVazio = catalogo.length === 0

  return (
    <div className="min-h-screen bg-surface-muted text-ink">
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: filtros.termo ? `Busca: ${filtros.termo}` : 'Produtos' },
          ]}
        />

        <div className="mt-6 mb-6">
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink md:text-4xl">
            {filtros.termo
              ? `${formatCount(nResultados)} ${nResultados === 1 ? 'resultado' : 'resultados'} para “${filtros.termo}”`
              : 'Produtos no comparador'}
          </h1>
          {nResultados > 0 && (
            <p className="mt-3 max-w-3xl text-ink-2">
              {formatCount(ofertas)} {ofertas === 1 ? 'oferta' : 'ofertas'} no Mercado Livre. Preço
              por dose calculado sobre a porção do rótulo. Última coleta{' '}
              {formatUltimaColeta(lastUpdated)}.
            </p>
          )}

          <CampoBusca termoInicial={filtros.termo} className="mt-5 max-w-xl" />
        </div>

        <ComoComparamos ultimaColeta={lastUpdated} className="mb-6 max-w-3xl" />

        {catalogoVazio ? (
          <p className="rounded-xl border border-line bg-surface p-6 text-ink-3">
            Nenhum produto disponível no momento. O catálogo é atualizado diariamente —{' '}
            <Link href="/" className="font-medium text-brand-strong underline">
              veja as ofertas na home
            </Link>
            .
          </p>
        ) : (
          <TelaDeBusca filtros={filtros} catalogo={catalogo} />
        )}
      </main>
    </div>
  )
}
