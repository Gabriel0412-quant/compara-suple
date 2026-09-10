import Link from 'next/link'
import { formatBRL } from '@/lib/products'
import type { CategoryProduct } from '@/lib/categories'
import { estadoDoCard } from '@/lib/card'

/**
 * Altura da caixa da imagem: 378px.
 *
 * O número sai de uma proporção, não de um chute. O bloco de informação mede
 * 252px e é conteúdo, não folga — marca, nome em duas linhas, peso e doses,
 * preço, R$/dose, "Destaque entre N ofertas", a linha reservada do menor preço
 * e os dois botões. Para a imagem valer 60% do card, ela precisa ser
 * `252 / 0.4 × 0.6 = 378`, e o card fecha em 630px.
 *
 * Altura fixa, e não `aspect-*`: o card mede 245px na prateleira da home e
 * ~400px no grid de `/categoria`. Amarrada à largura, a proporção mudaria de
 * tela para tela; amarrada à altura, os 60% valem nas quatro superfícies,
 * porque o bloco de informação tem a mesma altura em todas.
 *
 * Escrita por extenso e não interpolada: classe do Tailwind montada em tempo
 * de execução não é gerada e sai sem altura, em silêncio.
 */
const ALTURA_DA_IMAGEM = 'h-[378px]'

export function ProductGridCard({
  product,
  superficie = 'lista',
}: {
  product: CategoryProduct
  /** De onde o card está sendo exibido. Vai para a rota de saída. */
  superficie?: 'home' | 'lista' | 'comparador' | 'produto'
}) {
  const {
    temDesconto: hasDiscount,
    percentualDesconto: discountPct,
    precoNormalizado,
    temMaisBarata,
  } = estadoDoCard(product)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
      {/*
        Fundo branco, não creme.

        Quase toda foto de produto do ML já vem recortada em branco, então o
        creme aparecia como uma moldura em volta de um quadrado branco em vez
        de fundo. Em branco, a foto encosta no card sem costura visível.
      */}
      <Link
        href={`/produto/${product.slug}`}
        className={`relative flex ${ALTURA_DA_IMAGEM} shrink-0 items-center justify-center overflow-hidden bg-surface`}
      >
        {product.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.thumbnail}
            alt={product.name}
            /*
              Sem respiro interno: a caixa já é o respiro. `object-contain`
              mantém a proporção da foto e centraliza, então embalagem alta e
              embalagem larga convivem na mesma prateleira sem distorcer.

              As miniaturas do ML medem de 688 a 829px de largura, então a
              caixa pode crescer sem borrar — foi medido antes de crescer.
            */
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-sm text-ink-4">sem imagem</span>
        )}
        {hasDiscount && (
          <span className="absolute right-3 top-3 rounded-full bg-surface-warm px-2 py-0.5 font-mono text-sm font-semibold text-brand-ink sm:text-xs">
            -{discountPct}%
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-4 py-3">
        {product.brand && (
          <span className="mb-0.5 font-mono text-sm uppercase tracking-[0.1em] text-ink-3 sm:text-[10px]">
            {product.brand}
          </span>
        )}

        <Link href={`/produto/${product.slug}`} className="mb-2 block">
          <h2 className="line-clamp-2 min-h-10 text-base font-semibold text-ink transition-colors hover:text-brand-strong sm:min-h-9 sm:text-sm">
            {product.name}
          </h2>
        </Link>

        <div className="mb-2 flex flex-wrap gap-x-2 font-mono text-sm text-ink-3 sm:text-xs">
          {product.sizeGrams && (
            <span>
              {product.sizeGrams >= 1000
                ? `${product.sizeGrams / 1000} kg`
                : `${product.sizeGrams} g`}
            </span>
          )}
          {product.servings && <span>· {product.servings} doses</span>}
        </div>

        <div className="mt-auto">
          <div className="mb-2">
            {/*
              Preço e preço riscado na mesma linha, como na maquete 1b.

              O riscado ficava numa linha própria, que só existe em card com
              desconto — e era isso que fazia o preço de um card sentar 20px
              acima do vizinho na mesma prateleira. Num site de comparação,
              preço desalinhado entre cards obriga a procurar o número em vez
              de correr o olho pela linha.

              Assim a estrutura é sempre duas linhas: preço (mais riscado
              quando houver) e preço normalizado.
            */}
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xl font-semibold text-ink">
                {formatBRL(product.featuredPrice)}
              </span>
              {hasDiscount && (
                <span className="font-mono text-sm text-ink-4 line-through sm:text-xs">
                  {formatBRL(product.featuredOriginalPrice!)}
                </span>
              )}
            </div>
            {precoNormalizado ? (
              <span className="block font-mono text-sm font-semibold text-brand-strong sm:text-xs">
                {precoNormalizado}
              </span>
            ) : (
              <span className="block text-sm text-ink-4 sm:text-xs">
                sem dose ou peso informado
              </span>
            )}
            <p className="mt-1 text-sm text-ink-4 sm:text-[11px]">
              Destaque entre {product.offerCount}{' '}
              {product.offerCount === 1 ? 'oferta' : 'ofertas'}
            </p>

            {/*
              O preço acima é o da oferta destacada pelo Mercado Livre, que nem
              sempre é a mais barata. Quando houver uma menor, ela aparece aqui
              com link próprio — em vez de a legenda chamar o destaque de
              "menor preço", que era falso em 7 de 13 variantes.
            */}
            {/*
              Espaço reservado, e a reserva faz trabalho: esta linha existe em
              uns cards e não em outros, e sem ela o preço de um card senta
              24px acima do vizinho na mesma prateleira. Num comparador, preço
              desalinhado obriga a procurar o número em vez de correr o olho
              pela linha — custa mais que os 24px de altura.

              Medi as duas versões: sem reserva o card tem 350px e os preços
              desencontram; com reserva tem 360px e alinham. Os 10px voltaram
              da altura da imagem.
            */}
            <div className="min-h-6">
            {temMaisBarata && (
              <a
                href={`/go/${product.lowestOfferId}?de=${superficie}&por=menor_preco`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong hover:underline sm:min-h-0 sm:text-[11px]"
              >
                Menor preço: {formatBRL(product.lowestPrice!)} →
              </a>
            )}
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/produto/${product.slug}`}
              className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line-strong py-2.5 text-center text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong"
            >
              Comparar
            </Link>
            {/*
              Sem oferta destacada não há para onde mandar o clique. O botão
              apontava para "#": parecia comprável e não levava a lugar nenhum.

              O rótulo era "Comprar →", que sugere que o checkout acontece
              aqui — a mesma coisa que o #56 tirou da página de produto, onde
              o CTA passou a ser "Ver oferta no Mercado Livre". Escapou da
              auditoria porque `lib/claims.ts` proíbe "comprar agora", e esta
              variante não casava o padrão. Passa a ser "Ir à loja", que é
              como a maquete 1b rotula o mesmo botão.
            */}
            {product.featuredOfferId ? (
              <a
                href={`/go/${product.featuredOfferId}?de=${superficie}&por=destaque`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                Ir à loja →
              </a>
            ) : (
              <span className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-surface-muted py-2.5 text-center text-sm font-semibold text-ink-4">
                Sem oferta ativa
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
