import { Search } from 'lucide-react'

type Tamanho = 'hero' | 'padrao' | 'header'

type Props = {
  /** Termo já pesquisado, para o campo voltar preenchido depois da navegação. */
  termoInicial?: string
  /** `hero` é a versão grande da home, onde a busca é o centro da página. */
  tamanho?: Tamanho
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

/**
 * As três variantes, e o que cada uma precisa ter de próprio.
 *
 * `id` e `rotulo` variam porque `header` divide a página com as outras duas: a
 * home tem o hero e o header, `/produtos` tem o padrão e o header. Dois `id="q"`
 * no mesmo documento quebram o `<label for>` — o clique no rótulo de um foca o
 * outro — e dois marcos `role="search"` com o mesmo nome acessível deixam quem
 * navega por landmark sem saber qual é qual.
 *
 * O `name` continua `q` nas três: é o parâmetro que `/produtos` lê, e ele não
 * depende de onde o formulário está.
 */
const VARIANTES = {
  hero: {
    id: 'q',
    rotulo: 'Buscar suplemento por nome ou marca',
    marco: 'Buscar no catálogo',
    icone: 'left-4 h-5 w-5',
    campo: 'border-2 border-ink py-4 pl-12 pr-4 text-base sm:text-lg',
    botao: 'px-7 py-4 text-base sm:text-lg',
  },
  padrao: {
    id: 'q',
    rotulo: 'Buscar suplemento por nome ou marca',
    marco: 'Buscar no catálogo',
    icone: 'left-3 h-4 w-4',
    campo: 'border border-line-strong py-3 pl-10 pr-3 text-sm',
    botao: 'px-5 py-3 text-sm',
  },
  header: {
    id: 'q-header',
    rotulo: 'Buscar em todo o site',
    marco: 'Buscar em todo o site',
    icone: 'left-3 h-4 w-4',
    campo: 'min-h-11 border border-line-dark py-2 pl-10 pr-3 text-sm',
    botao: 'min-h-11 px-4 text-sm',
  },
} as const satisfies Record<Tamanho, Record<string, string>>

export default function CampoBusca({
  termoInicial = '',
  tamanho = 'padrao',
  className = '',
}: Props) {
  const v = VARIANTES[tamanho]
  const noHeader = tamanho === 'header'

  return (
    <form
      action="/produtos"
      method="get"
      role="search"
      /*
        O marco precisa de nome próprio quando há dois na página. Sem ele, o
        leitor de tela anuncia "busca" duas vezes e a pessoa escolhe no escuro.
      */
      aria-label={v.marco}
      className={`flex gap-2 ${noHeader ? 'flex-row' : 'flex-col sm:flex-row'} ${className}`}
    >
      <div className="relative flex-1">
        <label htmlFor={v.id} className="sr-only">
          {v.rotulo}
        </label>
        <Search
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-4 ${v.icone}`}
        />
        <input
          id={v.id}
          name="q"
          type="search"
          defaultValue={termoInicial}
          maxLength={100}
          autoComplete="off"
          placeholder={noHeader ? 'Buscar suplemento…' : 'Ex: whey isolado 1kg, creatina 300g…'}
          className={`w-full rounded-xl bg-surface text-ink placeholder:text-ink-4 focus:outline-2 focus:outline-offset-2 focus:outline-brand ${v.campo}`}
        />
      </div>
      <button
        type="submit"
        className={`whitespace-nowrap rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-strong focus:outline-2 focus:outline-offset-2 focus:outline-brand ${v.botao}`}
      >
        {/*
          No header o rótulo é "Buscar", e não "Buscar preços".

          Não é economia de espaço: são duas buscas na mesma página, e os
          testes — e quem usa leitor de tela — precisam distinguir uma da
          outra pelo nome. "Buscar preços" continua sendo o botão da página.
        */}
        {noHeader ? 'Buscar' : 'Buscar preços'}
      </button>
    </form>
  )
}
