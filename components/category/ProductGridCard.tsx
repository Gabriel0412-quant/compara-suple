import Link from 'next/link'
import { formatBRL } from '@/lib/products'
import type { CategoryProduct } from '@/lib/categories'
import { estadoDoCard } from '@/lib/card'

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
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/produto/${product.slug}`}
        className="relative flex aspect-square items-center justify-center bg-surface-muted p-4"
      >
        {product.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.thumbnail}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
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

      <div className="p-5 flex flex-col flex-1">
        {product.brand && (
          <span className="mb-1 font-mono text-sm uppercase tracking-[0.1em] text-ink-3 sm:text-[10px]">
            {product.brand}
          </span>
        )}

        <Link href={`/produto/${product.slug}`} className="block mb-3">
          <h2 className="line-clamp-2 text-base font-semibold text-ink transition-colors hover:text-brand-strong sm:text-sm">
            {product.name}
          </h2>
        </Link>

        <div className="mb-3 flex flex-wrap gap-x-2 font-mono text-sm text-ink-3 sm:text-xs">
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
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold text-ink">
                {formatBRL(product.featuredPrice)}
              </span>
              {precoNormalizado ? (
                <span className="font-mono text-sm font-semibold text-brand-strong sm:text-xs">
                  {precoNormalizado}
                </span>
              ) : (
                <span className="text-sm text-ink-4 sm:text-xs">sem dose ou peso informado</span>
              )}
            </div>
            {hasDiscount && (
              <span className="font-mono text-sm text-ink-4 line-through sm:text-xs">
                {formatBRL(product.featuredOriginalPrice!)}
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
