import Link from 'next/link'

import { ControleDeTeto } from '@/components/busca/ControleDeTeto'
import {
  ROTA_DA_BUSCA,
  SEM_FILTRO,
  alternar,
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

/**
 * Uma opção de faceta: caixa marcável que liga, e desliga se já estiver ligada.
 *
 * A caixa é o que anuncia a multisseleção. Sem ela, uma lista de links parece
 * escolha única — e a pessoa nunca descobre que pode marcar Growth e Max
 * Titanium ao mesmo tempo.
 *
 * `aria-checked` num `<a role="checkbox">` é o que dá a mesma informação a quem
 * navega por leitor de tela. Continua sendo um link porque o estado mora na
 * URL: um `<input type="checkbox">` de verdade exigiria formulário e submissão
 * a cada clique, ou JavaScript.
 */
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
          prefetch={false}
        href={href}
        role="checkbox"
        aria-checked={ativa}
        className={`flex min-h-9 items-center justify-between gap-3 rounded-md px-2 -mx-2 text-sm transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          ativa ? 'font-semibold text-brand-strong' : 'text-ink-2'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${
              ativa ? 'border-brand bg-brand text-white' : 'border-line-strong'
            }`}
          >
            {ativa ? '✓' : ''}
          </span>
          <span className="truncate">{faceta.rotulo}</span>
        </span>
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
  tetos,
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
  hrefDaCategoria?: (valor: string) => string
  /** Extremos do catálogo, para os tetos terem escala real. */
  tetos: { preco: number; dose: number }
}) {
  const comFiltro = (mudanca: Partial<Filtros>) =>
    serializarFiltros({ ...filtros, ...mudanca }, base)
  const paraCategoria =
    hrefDaCategoria ??
    ((valor: string) => comFiltro({ categorias: alternar(filtros.categorias, valor) }))

  return (
    <aside aria-label="Filtros" className="w-full shrink-0 md:w-64">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-ink-4">Filtros</h2>
        <Link
          prefetch={false}
          href={serializarFiltros({ ...filtros, ...SEM_FILTRO }, ROTA_DA_BUSCA)}
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
          prefetch={false}
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
        <Grupo titulo="Categoria" aberto={filtros.categorias.length > 0 || categorias.length <= 6}>
          {/*
            A lista tem nome próprio: dentro do painel há três listas de caixas
            marcáveis, e sem rótulo elas são indistinguíveis para quem navega
            por leitor de tela — e para quem escreve teste.
          */}
          <ul aria-label="Categoria" className="space-y-0.5">
            {categorias.map(c => (
              <Opcao
                key={c.valor}
                faceta={c}
                ativa={filtros.categorias.includes(c.valor)}
                href={paraCategoria(c.valor)}
              />
            ))}
          </ul>
        </Grupo>
      )}

      {marcas.length > 0 && (
        <Grupo titulo="Marca" aberto={filtros.marcas.length > 0 || marcas.length <= 6}>
          <ul aria-label="Marca" className="space-y-0.5">
            {marcas.map(m => (
              <Opcao
                key={m.valor}
                faceta={m}
                ativa={filtros.marcas.includes(m.valor)}
                href={comFiltro({ marcas: alternar(filtros.marcas, m.valor) })}
              />
            ))}
          </ul>
        </Grupo>
      )}

      {sabores.length > 0 && (
        <Grupo titulo="Sabor" aberto={filtros.sabores.length > 0 || sabores.length <= 6}>
          <ul aria-label="Sabor" className="space-y-0.5">
            {sabores.map(s => (
              <Opcao
                key={s.valor}
                faceta={s}
                ativa={filtros.sabores.includes(s.valor)}
                href={comFiltro({ sabores: alternar(filtros.sabores, s.valor) })}
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
        {base === ROTA_DA_BUSCA &&
          filtros.categorias.map(c => (
            <input key={c} type="hidden" name="categoria" value={c} />
          ))}
        {filtros.marcas.map(m => (
          <input key={m} type="hidden" name="marca" value={m} />
        ))}
        {filtros.sabores.map(sabor => (
          <input key={sabor} type="hidden" name="sabor" value={sabor} />
        ))}
        {filtros.soPromocao && <input type="hidden" name="promocao" value="1" />}
        {filtros.ordem !== 'relevancia' && <input type="hidden" name="ordem" value={filtros.ordem} />}

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-ink">Teto de preço</legend>
          <div className="space-y-4">
            <ControleDeTeto
              id="teto-preco"
              name="preco_max"
              rotulo="Preço até"
              min={1}
              max={tetos.preco}
              step={1}
              inicial={filtros.precoMax}
              formato="reais"
            />
            <ControleDeTeto
              id="teto-dose"
              name="dose_max"
              rotulo="R$/dose até"
              min={0.05}
              max={tetos.dose}
              step={0.05}
              inicial={filtros.dosePrecoMax}
              formato="dose"
            />
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-3 min-h-9 w-full rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Aplicar
        </button>
      </form>

    </aside>
  )
}
