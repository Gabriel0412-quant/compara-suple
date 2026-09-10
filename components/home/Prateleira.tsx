import type { ReactNode } from 'react'

import Link from 'next/link'

import { ProductGridCard } from '@/components/category/ProductGridCard'
import { SetasDaPrateleira } from '@/components/home/SetasDaPrateleira'
import type { CategoryProduct } from '@/lib/categories'

/**
 * A prateleira da home, sem saber de onde vem a lista.
 *
 * Nasceu como `PrateleiraDeCategoria` e foi extraída no #211, quando os
 * maiores descontos viraram prateleira também. O que estava em jogo era a
 * rolagem: snap em card inteiro, setas, largura de um quinto, card cortado só
 * abaixo de `xl`. Uma segunda cópia disso divergiria no primeiro ajuste — e a
 * prateleira de categoria já é o lugar onde essas decisões foram tomadas.
 *
 * O que muda entre as duas é só o cabeçalho: a de categoria diz quantos
 * produtos e ofertas a categoria tem, a de descontos diz de onde o desconto
 * sai. Por isso `meta` e `legenda` são separados, e os dois são opcionais.
 */
export function Prateleira({
  id,
  titulo,
  meta,
  legenda,
  link,
  produtos,
}: {
  /** Alvo das setas. Precisa ser único na página. */
  id: string
  titulo: string
  /** Linha curta ao lado do título, em monoespaçada. */
  meta?: ReactNode
  /** Frase que explica o recorte, quando ele não é óbvio pelo título. */
  legenda?: string
  link: { href: string; rotulo: string }
  produtos: CategoryProduct[]
}) {
  const tituloId = `${id}-titulo`

  return (
    <section aria-labelledby={tituloId} className="px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id={tituloId} className="text-2xl font-bold tracking-[-0.03em] text-ink md:text-[28px]">
            {titulo}
          </h2>
          {meta && <p className="font-mono text-sm text-ink-3 sm:text-xs">{meta}</p>}

          <div className="ml-auto flex items-center gap-4">
            <Link
              href={link.href}
              className="flex min-h-11 items-center rounded-md text-sm font-semibold text-brand-strong hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {link.rotulo}
            </Link>
            <SetasDaPrateleira alvo={id} rotulo={titulo} />
          </div>

          {/*
            A legenda ocupa a linha inteira, abaixo do título.

            Ela é prosa, não rótulo: a dos descontos tem quase cem caracteres e
            diz de onde o número sai. Espremida na mesma linha do título, ela
            empurraria o link e as setas para uma terceira linha em telas
            médias. `basis-full` força a quebra antes disso.
          */}
          {legenda && <p className="basis-full text-sm text-ink-3">{legenda}</p>}
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
