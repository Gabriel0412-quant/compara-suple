import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import type { Category } from '@/lib/categories'

/**
 * Produto que existe no catálogo e não tem nenhuma oferta ativa.
 *
 * `notFound()` seria mentira: a página existe, tem nome e marca, e deve
 * continuar indexável — o produto pode voltar a ser vendido amanhã. O que não
 * pode é fingir comércio: sem preço, sem economia e sem botão apontando para
 * um anúncio que saiu do ar.
 *
 * O último preço conhecido também não aparece, e essa é a decisão que custa:
 * ele existe no banco e seria fácil mostrar. Só que ele não descreve mais o
 * que a pessoa pagaria, e um número desses ao lado do nome do produto é lido
 * como preço atual por quem não leu a legenda.
 */
export function ProdutoSemOfertas({
  nome,
  marca,
  categoria,
}: {
  nome: string
  marca: string | null
  categoria: Category | null
}) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            ...(categoria ? [{ label: categoria.name, href: `/categoria/${categoria.slug}` }] : []),
            { label: nome },
          ]}
        />

        <div className="mt-6 max-w-2xl">
          {marca && (
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-brand-ink">{marca}</p>
          )}
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.03em] text-ink md:text-4xl">
            {nome}
          </h1>

          <div className="mt-6 rounded-2xl border border-line bg-surface-muted p-6">
            <p className="text-lg font-semibold text-ink">Sem ofertas disponíveis no momento</p>
            <p className="mt-2 text-ink-2">
              Nenhum anúncio deste produto estava ativo na última coleta. Não exibimos o último
              preço conhecido porque ele não representa mais o que você pagaria hoje.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {categoria && (
                <Link
                  href={`/categoria/${categoria.slug}`}
                  className="flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
                >
                  Ver {categoria.name} com oferta ativa
                </Link>
              )}
              <Link
                href="/produtos"
                className="flex min-h-11 items-center rounded-xl border border-line-strong px-5 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong"
              >
                Buscar no catálogo
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
