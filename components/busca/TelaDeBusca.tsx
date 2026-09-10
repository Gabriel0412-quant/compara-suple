import Link from 'next/link'

import { ChipsDeFiltro } from '@/components/busca/ChipsDeFiltro'
import { PainelDeFiltros } from '@/components/busca/PainelDeFiltros'
import { ProductGridCard } from '@/components/category/ProductGridCard'
import type { CategoryProduct } from '@/lib/categories'
import {
  ORDENS,
  ROTA_DA_BUSCA,
  alternar,
  aplicarFiltros,
  chipsDeFiltro,
  facetasDeCategoria,
  facetasDeMarca,
  facetasDeSabor,
  ordenar,
  serializarFiltros,
  type Filtros,
} from '@/lib/filtros'
import { formatCount } from '@/lib/stats'

/**
 * A tela de busca: painel de filtros, chips e grade.
 *
 * Duas rotas a usam, e é isso que ela existe para garantir. `/produtos` é a
 * busca livre; `/categoria/<slug>` é a mesma tela com uma categoria fixa, e
 * continua sendo a URL indexável — com texto próprio e sem `noindex`.
 *
 * Fazer o chip de categoria da home apontar para `/produtos?categoria=` teria
 * sido mais simples e teria mandado o tráfego de categoria para uma página que
 * o Google não indexa, desligando a malha de links interna do #113. Aqui o
 * visitante vê a mesma coisa nos dois lugares e o buscador continua vendo a
 * rota que sempre viu.
 *
 * O que difere entre as duas fica nas rotas: título, descrição, trilha e o
 * campo de busca. Aqui mora só o que precisa ser idêntico.
 */
export function TelaDeBusca({
  filtros,
  catalogo,
  base = ROTA_DA_BUSCA,
  hrefDaCategoria,
}: {
  filtros: Filtros
  catalogo: CategoryProduct[]
  base?: string
  hrefDaCategoria?: (valor: string) => string
}) {
  const resultados = ordenar(aplicarFiltros(catalogo, filtros), filtros.ordem)
  const marcas = facetasDeMarca(catalogo, filtros)
  const chips = chipsDeFiltro(filtros, marcas)
  const tetos = tetosDoCatalogo(catalogo)

  return (
    <div className="flex flex-col gap-8 md:flex-row md:gap-10">
      <PainelDeFiltros
        filtros={filtros}
        categorias={facetasDeCategoria(catalogo, filtros)}
        marcas={marcas}
        sabores={facetasDeSabor(catalogo, filtros)}
        base={base}
        hrefDaCategoria={hrefDaCategoria}
        tetos={tetos}
      />

      <div className="min-w-0 flex-1">
        {/*
          A ordenação fica no topo da coluna de resultados, à direita, como na
          maquete 3a — e não no painel lateral, onde estava.

          O lugar diz o que a coisa faz: o painel encolhe a lista, a ordenação
          reorganiza a mesma lista. Misturar os dois no mesmo bloco faz "Menor
          R$/dose" parecer mais um recorte.
        */}
        {resultados.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-4">
              Ordenar por
            </span>
            <ul className="flex flex-wrap items-center gap-1">
              {ORDENS.map(o => (
                <li key={o.valor}>
                  <Link
          prefetch={false}
                    href={serializarFiltros({ ...filtros, ordem: o.valor }, base)}
                    aria-current={filtros.ordem === o.valor ? 'true' : undefined}
                    className={`flex min-h-8 items-center rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      filtros.ordem === o.valor
                        ? 'border-brand bg-surface-warm font-semibold text-brand-ink'
                        : 'border-line-strong bg-surface text-ink-2 hover:border-brand hover:text-brand-strong'
                    }`}
                  >
                    {o.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ChipsDeFiltro chips={chips} filtros={filtros} />

        {resultados.length === 0 ? (
          /*
            Estado sem resultado, e sem promessa.

            Diz o que houve e oferece saídas que funcionam. O texto muda
            conforme haja termo: sem termo, o problema é a combinação de
            filtros, e mandar "confira a grafia" seria conselho para um erro
            que a pessoa não cometeu.
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
          prefetch={false}
                href={ROTA_DA_BUSCA}
                className="flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                Limpar filtros
              </Link>
              <Link
          prefetch={false}
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
                "mostrando N de N" da maquete. Enquanto tudo cabe numa página,
                os dois números são o mesmo e a frase diz isso — em vez de
                sugerir que há mais adiante.
              */}
              mostrando {formatCount(resultados.length)} de {formatCount(resultados.length)}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/** Quantas ofertas os resultados somam, para a linha de contexto das rotas. */
export function contarOfertas(catalogo: CategoryProduct[], filtros: Filtros): number {
  /*
    Ofertas, não lojas.

    A maquete escreve "412 ofertas de 24 lojas". Enquanto só houver Mercado
    Livre, o que existe são anúncios do mesmo marketplace — dizer "lojas" seria
    a primeira afirmação de sortimento que o dado não sustenta. Muda no EP06.
  */
  return aplicarFiltros(catalogo, filtros).reduce((soma, p) => soma + p.offerCount, 0)
}

/** Quantos produtos os filtros deixam passar. */
export function contarResultados(catalogo: CategoryProduct[], filtros: Filtros): number {
  return aplicarFiltros(catalogo, filtros).length
}

/**
 * O link que marca ou desmarca uma categoria, escolhendo a rota certa.
 *
 * Com exatamente uma categoria marcada, o destino é `/categoria/<slug>` — a
 * URL indexável, com texto próprio. Com nenhuma ou com duas, o caminho não
 * consegue representar o recorte, e o destino é a busca.
 *
 * É a regra que mantém o índice do Google limpo: uma categoria é uma página
 * com conteúdo; combinação de categorias é resultado de filtro.
 */
export function trocarDeCategoria(filtros: Filtros) {
  return (valor: string) => {
    const categorias = alternar(filtros.categorias, valor)
    const base = categorias.length === 1 ? `/categoria/${categorias[0]}` : ROTA_DA_BUSCA
    return serializarFiltros({ ...filtros, categorias }, base)
  }
}

/**
 * Os extremos do catálogo, para os tetos terem escala real.
 *
 * Um slider de preço que vai até um número fixo fica sem sentido quando o
 * catálogo muda: metade da barra vazia, ou o produto mais caro fora do
 * alcance. Arredonda para cima para o valor máximo ser alcançável.
 */
export function tetosDoCatalogo(catalogo: CategoryProduct[]): { preco: number; dose: number } {
  const precos = catalogo.map(p => p.featuredPrice).filter(v => v > 0)
  const doses = catalogo
    .map(p => p.featuredPerDose)
    .filter((v): v is number => v !== null && v > 0)
  return {
    preco: precos.length > 0 ? Math.ceil(Math.max(...precos)) : 1,
    // Uma casa a mais no arredondamento: doses vivem entre R$ 0,20 e R$ 10, e
    // arredondar para o inteiro acima jogaria fora metade da escala.
    dose: doses.length > 0 ? Math.ceil(Math.max(...doses) * 10) / 10 : 1,
  }
}
