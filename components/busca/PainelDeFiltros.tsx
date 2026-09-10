import Link from 'next/link'

import {
  ORDENS,
  ROTA_DA_BUSCA,
  serializarFiltros,
  type Faceta,
  type Filtros,
} from '@/lib/filtros'

/**
 * O painel lateral de filtros da busca (maquete 3a/3b).
 *
 * Tudo aqui funciona sem JavaScript, e isso não é purismo: a página é server
 * component e o estado mora na URL, então cada opção já é naturalmente um
 * link. Transformá-la em `onClick` acrescentaria um cliente inteiro para
 * reproduzir o que o `<a>` faz de graça — e quebraria o compartilhamento da
 * URL filtrada, que é o motivo de o estado morar lá.
 *
 * Os grupos abrem e fecham com `<details>`, que é o acordeão da maquete sem
 * script. `open` por padrão nos que têm filtro ativo: grupo fechado escondendo
 * um filtro que está valendo é como a pessoa perde de vista por que a lista
 * encolheu.
 */

function Grupo({
  titulo,
  aberto,
  children,
}: {
  titulo: string
  aberto: boolean
  children: React.ReactNode
}) {
  return (
    <details open={aberto} className="border-b border-line py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink">
        {titulo}
        {/*
          O sinal é decorativo: quem usa leitor de tela recebe o estado do
          `<details>` pelo próprio elemento, e ler "mais" ou "menos" junto do
          título só duplicaria a informação com a palavra errada.
        */}
        <span aria-hidden="true" className="font-mono text-base text-ink-4 transition-transform">
          <span className="hidden [details[open]_&]:inline">−</span>
          <span className="[details[open]_&]:hidden">+</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

/** Uma opção de faceta: link que liga, e desliga se já estiver ligada. */
function Opcao({
  faceta,
  ativa,
  href,
}: {
  faceta: Faceta
  ativa: boolean
  href: string
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={ativa ? 'true' : undefined}
        className={`flex min-h-9 items-center justify-between gap-3 rounded-md px-2 -mx-2 text-sm transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          ativa ? 'font-semibold text-brand-strong' : 'text-ink-2'
        }`}
      >
        <span className="truncate">{faceta.rotulo}</span>
        {/*
          A contagem é do que apareceria ao escolher esta opção, com os outros
          filtros valendo — ver `facetasDeCategoria`. Um número que ignora os
          outros filtros promete resultado que o clique não entrega.
        */}
        <span className="shrink-0 font-mono text-xs text-ink-4">{faceta.n}</span>
      </Link>
    </li>
  )
}

export function PainelDeFiltros({
  filtros,
  categorias,
  marcas,
  sabores,
  base = ROTA_DA_BUSCA,
  hrefDaCategoria,
}: {
  filtros: Filtros
  categorias: Faceta[]
  marcas: Faceta[]
  sabores: Faceta[]
  /** Rota a que os links voltam. Em `/categoria/<slug>`, é ela mesma. */
  base?: string
  /**
   * Como o grupo de categoria monta o link, quando a categoria não é um
   * parâmetro e sim a rota. Ausente, ela é tratada como filtro comum.
   */
  hrefDaCategoria?: (valor: string | null) => string
}) {
  const comFiltro = (mudanca: Partial<Filtros>) =>
    serializarFiltros({ ...filtros, ...mudanca }, base)
  const paraCategoria =
    hrefDaCategoria ?? ((valor: string | null) => comFiltro({ categoria: valor }))

  return (
    <aside aria-label="Filtros" className="w-full shrink-0 md:w-64">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-ink-4">Filtros</h2>
        <Link
          href={serializarFiltros({ ...filtros, ...LIMPO }, ROTA_DA_BUSCA)}
          className="rounded-md text-xs font-semibold text-brand-strong hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Limpar
        </Link>
      </div>

      {/*
        A promoção fica fora de acordeão: é uma linha só, e esconder um
        interruptor atrás de um clique custa mais do que o espaço que economiza.
      */}
      <div className="border-b border-line py-4">
        <Link
          href={comFiltro({ soPromocao: !filtros.soPromocao })}
          aria-pressed={filtros.soPromocao}
          className={`flex min-h-9 items-center gap-2 rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            filtros.soPromocao ? 'font-semibold text-brand-strong' : 'text-ink-2'
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex h-4 w-4 items-center justify-center rounded border text-xs ${
              filtros.soPromocao ? 'border-brand bg-brand text-white' : 'border-line-strong'
            }`}
          >
            {filtros.soPromocao ? '✓' : ''}
          </span>
          Só em promoção
        </Link>
      </div>

      {categorias.length > 0 && (
        <Grupo titulo="Categoria" aberto={filtros.categoria !== null || categorias.length <= 6}>
          <ul className="space-y-0.5">
            {categorias.map(c => (
              <Opcao
                key={c.valor}
                faceta={c}
                ativa={filtros.categoria === c.valor}
                href={paraCategoria(filtros.categoria === c.valor ? null : c.valor)}
              />
            ))}
          </ul>
        </Grupo>
      )}

      {marcas.length > 0 && (
        <Grupo titulo="Marca" aberto={filtros.marca !== null || marcas.length <= 6}>
          <ul className="space-y-0.5">
            {marcas.map(m => (
              <Opcao
                key={m.valor}
                faceta={m}
                ativa={filtros.marca === m.valor}
                href={comFiltro({ marca: filtros.marca === m.valor ? null : m.valor })}
              />
            ))}
          </ul>
        </Grupo>
      )}

      {sabores.length > 0 && (
        <Grupo titulo="Sabor" aberto={filtros.sabor !== null || sabores.length <= 6}>
          <ul className="space-y-0.5">
            {sabores.map(s => (
              <Opcao
                key={s.valor}
                faceta={s}
                ativa={filtros.sabor === s.valor}
                href={comFiltro({ sabor: filtros.sabor === s.valor ? null : s.valor })}
              />
            ))}
          </ul>
        </Grupo>
      )}

      {/*
        Os dois tetos vão num `<form method="get">`, e não em slider.

        A maquete desenha slider, que sem JavaScript não consegue submeter nem
        atualizar o rótulo do valor. O campo numérico entrega a mesma decisão —
        "até quanto" — funciona sem script e é o que um leitor de tela sabe
        anunciar. O slider entra quando houver um cliente para ele.

        Os outros filtros viajam em `hidden` porque um `<form method="get">`
        reescreve a query inteira: sem eles, filtrar por preço apagaria a
        categoria escolhida.
      */}
      <form action={base} method="get" className="border-b border-line py-4">
        {filtros.termo && <input type="hidden" name="q" value={filtros.termo} />}
        {/*
          A categoria só viaja em `hidden` quando é parâmetro. Na rota de
          categoria ela está no caminho, e repeti-la aqui duplicaria a URL.
        */}
        {filtros.categoria && base === ROTA_DA_BUSCA && (
          <input type="hidden" name="categoria" value={filtros.categoria} />
        )}
        {filtros.marca && <input type="hidden" name="marca" value={filtros.marca} />}
        {filtros.sabor && <input type="hidden" name="sabor" value={filtros.sabor} />}
        {filtros.soPromocao && <input type="hidden" name="promocao" value="1" />}
        {filtros.ordem !== 'relevancia' && <input type="hidden" name="ordem" value={filtros.ordem} />}

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-ink">Teto de preço</legend>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-3">Preço até (R$)</span>
              <input
                type="number"
                name="preco_max"
                min="1"
                step="1"
                inputMode="numeric"
                defaultValue={filtros.precoMax ?? ''}
                placeholder="sem limite"
                className="min-h-9 w-full rounded-lg border border-line-strong bg-surface px-3 font-mono text-sm text-ink placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-3">R$/dose até</span>
              <input
                type="number"
                name="dose_max"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                defaultValue={filtros.dosePrecoMax ?? ''}
                placeholder="sem limite"
                className="min-h-9 w-full rounded-lg border border-line-strong bg-surface px-3 font-mono text-sm text-ink placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-3 min-h-9 w-full rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Aplicar
        </button>
      </form>

      <div className="pt-4">
        <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.12em] text-ink-4">Ordenar por</h3>
        <ul className="space-y-0.5">
          {ORDENS.map(o => (
            <li key={o.valor}>
              <Link
                href={comFiltro({ ordem: o.valor })}
                aria-current={filtros.ordem === o.valor ? 'true' : undefined}
                className={`flex min-h-9 items-center rounded-md px-2 -mx-2 text-sm transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  filtros.ordem === o.valor ? 'font-semibold text-brand-strong' : 'text-ink-2'
                }`}
              >
                {o.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

/**
 * O estado que "Limpar" restaura: tudo, menos a ordenação.
 *
 * Ordenar não é filtrar — limpar os filtros e devolver a lista para
 * "relevância" tiraria da pessoa uma escolha que ela não pediu para desfazer.
 *
 * Limpar sempre volta para `/produtos`, inclusive na rota de categoria: a
 * categoria é um filtro como os outros do ponto de vista de quem clica em
 * "Limpar", e mantê-la seria limpar pela metade.
 */
const LIMPO: Partial<Filtros> = {
  termo: '',
  categoria: null,
  marca: null,
  sabor: null,
  soPromocao: false,
  precoMax: null,
  dosePrecoMax: null,
}
