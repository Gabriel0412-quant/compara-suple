import { formatBRL, type Offer } from '@/lib/products'
import { formatUltimaColeta } from '@/lib/stats'
import { textoDaEconomia, vendedorDaOferta, type EstadoDoProduto } from '@/lib/produto'

/**
 * A caixa de preço da maquete 1c — a peça que define aquela variante.
 *
 * Nas maquetes 1a e 1b o preço e o botão ficam no topo e somem quando a pessoa
 * rola até as ofertas e o histórico. Em 1c a coluna direita acompanha a
 * rolagem, e a razão de ser dessa escolha é esta caixa: o preço que a página
 * está apresentando, e a saída para a loja, nunca saem da tela.
 *
 * O que ela mostra é a oferta **mais barata**, não a que o Mercado Livre
 * promove. As duas continuam nomeadas e separadas — quando diferem, a
 * promovida aparece logo abaixo, com o próprio preço e o próprio link. É a
 * regra do CLAUDE.md ("menor preço ≠ destaque") aplicada com a hierarquia que
 * a maquete pede: quem chegou nesta página já escolheu o produto.
 */
export function CaixaDePreco({ estado }: { estado: EstadoDoProduto }) {
  const { menor, destaque, temDesconto, percentualDesconto, precoOriginal, economia } = estado
  const economiaTxt = textoDaEconomia(economia)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border-2 border-ink bg-surface-warm p-6">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">Menor preço</p>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-4xl font-semibold tracking-[-0.03em] text-ink">
            {formatBRL(menor.price)}
          </span>
          {temDesconto && (
            <>
              <span className="rounded-md bg-brand px-2 py-1 font-mono text-xs font-semibold text-white">
                −{percentualDesconto}%
              </span>
              <span className="font-mono text-sm text-ink-4 line-through">
                {formatBRL(precoOriginal!)}
              </span>
            </>
          )}
        </div>

        <p className="mt-2 font-mono text-sm text-ink-3">
          {vendedorDaOferta(menor)} · menor entre {estado.totalOfertas}{' '}
          {estado.totalOfertas === 1 ? 'oferta' : 'ofertas'}
        </p>

        {/*
          A economia em reais, o mesmo número que o card das listagens mostra
          desde o #227. Sai de `original_price` do próprio anúncio, com o preço
          anterior riscado ao lado — é a distinção que `lib/claims.ts` registra
          entre desconto por oferta e economia agregada, que não temos.
        */}
        {economiaTxt && <p className="mt-1 font-mono text-sm text-ink-3">{economiaTxt}</p>}

        {/*
          O CTA nomeia o destino. "Comprar agora" sugeria que o checkout
          acontece aqui; ele acontece no Mercado Livre, e esta página não tem
          checkout nenhum. O rótulo da maquete é "Ir à loja →", que os cards
          usam — aqui ele nomeia o marketplace porque é a última tela antes da
          saída, e é o que o #133 pede enquanto `store` não existe.
        */}
        <a
          href={`/go/${menor.id}?de=produto&por=menor_preco`}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="relative mt-5 flex min-h-12 items-center justify-center rounded-xl bg-ink px-4 text-center text-base font-semibold text-ink-on-dark transition-colors hover:bg-surface-darker focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Ver oferta no Mercado Livre
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        <p aria-hidden="true" className="mt-1.5 text-center text-sm text-ink-3">
          abre em nova aba
        </p>

        <p className="mt-3 font-mono text-xs text-ink-3">
          Coletado {formatUltimaColeta(estado.ultimaColeta)}
        </p>
      </div>

      {destaque && <OfertaPromovida oferta={destaque} />}

      {/*
        A divulgação de comissão fica junto do botão, não no rodapé.

        O rodapé já a repete em toda página, mas esta é a superfície onde o
        clique de saída acontece — e foi por isso que o #239 pôde tirá-la das
        listagens: ela continua onde importa.
      */}
      <p className="px-1 text-sm text-ink-3">
        Ganhamos comissão se você comprar por este link, sem custo extra para você.
      </p>
    </div>
  )
}

/**
 * A oferta que o Mercado Livre promove, quando não é a mais barata.
 *
 * Existe porque o ML escolhe o que colocar na frente por critério próprio —
 * frete, CEP, estoque, reputação — e em 7 de 13 variantes medidas essa escolha
 * era mais cara. Esconder isso faria a nossa página discordar em silêncio da
 * página para onde ela manda; nomear as duas é o que torna a diferença útil.
 */
function OfertaPromovida({ oferta }: { oferta: Offer }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
        O Mercado Livre destaca outra
      </p>
      <p className="mt-2 font-mono text-xl font-semibold text-ink">{formatBRL(oferta.price)}</p>
      <p className="mt-1 font-mono text-sm text-ink-3">{vendedorDaOferta(oferta)}</p>
      <a
        href={`/go/${oferta.id}?de=produto&por=destaque`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Ver a oferta em destaque
      </a>
    </div>
  )
}
