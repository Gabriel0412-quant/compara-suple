import Link from 'next/link'
import { formatBRL } from '@/lib/products'
import type { CategoryProduct } from '@/lib/categories'

export function ProductGridCard({ product }: { product: CategoryProduct }) {
  const hasDiscount =
    product.featuredOriginalPrice !== null &&
    product.featuredOriginalPrice > product.featuredPrice
  const discountPct = hasDiscount
    ? Math.round((1 - product.featuredPrice / product.featuredOriginalPrice!) * 100)
    : 0

  /*
    Preço normalizado. Comparar suplemento por preço absoluto engana quando as
    embalagens têm tamanhos diferentes, então o card sempre mostra a unidade
    que der: dose quando o produto informa porções, quilo quando informa peso.
    Sem nenhum dos dois, dizemos isso em vez de omitir em silêncio — a ausência
    do número é informação, e some sem explicação parece bug.
  */
  const precoNormalizado =
    product.featuredPerDose !== null
      ? `${formatBRL(product.featuredPerDose)}/dose`
      : product.sizeGrams && product.sizeGrams > 0
        ? `${formatBRL((product.featuredPrice / product.sizeGrams) * 1000)}/kg`
        : null

  // Só vale mostrar a linha de menor preço quando ela contradiz o destaque.
  const temMaisBarata =
    product.lowestPrice !== null &&
    product.lowestOfferId !== null &&
    product.lowestPrice < product.featuredPrice

  return (
    <article className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <Link
        href={`/produto/${product.slug}`}
        className="block aspect-square bg-gray-50 flex items-center justify-center p-4 relative"
      >
        {product.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.thumbnail}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-gray-300 text-sm">sem imagem</span>
        )}
        {hasDiscount && (
          <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
            -{discountPct}%
          </span>
        )}
      </Link>

      <div className="p-5 flex flex-col flex-1">
        {product.brand && (
          <span className="text-xs font-semibold text-green-600 mb-1 uppercase tracking-wide">
            {product.brand}
          </span>
        )}

        <Link href={`/produto/${product.slug}`} className="block mb-3">
          <h2 className="font-semibold text-sm text-gray-800 line-clamp-2 hover:text-green-600 transition-colors">
            {product.name}
          </h2>
        </Link>

        <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-x-2">
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
              <span className="text-2xl font-bold text-green-600">
                {formatBRL(product.featuredPrice)}
              </span>
              {precoNormalizado ? (
                <span className="text-xs font-semibold text-green-700">
                  {precoNormalizado}
                </span>
              ) : (
                <span className="text-xs text-gray-400">sem dose ou peso informado</span>
              )}
            </div>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">
                {formatBRL(product.featuredOriginalPrice!)}
              </span>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
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
                href={`/go/${product.lowestOfferId}`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-block text-[11px] font-semibold text-green-700 mt-1 hover:underline"
              >
                Menor preço: {formatBRL(product.lowestPrice!)} →
              </a>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/produto/${product.slug}`}
              className="flex-1 text-center py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:border-green-600 hover:text-green-600 transition-colors"
            >
              Comparar
            </Link>
            {/*
              Sem oferta destacada não há para onde mandar o clique. O botão
              apontava para "#": parecia comprável e não levava a lugar nenhum.
            */}
            {product.featuredOfferId ? (
              <a
                href={`/go/${product.featuredOfferId}`}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex-1 text-center py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Comprar →
              </a>
            ) : (
              <span className="flex-1 text-center py-2.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-semibold">
                Sem oferta ativa
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
