import Link from 'next/link'

import { ConteudoDoCartao } from '@/components/brand/LogoDaMarca'
import { type Marca } from '@/lib/brands'
import { buscaPorMarca } from '@/lib/filtros'
import { formatBRL } from '@/lib/products'
import { formatCount } from '@/lib/stats'

/**
 * O cartão de marca da maquete 1a: o logo em primeiro plano, o resto embaixo.
 *
 * O índice trocou a linha de 48px com monograma por um painel de 168px com o
 * logo de verdade. A razão é a mesma que moveu a faixa da home no #203: quem
 * chega em `/marcas` está procurando uma marca, e marca se reconhece pelo
 * logo, não por duas iniciais numa caixinha colorida.
 *
 * O painel é de tom neutro da casa, e não da cor oficial da marca, como a
 * maquete desenha. Aquelas cores são o `original_price` deste arquivo: a
 * maquete diz em texto que os painéis coloridos são placeholders do arquivo
 * oficial, e o arquivo oficial é o que entra aqui. Pintar o painel com o
 * vermelho da Max Titanium quando o logo dela já está em cima seria vestir um
 * cartão nosso com identidade de terceiro — exatamente o que o #151 recusou e
 * o que `lib/tokens.test.ts` impede.
 */

/** Barra de proporção, para a contagem virar comparação e não só número. */
function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  /*
    Mínimo de 2%, para a marca com menos ofertas continuar desenhando alguma
    coisa. A Dark Lab tem 3 ofertas contra as 649 da Integralmédica: a barra
    honesta seria 0,46%, que arredonda para zero e some.
  */
  const pct = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0
  return (
    <span aria-hidden="true" className="block h-1.5 rounded-full bg-line">
      <span className="block h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </span>
  )
}

export function CartaoDeMarca({
  marca,
  maximo,
  destaque,
}: {
  marca: Marca
  /** Ofertas da marca mais coberta, para a barra ter escala comum. */
  maximo: number
  /** O selo derivado, ou `null` quando o dado não sustenta nenhum. */
  destaque: string | null
}) {
  return (
    <li>
      <Link
        // Filtro de marca, não busca por texto — mesma troca do #220 feita na
        // faixa da home. O slug é o que `parseFiltros` lê.
        href={buscaPorMarca(marca.slug)}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {/*
          Painel claro, e não escuro, pelo motivo já medido no #203: três das
          cinco logos que temos são pretas, e num painel escuro elas somem.
        */}
        <div className="flex h-[168px] shrink-0 items-center justify-center overflow-hidden bg-surface-muted px-6">
          <ConteudoDoCartao marca={marca} tamanho="painel" />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-baseline justify-between gap-3">
            {/*
              Cabeçalho de verdade, e não um `span` em negrito.

              São sete marcas sob o `h1` da página, e quem navega por títulos
              passava por elas como se não existissem. O teste do #153 lia o
              nome por posição no DOM — `a > span > span` — e quebrou assim que
              a estrutura mudou; com papel, ele passa a perguntar pelo que a
              coisa é em vez de onde ela está.
            */}
            <h2 className="min-w-0 truncate text-lg font-semibold tracking-[-0.02em] text-ink group-hover:text-brand-strong">
              {marca.nome}
            </h2>
            {/*
              Sem selo, nada ocupa o lugar. A maquete tem um rótulo em todos os
              oito cartões porque é uma maquete; aqui três dos que ela desenha
              não têm origem no banco, e `destaqueDaMarca` devolve `null` no
              lugar de inventar um.
            */}
            {destaque && (
              <span className="shrink-0 font-mono text-sm uppercase tracking-[0.08em] text-ink-3 sm:text-xs">
                {destaque}
              </span>
            )}
          </div>

          <p className="mt-1.5 font-mono text-sm text-ink-3 sm:text-xs">
            {formatCount(marca.produtos)} {marca.produtos === 1 ? 'produto' : 'produtos'} ·{' '}
            {formatCount(marca.ofertas)} {marca.ofertas === 1 ? 'oferta ativa' : 'ofertas ativas'}
          </p>

          <div className="mt-3">
            <Barra valor={marca.ofertas} maximo={maximo} />
          </div>

          <div className="mt-4 flex items-center gap-3">
            {/*
              Parece botão e não é: o cartão inteiro já é o link, e um `<a>`
              dentro de outro `<a>` é HTML inválido. Assim há uma parada de
              tabulação por marca em vez de duas para o mesmo destino.
            */}
            <span className="flex-1 rounded-xl bg-surface-dark py-3 text-center text-sm font-semibold text-ink-on-dark transition-colors group-hover:bg-brand">
              Ver ofertas
            </span>
            {marca.menorPreco !== null && (
              <span className="shrink-0 rounded-xl border border-line-strong px-3 py-3 font-mono text-sm text-ink-3 sm:text-xs">
                {/*
                  O "+" da maquete quer dizer "a partir de", e sozinho não diz
                  isso a quem ouve a página. O símbolo fica para quem vê e a
                  palavra para quem lê em voz alta — em vez de trocar os dois
                  pelo texto por extenso, que não cabe na pastilha.
                */}
                <span aria-hidden="true">{formatBRL(marca.menorPreco)} +</span>
                <span className="sr-only">a partir de {formatBRL(marca.menorPreco)}</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}
