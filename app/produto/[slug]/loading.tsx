/**
 * Esqueleto no formato da maquete 1c: corpo à esquerda, caixa de preço à
 * direita. Ele desenha a mesma grade que a página real usa, então o conteúdo
 * não salta de lugar quando chega.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="mx-auto max-w-7xl animate-pulse px-4 py-6 md:px-10 md:py-8">
        <div className="h-4 w-1/3 rounded bg-surface-muted" />

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
          <div className="min-w-0">
            <div className="grid gap-6 sm:grid-cols-[280px_minmax(0,1fr)] sm:gap-7">
              <div className="h-[280px] rounded-2xl border border-line bg-surface-muted" />
              <div className="space-y-3">
                <div className="h-3 w-1/4 rounded bg-surface-muted" />
                <div className="h-8 w-3/4 rounded bg-surface-muted" />
                <div className="h-4 w-1/2 rounded bg-surface-muted" />
                <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
                  <div className="h-16 rounded-xl bg-surface-warm" />
                  <div className="h-16 rounded-xl bg-surface-muted" />
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-2 rounded-2xl border border-line p-5">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 rounded-lg bg-surface-muted" />
              ))}
            </div>
          </div>

          <div className="h-64 rounded-2xl border-2 border-line-strong bg-surface-warm" />
        </div>
      </main>
    </div>
  )
}
