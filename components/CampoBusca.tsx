import { Search } from 'lucide-react'

type Props = {
  /** Termo já pesquisado, para o campo voltar preenchido depois da navegação. */
  termoInicial?: string
  /** `hero` é a versão grande da home, onde a busca é o centro da página. */
  tamanho?: 'hero' | 'padrao'
  className?: string
}

/**
 * Formulário de busca do catálogo.
 *
 * É um `<form method="get">` nativo, e não um campo controlado com
 * `router.push`: assim a busca funciona antes de o JavaScript carregar, o termo
 * vai para a URL de graça (compartilhável e com histórico do navegador), e a
 * tecla Enter faz o que qualquer pessoa espera. O destino é `/produtos`, a
 * listagem que já existe.
 *
 * O rótulo do botão é "Buscar preços", e não "Comparar" como na maquete 1b.
 * "Comparar" já é o nome de outra coisa no site — a rota `/comparar`, que põe
 * produtos lado a lado. Dois controles com o mesmo nome levando a lugares
 * diferentes confundem mais do que a fidelidade ao desenho ajuda.
 */
export default function CampoBusca({
  termoInicial = '',
  tamanho = 'padrao',
  className = '',
}: Props) {
  const hero = tamanho === 'hero'

  return (
    <form
      action="/produtos"
      method="get"
      role="search"
      className={`flex flex-col gap-2 sm:flex-row ${className}`}
    >
      <div className="relative flex-1">
        <label htmlFor="q" className="sr-only">
          Buscar suplemento por nome ou marca
        </label>
        <Search
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-4 ${
            hero ? 'left-4 h-5 w-5' : 'left-3 h-4 w-4'
          }`}
        />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={termoInicial}
          maxLength={100}
          autoComplete="off"
          placeholder="Ex: whey isolado 1kg, creatina 300g…"
          className={`w-full rounded-xl bg-surface text-ink placeholder:text-ink-4 focus:outline-2 focus:outline-offset-2 focus:outline-brand ${
            hero
              ? 'border-2 border-ink py-4 pl-12 pr-4 text-base sm:text-lg'
              : 'border border-line-strong py-3 pl-10 pr-3 text-sm'
          }`}
        />
      </div>
      <button
        type="submit"
        className={`whitespace-nowrap rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-strong focus:outline-2 focus:outline-offset-2 focus:outline-brand ${
          hero ? 'px-7 py-4 text-base sm:text-lg' : 'px-5 py-3 text-sm'
        }`}
      >
        Buscar preços
      </button>
    </form>
  )
}
