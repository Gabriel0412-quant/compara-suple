import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import {
  TelaDeBusca,
  contarOfertas,
  contarResultados,
  trocarDeCategoria,
} from '@/components/busca/TelaDeBusca'
import { getAllProductCards, getCategoryBySlug, listCategories } from '@/lib/categories'
import { parseFiltros } from '@/lib/filtros'
import { formatCount, formatUltimaColeta, getCatalogStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: 'Categoria não encontrada · Preço Suplemento' }

  return {
    title: `${cat.name} — Comparar preços · Preço Suplemento`,
    /*
      "entre múltiplas lojas do Mercado Livre" saiu.

      É a mesma afirmação de sortimento que a linha de contexto da busca
      recusa: enquanto só houver um marketplace, o que se compara são anúncios
      dele. A descrição agora diz o que a página faz — preço por dose e por
      quilo —, que é verdade hoje.
    */
    description: `${cat.description} Compare o preço por dose e por quilo entre as ofertas.`,
    alternates: { canonical: `/categoria/${cat.slug}` },
  }
}

/**
 * A categoria é a mesma tela da busca, com o filtro fixo no caminho.
 *
 * Podia ter virado um `redirect` para `/produtos?categoria=<slug>`, e teria
 * sido mais simples. Mas `/produtos` é `noindex` — resultado filtrado são
 * infinitas combinações do mesmo catálogo —, e mandar o tráfego de categoria
 * para lá tiraria do índice as únicas páginas de listagem que têm texto
 * próprio, desligando a malha de links do #113.
 *
 * Então a rota fica, indexável, com título e descrição dela, e o corpo passa a
 * ser `TelaDeBusca`. Quem navega vê a mesma coisa nos dois lugares; o buscador
 * continua vendo a URL que sempre viu.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  /*
    A categoria vem do caminho e sobrescreve o que vier na query.

    `/categoria/creatina?categoria=whey-protein` seria uma página dizendo
    "Creatina" no título e listando whey. O caminho é o que a URL promete.

    Ela não é a única, porém: com multisseleção, chegar aqui com uma segunda
    categoria na query é legítimo — é o estado logo antes de o próximo clique
    mandar a pessoa para a busca. As duas valem, com a do caminho na frente.
  */
  const daQuery = parseFiltros(await searchParams)
  const filtros = {
    ...daQuery,
    // A do caminho na frente, e sem repetir se a query também a trouxe.
    categorias: [cat.slug, ...daQuery.categorias.filter(c => c !== cat.slug)],
  }

  const [catalogo, { lastUpdated }] = await Promise.all([
    getAllProductCards(),
    getCatalogStats(),
  ])

  const nResultados = contarResultados(catalogo, filtros)
  const ofertas = contarOfertas(catalogo, filtros)

  return (
    <div className="min-h-screen bg-surface-muted text-ink">
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: cat.name }]} />

        <header className="mt-6 mb-6">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="shrink-0 text-5xl">
              {cat.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink md:text-4xl">
                {cat.name}
              </h1>
              <p className="mt-3 max-w-2xl text-ink-2">{cat.description}</p>
              {nResultados > 0 && (
                <p className="mt-3 max-w-3xl text-sm text-ink-3">
                  {formatCount(nResultados)}{' '}
                  {nResultados === 1 ? 'produto comparado' : 'produtos comparados'} ·{' '}
                  {formatCount(ofertas)} {ofertas === 1 ? 'oferta' : 'ofertas'} no Mercado Livre ·
                  última coleta {formatUltimaColeta(lastUpdated)}
                </p>
              )}
            </div>
          </div>
        </header>

        <TelaDeBusca
          filtros={filtros}
          catalogo={catalogo}
          base={`/categoria/${cat.slug}`}
          hrefDaCategoria={trocarDeCategoria(filtros)}
        />

        {/*
          A malha entre categorias (#113) fica, e não sai para o painel lateral.

          O painel só lista categoria que tem resultado sob os filtros de agora;
          esta lista mostra todas, inclusive as vazias. São coisas diferentes:
          uma é filtro, a outra é navegação — e é a segunda que o buscador segue.
        */}
        <nav aria-labelledby="outras-categorias" className="mt-12 border-t border-line pt-8">
          <h2
            id="outras-categorias"
            className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-ink-4"
          >
            Outras categorias
          </h2>
          <ul className="flex flex-wrap gap-2">
            {listCategories()
              .filter(c => c.slug !== cat.slug)
              .map(c => (
                <li key={c.slug}>
                  <Link
                    href={`/categoria/${c.slug}`}
                    className="flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm text-ink-2 transition-colors hover:border-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span aria-hidden="true">{c.emoji}</span>
                    {c.shortName}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </main>
    </div>
  )
}
