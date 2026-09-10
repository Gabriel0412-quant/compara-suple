import Link from 'next/link'

import CampoBusca from '@/components/CampoBusca'
import FaixaDeMarcas from '@/components/home/FaixaDeMarcas'
import { FaixaDeCaptura } from '@/components/home/FaixaDeCaptura'
import { BlocoComparador } from '@/components/home/BlocoComparador'
import { PrateleiraDeCategoria } from '@/components/home/PrateleiraDeCategoria'
import { PrateleiraDeDescontos } from '@/components/home/PrateleiraDeDescontos'
import { listarMarcas } from '@/lib/brands'
import { comparadorDaHome } from '@/lib/comparador-home'
import {
  descontosDaPrateleira,
  fundoDaCategoria,
  fundoDaPrateleira,
  prateleirasDaHome,
} from '@/lib/shelves'
import { getProductsOnSale, listCategoriesWithProducts } from '@/lib/categories'
import { getCatalogStats, formatCount, formatUltimaColeta } from '@/lib/stats'

export const dynamic = 'force-dynamic'

// ---------- Home ----------

export default async function Home() {
  // Busca os produtos em oferta (já vem ordenado por desconto absoluto)
  const [onSale, stats, categorias, marcas, prateleiras, comparador] = await Promise.all([
    getProductsOnSale(),
    getCatalogStats(),
    listCategoriesWithProducts(),
    listarMarcas(),
    prateleirasDaHome(),
    comparadorDaHome(),
  ])
  // A faixa mostra as cinco primeiras; `/marcas` mostra o resto.
  const marcasEmDestaque = marcas.slice(0, 5)
  /*
    `TopOfferCard` e o `topOffers` saíram junto com a coluna direita do hero.

    Não era perda de informação: os dois primeiros produtos apareciam duas
    vezes na mesma página, no hero e na faixa logo abaixo. O card do hero da
    maquete 1b é outro (maior queda do dia), e nasce no #128 com o dado que o
    sustente.

    O limite passou de 6 para o mesmo das outras prateleiras: eram seis porque
    o grid tinha duas fileiras de três. Numa prateleira que rola, o corte não
    tem por que ser diferente do das categorias.
  */
  const descontos = descontosDaPrateleira(onSale)

  return (
    <div className="min-h-screen bg-surface-muted text-ink">
      {/*
        A home era a única das nove páginas sem landmark `main` — as outras
        oito já tinham. Passou despercebido enquanto o `<Header />` era
        importado por cada página; com header e rodapé no layout, a falta
        fica evidente, e quem navega por landmarks não tinha como pular a
        navegação para chegar ao conteúdo.
      */}
      <main>

      {/*
        Hero da maquete 1b: a busca é o centro da página, não um acessório do
        header. O desenho tem uma segunda coluna à direita — o card de maior
        queda do dia — que não entra aqui: ela afirma variação de preço no
        tempo, e o histórico ainda não sustenta isso (#128). Por isso o hero
        precisa ficar bem numa coluna só, e não com um buraco no grid.
      */}
      <section className="bg-surface px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-ink sm:text-5xl md:text-[52px]">
            Quanto custa a sua dose hoje?
          </h1>

          {/*
            Os três números saem de `lib/stats.ts`, que existe justamente porque
            esta home já exibiu "1.482 produtos monitorados" e "R$4,2M
            economizados" — nenhum dos dois com origem no banco.
          */}
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-2 md:text-lg">
            Acompanhamos <strong className="font-semibold text-ink">{formatCount(stats.offers)} ofertas</strong>{' '}
            de <strong className="font-semibold text-ink">{formatCount(stats.products)} produtos</strong> e
            mostramos o preço por dose e por quilo lado a lado. Última coleta{' '}
            {formatUltimaColeta(stats.lastUpdated)}.
          </p>

          <CampoBusca tamanho="hero" className="mt-7 max-w-2xl" />

          {categorias.length > 0 && (
            <nav aria-label="Categorias em destaque" className="mt-5 flex flex-wrap gap-2">
              {categorias.slice(0, 6).map(categoria => (
                <Link
                  key={categoria.slug}
                  href={`/categoria/${categoria.slug}`}
                  className="flex min-h-11 items-center rounded-full border-[1.5px] border-line-strong px-4 text-sm text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {categoria.name}
                </Link>
              ))}
            </nav>
          )}

          <p className="mt-5 text-sm text-ink-3">
            Ou{' '}
            <Link href="/comparar" className="font-medium text-brand-strong underline hover:text-brand-deep">
              abra o comparador
            </Link>{' '}
            para ver produtos lado a lado, ou{' '}
            <Link href="/ofertas" className="font-medium text-brand-strong underline hover:text-brand-deep">
              veja as ofertas do dia
            </Link>.
          </p>
        </div>
      </section>

      <FaixaDeMarcas marcas={marcasEmDestaque} />

      {/*
        Prateleiras alternando fundo para separar as faixas sem precisar de
        linha divisória — como na maquete 1b.

        Os descontos vêm primeiro e ocupam o índice 0 da alternância, então as
        categorias começam em 1. O deslocamento é o que mantém a alternância
        íntegra: sem ele, a primeira categoria repetiria o fundo dos descontos
        e as duas faixas colariam numa só.
      */}
      <div className={fundoDaPrateleira(0)}>
        <PrateleiraDeDescontos produtos={descontos} />
      </div>
      {/*
        Fora da mutação: é laço de renderização, não regra.

        A decisão que dá para errar aqui — qual fundo cada prateleira recebe —
        foi para `fundoDaPrateleira`, que tem teste. O que sobra é `.map()`
        sobre uma lista já montada e testada em `lib/shelves.ts`. O mutante que
        restava trocava o corpo por `undefined`, o que apaga as prateleiras da
        página: só o e2e vê isso, e `e2e/prateleiras.spec.ts` vê.
      */}
      {
        // Stryker disable next-line all
        prateleiras.map((prateleira, i) => (
          <div key={prateleira.categoria.slug} className={fundoDaCategoria(i)}>
            <PrateleiraDeCategoria prateleira={prateleira} />
          </div>
        ))
      }

      <BlocoComparador dados={comparador} />

      <FaixaDeCaptura />

      {/*
        A faixa de números saiu daqui.

        Ela repetia ofertas, produtos e última coleta logo abaixo do parágrafo
        do hero, que agora carrega os três. A maquete 1b não tem essa faixa
        justamente por isso: o mesmo dado dito duas vezes na mesma dobra não
        informa mais, só ocupa altura antes do conteúdo.
      */}
      </main>
    </div>
  )
}
