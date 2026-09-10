import Link from 'next/link'

import { ProductGridCard } from '@/components/category/ProductGridCard'
import { SetasDaPrateleira } from '@/components/home/SetasDaPrateleira'
import { formatCount } from '@/lib/stats'
import type { Prateleira } from '@/lib/shelves'

/**
 * Um bloco por categoria na home, conforme a maquete 1b.
 *
 * Os cards são o `ProductGridCard` de sempre, sem variante nova. Ele já
 * carrega decisões que custaram caro e que não podem divergir por superfície:
 * preço por dose ou por quilo com "sem dose ou peso informado" quando não há
 * nenhum dos dois; selo de desconto só quando `original_price` sustenta;
 * linha de menor preço só quando ela contradiz o destaque; e nada de botão
 * apontando para lugar nenhum quando falta oferta.
 */

export function PrateleiraDeCategoria({ prateleira }: { prateleira: Prateleira }) {
  const { categoria, produtos, totalProdutos, totalOfertas } = prateleira
  const id = `prateleira-${categoria.slug}`
  const tituloId = `${id}-titulo`

  return (
    <section aria-labelledby={tituloId} className="px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id={tituloId} className="text-2xl font-bold tracking-[-0.03em] text-ink md:text-[28px]">
            {categoria.name}
          </h2>
          {/*
            Os totais são da categoria inteira, não dos quatro exibidos — é o
            que o read model separa em `totalProdutos` e `totalOfertas`. Dizer
            "4 produtos" quando a categoria tem nove seria contar a vitrine.
          */}
          <p className="font-mono text-sm text-ink-3 sm:text-xs">
            {formatCount(totalProdutos)} {totalProdutos === 1 ? 'produto' : 'produtos'} ·{' '}
            {formatCount(totalOfertas)} {totalOfertas === 1 ? 'oferta' : 'ofertas'}
          </p>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href={`/categoria/${categoria.slug}`}
              className="flex min-h-11 items-center rounded-md text-sm font-semibold text-brand-strong hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Ver todos
            </Link>
            <SetasDaPrateleira alvo={id} rotulo={categoria.name} />
          </div>
        </div>

        {/*
          `flex` e não `grid` de colunas fixas: com menos de quatro produtos,
          um grid de quatro colunas deixaria buracos do tamanho de um card. Em
          flex a faixa simplesmente termina, sem lacuna e sem cartão fictício.

          `snap-x` com `snap-start` faz a rolagem parar em card inteiro, em vez
          de deixar meio produto cortado na borda.
        */}
        <ul
          id={id}
          className="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-4 pb-2 md:mx-0 md:px-0"
        >
          {produtos.map(produto => (
            /*
              Largura fixa até `xl`, e a partir dali exatamente cinco.

              A prateleira mede 1280px em tela larga (`max-w-7xl`), e cinco
              cards de 268 com quatro vãos de 14 dão 1396 — o quinto entrava
              pela metade. `calc((100% - 3.5rem) / 5)` divide a largura real
              da lista pelos cinco, descontando os quatro vãos, então o corte
              acontece no lugar certo em qualquer tela dessa faixa.

              Abaixo de `xl` continua fixo de propósito: dividir por cinco num
              container de 944px daria cards de 178px. Ali o card cortado na
              borda é o que avisa que a lista rola.
            */
            <li
              key={produto.id}
              className="w-[248px] shrink-0 snap-start sm:w-[268px] xl:w-[calc((100%_-_3.5rem)/5)]"
            >
              <ProductGridCard product={produto} superficie="home" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
