import Link from 'next/link'

import { ROTA_DA_BUSCA, SEM_FILTRO, serializarFiltros, type ChipDeFiltro, type Filtros } from '@/lib/filtros'

/**
 * Os filtros ativos, acima da grade, cada um com o × que o remove.
 *
 * Existem porque o painel lateral some no celular e pode ter grupo fechado no
 * desktop: sem os chips, a pessoa vê uma lista curta sem enxergar o que a
 * encurtou. É a mesma razão pela qual a faixa de marcas da home declarava o
 * recorte — recorte invisível parece catálogo pequeno.
 */
export function ChipsDeFiltro({ chips, filtros }: { chips: ChipDeFiltro[]; filtros: Filtros }) {
  if (chips.length === 0) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-4">
        Filtros ativos
      </span>
      {chips.map(chip => (
        <Link
          prefetch={false}
          key={chip.rotulo}
          href={chip.href}
          className="flex min-h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm text-ink-2 transition-colors hover:border-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {chip.rotulo}
          {/*
            O × é decorativo: o nome acessível do link já diz o que ele faz, e
            um "×" lido em voz alta não diz nada.
          */}
          <span aria-hidden="true" className="text-ink-4">×</span>
          <span className="sr-only">— remover filtro</span>
        </Link>
      ))}
      {chips.length > 1 && (
        <Link
          prefetch={false}
          href={serializarFiltros({ ...filtros, ...SEM_FILTRO }, ROTA_DA_BUSCA)}
          className="rounded-md px-1 text-sm font-semibold text-brand-strong hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          limpar tudo
        </Link>
      )}
    </div>
  )
}
