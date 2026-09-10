import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import { CLASSE_DO_TOM, iniciaisDaMarca } from '@/components/brand/tons'
import { listarMarcas, tomDaMarca, type Marca } from '@/lib/brands'
import { buscaPorMarca } from '@/lib/filtros'
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

/** Barra de proporção, para a contagem virar comparação e não só número. */
function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const pct = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0
  return (
    <span aria-hidden="true" className="block h-1 rounded-full bg-line">
      <span className="block h-1 rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </span>
  )
}

function LinhaDaMarca({ marca, maximo }: { marca: Marca; maximo: number }) {
  return (
    <li>
      <Link
        // Filtro de marca, não busca por texto — mesma troca do #220 feita na
        // faixa da home. O slug é o que `parseFiltros` lê.
        href={buscaPorMarca(marca.slug)}
        className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${CLASSE_DO_TOM[tomDaMarca(marca)]}`}
        >
          {iniciaisDaMarca(marca.nome)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink group-hover:text-brand-strong">
            {marca.nome}
          </span>
          <span className="mt-1 block font-mono text-xs text-ink-3">
            {formatCount(marca.produtos)} {marca.produtos === 1 ? 'produto' : 'produtos'} ·{' '}
            {formatCount(marca.ofertas)} {marca.ofertas === 1 ? 'oferta ativa' : 'ofertas ativas'}
          </span>
          <span className="mt-2 block max-w-48">
            <Barra valor={marca.ofertas} maximo={maximo} />
          </span>
        </span>
      </Link>
    </li>
  )
}

export default async function MarcasPage() {
  const [marcas, { lastUpdated }] = await Promise.all([listarMarcas(), getCatalogStats()])
  const maximo = marcas[0]?.ofertas ?? 0

  return (
    <div className="min-h-screen bg-surface-muted">
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Marcas' }]} />

        <header className="mt-6 mb-8">
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink md:text-4xl">
            Marcas acompanhadas
          </h1>
          <p className="mt-3 max-w-2xl text-ink-2">
            {marcas.length === 0 ? (
              'Nenhuma marca tem oferta ativa no momento.'
            ) : (
              <>
                {formatCount(marcas.length)}{' '}
                {marcas.length === 1 ? 'marca com oferta ativa' : 'marcas com oferta ativa'} no
                comparador, da que tem mais ofertas para a que tem menos. Última coleta{' '}
                {formatUltimaColeta(lastUpdated)}.
              </>
            )}
          </p>
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
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {marcas.map(marca => (
              <LinhaDaMarca key={marca.slug} marca={marca} maximo={maximo} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
