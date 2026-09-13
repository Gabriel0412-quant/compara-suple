import type { ReactNode } from 'react'
import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import CampoBusca from '@/components/CampoBusca'
import { TelaDeBusca, contarOfertas, contarResultados } from '@/components/busca/TelaDeBusca'
import type { CategoryProduct } from '@/lib/categories'
import type { Filtros } from '@/lib/filtros'
import { formatCount, formatUltimaColeta } from '@/lib/stats'

/**
 * A página de busca inteira — trilha, título, contexto, campo e resultados.
 *
 * `TelaDeBusca` já garantia que o *corpo* fosse o mesmo nas rotas que a usam.
 * O que estava em volta, não: `/categoria/<slug>` tinha cabeçalho próprio, com
 * emoji e um parágrafo de apresentação, e não trazia nem o campo de busca nem
 * o "Como comparamos". `/ofertas` era outra página inteira, com o visual de
 * antes do rebranding.
 *
 * As três eram a mesma tela com um filtro diferente aplicado, e só o corpo
 * sabia disso. Agora a página inteira mora aqui, e o que cada rota escolhe é o
 * título, a trilha e quais filtros já vêm ligados.
 */
export function PaginaDeBusca({
  titulo,
  trilha,
  filtros,
  catalogo,
  lastUpdated,
  base,
  hrefDaCategoria,
  rodape,
}: {
  titulo: string
  /** Último item da trilha; "Início" entra sozinho na frente. */
  trilha: string
  filtros: Filtros
  catalogo: CategoryProduct[]
  lastUpdated: Date | null
  base?: string
  hrefDaCategoria?: (valor: string) => string
  /** Malha de links da rota, quando ela tem uma. Vai abaixo dos resultados. */
  rodape?: ReactNode
}) {
  const nResultados = contarResultados(catalogo, filtros)
  const ofertas = contarOfertas(catalogo, filtros)
  const catalogoVazio = catalogo.length === 0

  return (
    <div className="min-h-screen bg-surface-muted text-ink">
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: trilha }]} />

        <div className="mt-6 mb-6">
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink md:text-4xl">{titulo}</h1>
          {nResultados > 0 && (
            <p className="mt-3 max-w-3xl text-ink-2">
              {formatCount(ofertas)} {ofertas === 1 ? 'oferta' : 'ofertas'} no Mercado Livre. Preço
              por dose calculado sobre a porção do rótulo. Última coleta{' '}
              {formatUltimaColeta(lastUpdated)}.
            </p>
          )}

          <CampoBusca termoInicial={filtros.termo} className="mt-5 max-w-xl" />
        </div>

        {/*
          Sem o resumo "Como comparamos" e sem o aviso de coleta defasada que
          vem com ele, por decisão do dono do produto em 13/09/2026: a listagem
          é para escanear produto, e dois blocos de texto entre o campo de
          busca e o primeiro card empurravam a grade para baixo da dobra.

          O que sai de cada um, e onde continua:

          - a declaração de comissão de afiliado continua no rodapé de toda
            página, e em `/produto/[slug]`, que é onde o clique de compra
            acontece de fato;
          - a metodologia — menor preço contra destaque, R$/dose, frete fora da
            conta — continua em `/comparar` e em `/produto/[slug]`;
          - o aviso de que não avaliamos eficácia continua nas mesmas duas;
          - o aviso de coleta defasada deixa de existir nas listagens. É a
            perda real: enquanto a ingestão do #188 estiver parada, elas
            mostram preço velho sem dizer. A linha de contexto acima continua
            declarando a data da última coleta.
        */}
        {catalogoVazio ? (
          <p className="rounded-xl border border-line bg-surface p-6 text-ink-3">
            Nenhum produto disponível no momento. O catálogo é atualizado diariamente —{' '}
            <Link href="/" className="font-medium text-brand-strong underline">
              veja as ofertas na home
            </Link>
            .
          </p>
        ) : (
          <TelaDeBusca
            filtros={filtros}
            catalogo={catalogo}
            base={base}
            hrefDaCategoria={hrefDaCategoria}
          />
        )}

        {rodape}
      </main>
    </div>
  )
}
