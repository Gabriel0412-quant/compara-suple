import Link from 'next/link'

import { formatBRL } from '@/lib/products'
import type { ComparadorDaHome, ItemComparado } from '@/lib/comparador-home'

/**
 * O bloco comparador da home (maquete 1b).
 *
 * Três produtos da mesma categoria lado a lado, com preço por dose, por quilo
 * e número de ofertas. É a tese do produto numa dobra: equivalentes divergem
 * no preço normalizado.
 *
 * A seleção e o destaque vêm prontos do `lib/comparador-home.ts` (#156); aqui
 * só se decide como mostrar. Em particular, o destaque **não** é recalculado:
 * se `melhorPorKg` vier vazio, ninguém é coroado, e o motivo é dito.
 */

function Linha({ rotulo, valor, forte = false }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-3">{rotulo}</dt>
      <dd className={`font-mono ${forte ? 'font-semibold text-ink' : 'text-ink-2'}`}>{valor}</dd>
    </div>
  )
}

function Cartao({ item, destacado }: { item: ItemComparado; destacado: boolean }) {
  const { produto } = item
  const peso =
    produto.sizeGrams && produto.sizeGrams >= 1000
      ? `${produto.sizeGrams / 1000} kg`
      : `${produto.sizeGrams} g`

  return (
    <li
      className={`w-[280px] shrink-0 snap-start rounded-2xl p-5 sm:w-[320px] lg:w-auto ${
        destacado ? 'border-2 border-brand bg-surface-warm-soft' : 'border border-line bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-sm uppercase tracking-[0.1em] text-ink-3 sm:text-[10px]">
          {produto.brand ? `${produto.brand} · ` : ''}
          {peso}
        </p>
        {destacado && (
          <span className="shrink-0 rounded-full bg-brand px-2 py-1 font-mono text-sm font-semibold uppercase tracking-[0.05em] text-white sm:py-0.5 sm:text-[10px]">
            Melhor R$/kg
          </span>
        )}
      </div>

      <Link
        href={`/produto/${produto.slug}`}
        className="mt-3 flex min-h-11 items-center rounded-md text-base font-semibold text-ink transition-colors hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-0 sm:text-sm"
      >
        {produto.name}
      </Link>

      <p className="mt-3 font-mono text-3xl font-semibold text-ink">
        {formatBRL(produto.featuredPrice)}
      </p>

      <dl className="mt-4 flex flex-col gap-2 text-base sm:text-sm">
        {/*
          Dose ausente é dita, não omitida — mesma formulação do card de
          produto. Some sem explicação parece bug; dizer que falta é informação.
        */}
        <Linha
          rotulo="Por dose"
          valor={item.precoPorDose === null ? 'não informado' : formatBRL(item.precoPorDose)}
        />
        <Linha
          rotulo="Por quilo"
          valor={item.precoPorKg === null ? 'não informado' : formatBRL(item.precoPorKg)}
          forte
        />
        {/*
          "Ofertas", e não "Lojas" como na maquete: enquanto só houver Mercado
          Livre, este número conta anúncios do mesmo marketplace. O motivo está
          registrado em `lib/comparador-home.ts`.
        */}
        <Linha rotulo="Ofertas" valor={String(item.ofertas)} />
      </dl>
    </li>
  )
}

/** Por que ninguém foi coroado, quando ninguém foi. */
export function explicarAusenciaDeDestaque(motivo: ComparadorDaHome['motivoSemDestaque']): string | null {
  if (motivo === 'empate') return 'Os três custam o mesmo por quilo.'
  if (motivo === 'sem-comparacao') return 'Não há preço por quilo suficiente para comparar.'
  return null
}

export function BlocoComparador({ dados }: { dados: ComparadorDaHome | null }) {
  // Sem trio comparável não há bloco. Inventar uma comparação de dois seria
  // pior do que não ter a seção.
  if (!dados) return null

  const { categoria, itens, melhorPorKg, motivoSemDestaque, urlDoComparador } = dados
  const explicacao = explicarAusenciaDeDestaque(motivoSemDestaque)

  return (
    <section aria-labelledby="comparador-home" className="bg-surface px-4 py-12 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2
              id="comparador-home"
              className="text-2xl font-bold tracking-[-0.03em] text-ink md:text-[30px]"
            >
              Mesma categoria, preço por dose diferente
            </h2>
            {/*
              O critério da seleção aparece no texto: seleção que o leitor não
              entende parece favorecimento.
            */}
            <p className="mt-1.5 text-sm text-ink-3">
              Os três {categoria.name.toLowerCase()} com mais ofertas ativas, comparados por dose e
              por quilo.
              {explicacao ? ` ${explicacao}` : ''}
            </p>
          </div>
          <Link
            href={urlDoComparador}
            className="flex min-h-11 items-center self-start whitespace-nowrap rounded-lg bg-surface-dark px-4 py-2.5 text-sm font-semibold text-ink-on-dark transition-colors hover:bg-surface-dark-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:self-auto"
          >
            Abrir comparador <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/*
          Em tela estreita o bloco **rola**, não empilha.

          Empilhar seria o reflexo automático, e destruiria a única coisa que
          este bloco faz: comparar. Três cartões um embaixo do outro obrigam a
          memorizar o R$/kg do primeiro para conferir no terceiro — que é
          exatamente o trabalho que o site existe para poupar. Com
          `snap-mandatory` a rolagem para em cartão inteiro, e o de referência
          continua meio visível na borda.
        */}
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
          {itens.map((item, i) => (
            <Cartao key={item.produto.id} item={item} destacado={melhorPorKg.includes(i)} />
          ))}
        </ul>
      </div>
    </section>
  )
}
