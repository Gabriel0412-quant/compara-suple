import { Search } from 'lucide-react'

type Props = {
  /** Termo já pesquisado, para o campo voltar preenchido depois da navegação. */
  termoInicial?: string
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
 */
export default function CampoBusca({ termoInicial = '', className = '' }: Props) {
  return (
    <form
      action="/produtos"
      method="get"
      role="search"
      className={`flex flex-col sm:flex-row gap-2 ${className}`}
    >
      <div className="relative flex-1">
        <label htmlFor="q" className="sr-only">
          Buscar suplemento por nome ou marca
        </label>
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={termoInicial}
          maxLength={100}
          autoComplete="off"
          placeholder="Ex: whey protein, creatina..."
          className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>
      <button
        type="submit"
        className="px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 transition-colors whitespace-nowrap"
      >
        Buscar preços
      </button>
    </form>
  )
}
