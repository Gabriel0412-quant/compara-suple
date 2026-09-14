import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.12em] text-brand-ink">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink md:text-4xl">
          Produto não encontrado
        </h1>
        <p className="mt-3 text-ink-2">
          O link pode estar quebrado ou o produto saiu do nosso catálogo.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/produtos"
            className="flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Buscar no catálogo
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-5 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong"
          >
            Voltar para a home
          </Link>
        </div>
      </main>
    </div>
  )
}
