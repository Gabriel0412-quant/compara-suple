import { avisoDeRecencia, classificarRecencia } from '@/lib/recencia'
import { formatUpdatedAt } from '@/lib/stats'

/**
 * Resumo de metodologia, igual nas três superfícies de decisão.
 *
 * Cada número que a interface mostra tem uma definição e uma fonte; ficavam em
 * comentários de código, onde o visitante não lê. O que ele via era "menor
 * preço" e "destaque" lado a lado, sem nada dizendo que são coisas diferentes
 * — e é justamente essa diferença que faz o comparador ser útil ou enganoso.
 *
 * A página completa de metodologia é do EP12; enquanto não existe, este resumo
 * é o que temos, e é honesto sobre o próprio limite.
 */
export function ComoComparamos({
  ultimaColeta,
  className = '',
}: {
  ultimaColeta: Date | null
  className?: string
}) {
  const recencia = classificarRecencia(ultimaColeta)
  const aviso = avisoDeRecencia(recencia)

  return (
    <section className={`text-xs text-gray-600 ${className}`} aria-labelledby="como-comparamos">
      {aviso && (
        <p
          aria-live="polite"
          className="mb-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5"
        >
          {aviso}
        </p>
      )}

      <details className="bg-white border border-gray-100 rounded-xl px-4 py-3">
        <summary
          id="como-comparamos"
          className="font-semibold text-gray-800 cursor-pointer marker:text-gray-400"
        >
          Como comparamos
        </summary>

        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            Coletamos os preços do Mercado Livre uma vez por dia e guardamos o que
            a API devolve. A última coleta foi{' '}
            <strong>{formatUpdatedAt(ultimaColeta)}</strong>. Não visitamos as
            lojas nem conferimos os valores à mão.
          </p>

          <dl className="space-y-1.5">
            <div>
              <dt className="inline font-semibold text-gray-800">Menor preço: </dt>
              <dd className="inline">
                o menor valor entre as ofertas disponíveis na última coleta.
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold text-gray-800">Destaque: </dt>
              <dd className="inline">
                a oferta que o próprio Mercado Livre promove para o produto. Nem
                sempre é a mais barata, e por isso aparece separada do menor preço.
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold text-gray-800">R$/dose e R$/kg: </dt>
              <dd className="inline">
                preço dividido pelas porções ou pelo peso informados no anúncio.
                Quando o anúncio não informa, dizemos que não sabemos, em vez de
                estimar.
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold text-gray-800">Número de ofertas: </dt>
              <dd className="inline">
                quantos anúncios do mesmo produto estavam ativos na última coleta.
              </dd>
            </div>
          </dl>

          <p>
            Ofertas que saem do ar deixam de aparecer na coleta seguinte. Frete
            não entra na conta: depende do CEP e não é somado a lugar nenhum.
          </p>

          <p>
            Ganhamos comissão quando você compra por um link daqui, sem custo
            extra para você. Isso não altera a ordem: o destaque é sempre por
            critério nomeado — menor preço, menor R$/dose, menor R$/kg.
          </p>

          <p className="text-gray-500">
            Comparamos preço. Não avaliamos eficácia, segurança nem adequação
            nutricional, e nada aqui substitui orientação de um profissional de
            saúde.
          </p>
        </div>
      </details>
    </section>
  )
}
