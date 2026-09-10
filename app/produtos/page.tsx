import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { after } from 'next/server'

import { Breadcrumb } from '@/components/Breadcrumb'
import CampoBusca from '@/components/CampoBusca'
import { ComoComparamos } from '@/components/ComoComparamos'
import { ChipsDeFiltro } from '@/components/busca/ChipsDeFiltro'
import { PainelDeFiltros } from '@/components/busca/PainelDeFiltros'
import { ProductGridCard } from '@/components/category/ProductGridCard'
import { ehBot, registrarEvento } from '@/lib/eventos'
import { getAllProductCards } from '@/lib/categories'
import {
  aplicarFiltros,
  chipsDeFiltro,
  facetasDeCategoria,
  facetasDeMarca,
  facetasDeSabor,
  ordenar,
  parseFiltros,
  semFiltro,
} from '@/lib/filtros'
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

  const resultados = ordenar(aplicarFiltros(catalogo, filtros), filtros.ordem)
  const categorias = facetasDeCategoria(catalogo, filtros)
  const marcas = facetasDeMarca(catalogo, filtros)
  const sabores = facetasDeSabor(catalogo, filtros)
  const chips = chipsDeFiltro(filtros, marcas)

  /*
    O número é de ofertas, não de lojas.

    A maquete escreve "412 ofertas de 24 lojas". Enquanto só houver Mercado
    Livre, o que existe são anúncios do mesmo marketplace — dizer "lojas" seria
    a primeira afirmação de sortimento que o dado não sustenta. Muda no EP06,
    quando houver uma segunda loja de verdade.
  */
  const ofertas = resultados.reduce((soma, p) => soma + p.offerCount, 0)

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
        nResultados: resultados.length,
        termo: filtros.termo,
      })
    })
  }

  const catalogoVazio = catalogo.length === 0
  const semResultado = !catalogoVazio && resultados.length === 0

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
              ? `${formatCount(resultados.length)} ${resultados.length === 1 ? 'resultado' : 'resultados'} para “${filtros.termo}”`
              : 'Produtos no comparador'}
          </h1>
          {resultados.length > 0 && (
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
          <div className="flex flex-col gap-8 md:flex-row md:gap-10">
            <PainelDeFiltros
              filtros={filtros}
              categorias={categorias}
              marcas={marcas}
              sabores={sabores}
            />

            <div className="min-w-0 flex-1">
              <ChipsDeFiltro chips={chips} filtros={filtros} />

              {semResultado ? (
                /*
                  Estado sem resultado, e sem promessa.

                  Diz o que houve e oferece saídas que funcionam. O texto muda
                  conforme haja termo: sem termo, o problema é a combinação de
                  filtros, e mandar "confira a grafia" seria conselho para um
                  erro que a pessoa não cometeu.
                */
                <div className="rounded-2xl border border-line bg-surface p-6">
                  <p className="mb-1 font-semibold text-ink">
                    {filtros.termo
                      ? `Nenhum produto para “${filtros.termo}” com esses filtros.`
                      : 'Nenhum produto com esses filtros.'}
                  </p>
                  <p className="mb-4 text-sm text-ink-3">
                    {filtros.termo
                      ? 'Confira a grafia, tente um termo mais curto — “whey” no lugar de “whey isolado sabor baunilha” — ou tire um filtro.'
                      : 'Tente tirar um dos filtros: quanto mais restrições juntas, menor a chance de sobrar produto.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/produtos"
                      className="flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
                    >
                      Limpar filtros
                    </Link>
                    <Link
                      href="/comparar"
                      className="flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong"
                    >
                      Abrir comparador
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {resultados.map(produto => (
                      <li key={produto.id}>
                        <ProductGridCard product={produto} superficie="lista" />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-center font-mono text-xs text-ink-4">
                    {/*
                      "mostrando N de N" da maquete. Enquanto tudo cabe numa
                      página, os dois números são o mesmo e a frase diz isso —
                      em vez de sugerir que há mais adiante.
                    */}
                    mostrando {formatCount(resultados.length)} de{' '}
                    {formatCount(resultados.length)}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
