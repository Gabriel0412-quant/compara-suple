import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

import { PaginaDeBusca } from '@/components/busca/PaginaDeBusca'
import { trocarDeCategoria } from '@/components/busca/TelaDeBusca'
import { getAllProductCards, getCategoryBySlug, listCategories } from '@/lib/categories'
import { parseFiltros } from '@/lib/filtros'
import { getCatalogStats } from '@/lib/stats'

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
 * A categoria é a tela de busca, com o filtro fixo no caminho.
 *
 * Podia ter virado um `redirect` para `/produtos?categoria=<slug>`, e teria
 * sido mais simples. Mas `/produtos` é `noindex` — resultado filtrado são
 * infinitas combinações do mesmo catálogo —, e mandar o tráfego de categoria
 * para lá tiraria do índice as únicas páginas de listagem indexáveis,
 * desligando a malha de links do #113.
 *
 * O que mudou no #237: a rota deixou de ter cabeçalho próprio. Tinha um emoji
 * de 48px e um parágrafo de apresentação — "a categoria-âncora pra ganho de
 * massa e definição" —, e não trazia o campo de busca nem o "Como comparamos"
 * que a busca tem. Eram duas telas parecidas em vez de uma tela com um filtro.
 *
 * O texto de apresentação era também o que fazia desta a versão *com conteúdo
 * próprio* da listagem, e isso se perdeu junto. O que sustenta a indexação
 * agora é o `<title>`, a descrição, o `<h1>` da categoria e o conjunto de
 * produtos — que continua sendo só desta rota, já que `/produtos` é `noindex`
 * e não concorre. `cat.description` continua viva na meta description.
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

  return (
    <PaginaDeBusca
      titulo={cat.name}
      trilha={cat.name}
      filtros={filtros}
      catalogo={catalogo}
      lastUpdated={lastUpdated}
      base={`/categoria/${cat.slug}`}
      hrefDaCategoria={trocarDeCategoria(filtros)}
      rodape={
        /*
          A malha entre categorias (#113) fica, e não sai para o painel lateral.

          O painel só lista categoria que tem resultado sob os filtros de agora;
          esta lista mostra todas, inclusive as vazias. São coisas diferentes:
          uma é filtro, a outra é navegação — e é a segunda que o buscador segue.
        */
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
                    className="flex min-h-9 items-center rounded-full border border-line-strong bg-surface px-3 text-sm text-ink-2 transition-colors hover:border-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {c.shortName}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      }
    />
  )
}
