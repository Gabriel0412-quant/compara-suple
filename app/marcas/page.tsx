import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import { CartaoDeMarca } from '@/components/brand/CartaoDeMarca'
import { OrdenarMarcas } from '@/components/brand/OrdenarMarcas'
import {
  descricaoDaOrdem,
  destaqueDaMarca,
  listarMarcas,
  ordemDeMarcaValida,
  ordenarMarcas,
  ordenarMarcasPor,
} from '@/lib/brands'
import { formatCount, formatUltimaColeta, getCatalogStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Marcas acompanhadas · Preço Suplemento',
  description:
    'Todas as marcas de suplemento com oferta ativa no comparador, com quantos produtos e quantas ofertas cada uma tem.',
  /*
    `noindex, follow` enquanto a página é só uma lista.

    Mesma regra do #113 para as páginas de seleção: ela não tem conteúdo
    próprio além do que já existe em `/produtos`, então indexá-la produziria
    uma página concorrendo com o catálogo pelas mesmas palavras. O `follow`
    fica ligado porque os links daqui levam a páginas que devem ser
    rastreadas. Quando houver texto próprio por marca, isto muda junto.
  */
  robots: { index: false, follow: true },
  alternates: { canonical: '/marcas' },
}

export default async function MarcasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [marcas, { lastUpdated }, params] = await Promise.all([
    listarMarcas(),
    getCatalogStats(),
    searchParams,
  ])

  const ordem = ordemDeMarcaValida(params.ordem)
  const naTela = ordenarMarcasPor(marcas, ordem)

  /*
    A escala da barra é sempre a da marca mais coberta, e não a da primeira da
    lista. Ordenado por nome, a primeira pode ser a Dark Lab, com 3 ofertas —
    e todas as barras encostariam na direita, o que diria o contrário do que o
    dado diz.
  */
  const maximo = ordenarMarcas(marcas)[0]?.ofertas ?? 0

  return (
    <div className="min-h-screen bg-surface-muted">
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-10">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Marcas' }]} />

        <header className="mt-6 mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.035em] text-ink md:text-[46px] md:leading-[1.02]">
              Marcas acompanhadas
            </h1>
            <p className="mt-3 max-w-2xl text-ink-2">
              {marcas.length === 0 ? (
                'Nenhuma marca tem oferta ativa no momento.'
              ) : (
                <>
                  {formatCount(marcas.length)}{' '}
                  {marcas.length === 1 ? 'marca com oferta ativa' : 'marcas com oferta ativa'} no
                  comparador, {descricaoDaOrdem(ordem)}. Última coleta{' '}
                  {formatUltimaColeta(lastUpdated)}.
                </>
              )}
            </p>
          </div>

          {/* Sem marca não há o que ordenar, e o controle some junto com a lista. */}
          {marcas.length > 0 && <OrdenarMarcas ordem={ordem} />}
        </header>

        {marcas.length === 0 ? (
          /*
            Estado sem resultado, e sem promessa.

            Só acontece se o catálogo inteiro ficar sem oferta ativa — o mesmo
            cenário que deixaria a faixa da home vazia. Diz o que houve e
            oferece um destino que funciona, em vez de "em breve".
          */
          <p className="rounded-xl border border-line bg-surface p-6 text-ink-3">
            Isso acontece quando nenhuma oferta do catálogo está disponível na última coleta.{' '}
            <Link href="/produtos" className="font-medium text-brand-strong underline">
              Ver o catálogo
            </Link>
            .
          </p>
        ) : (
          /*
            Três colunas em tela larga, como a maquete. Duas no tablet e uma no
            celular: o painel de logo tem 168px de altura fixa, e em três
            colunas de 375px o logo sairia menor que o da faixa da home, que é
            o oposto do que esta página existe para fazer.
          */
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {naTela.map(marca => (
              <CartaoDeMarca
                key={marca.slug}
                marca={marca}
                maximo={maximo}
                // O selo é calculado sobre a lista inteira, não sobre a ordem
                // da tela: quem lidera em ofertas continua liderando quando a
                // página está ordenada por nome.
                destaque={destaqueDaMarca(marca, marcas)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
