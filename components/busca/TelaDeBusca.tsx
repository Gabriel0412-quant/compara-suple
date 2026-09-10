import Link from 'next/link'

import { ChipsDeFiltro } from '@/components/busca/ChipsDeFiltro'
import { PainelDeFiltros } from '@/components/busca/PainelDeFiltros'
import { ProductGridCard } from '@/components/category/ProductGridCard'
import type { CategoryProduct } from '@/lib/categories'
import {
  ROTA_DA_BUSCA,
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
  hrefDaCategoria?: (valor: string | null) => string
}) {
  const resultados = ordenar(aplicarFiltros(catalogo, filtros), filtros.ordem)
  const marcas = facetasDeMarca(catalogo, filtros)
  const chips = chipsDeFiltro(filtros, marcas)

  return (
    <div className="flex flex-col gap-8 md:flex-row md:gap-10">
      <PainelDeFiltros
        filtros={filtros}
        categorias={facetasDeCategoria(catalogo, filtros)}
        marcas={marcas}
        sabores={facetasDeSabor(catalogo, filtros)}
        base={base}
        hrefDaCategoria={hrefDaCategoria}
      />

      <div className="min-w-0 flex-1">
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
                href={ROTA_DA_BUSCA}
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

/** O link que troca a categoria mantendo a rota indexável de cada uma. */
export function trocarDeCategoria(filtros: Filtros) {
  return (valor: string | null) =>
    valor === null
      ? serializarFiltros({ ...filtros, categoria: null }, ROTA_DA_BUSCA)
      : serializarFiltros({ ...filtros, categoria: valor }, `/categoria/${valor}`)
}
