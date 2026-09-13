import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { after } from 'next/server'

import { PaginaDeBusca } from '@/components/busca/PaginaDeBusca'
import { contarResultados } from '@/components/busca/TelaDeBusca'
import { ehBot, registrarEvento } from '@/lib/eventos'
import { getAllProductCards } from '@/lib/categories'
import { parseFiltros, semFiltro } from '@/lib/filtros'
import { formatCount, getCatalogStats } from '@/lib/stats'

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
    a versão indexável desta tela, com um recorte só.
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

  return (
    <PaginaDeBusca
      titulo={
        filtros.termo
          ? `${formatCount(nResultados)} ${nResultados === 1 ? 'resultado' : 'resultados'} para “${filtros.termo}”`
          : 'Produtos no comparador'
      }
      trilha={filtros.termo ? `Busca: ${filtros.termo}` : 'Produtos'}
      filtros={filtros}
      catalogo={catalogo}
      lastUpdated={lastUpdated}
    />
  )
}
