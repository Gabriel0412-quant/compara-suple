import Link from 'next/link'

import CampoBusca from '@/components/CampoBusca'
import { Logo } from '@/components/brand/Logo'
import { listCategories } from '@/lib/categories'

/**
 * Header de Preço Suplemento, faixa escura, conforme a maquete 1b.
 *
 * Três coisas saíram do header antigo, e nenhuma por motivo estético:
 *
 * - **"Entrar"** — não existe conta, login nem área logada. Era um botão que
 *   não fazia nada.
 * - **O campo de busca** — era um `<input>` solto, sem `form`, sem `action` e
 *   sem handler: parecia busca e não buscava.
 *
 *   Voltou no #235, e a objeção não foi revogada: o que voltou é o mesmo
 *   `CampoBusca` das outras telas, um `<form method="get">` para `/produtos`
 *   que funciona sem JavaScript. O que o header recusava era busca de
 *   mentira, não busca. A maquete 1b não desenha uma porque ali a busca é o
 *   hero — e o hero só existe na home; nas outras seis rotas não havia
 *   nenhuma forma de buscar sem voltar para o começo.
 * - **"Criar alerta"**, que a maquete pede — o alerta de preço é o EP18, que
 *   não começou. Botão apontando para o nada é a mesma falha do "Entrar".
 *   Volta no #129, junto com o serviço que ele promete.
 *
 * É o mesmo critério que o rodapé já aplicava: só destinos que existem.
 */

const DESTINOS = [
  { rotulo: 'Ofertas', href: '/ofertas' },
  { rotulo: 'Comparador', href: '/comparar' },
] as const

const foco =
  'rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand'

/**
 * `listCategories()` é síncrona e não consulta o banco, então o header não
 * paga uma ida ao Supabase em toda página. Categoria sem produto não é link
 * quebrado: a página tem estado vazio próprio e diz que não há nada ali.
 */
function categorias() {
  return listCategories().map((c) => ({ rotulo: c.name, href: `/categoria/${c.slug}` }))
}

function ListaDeCategorias({ className = '' }: { className?: string }) {
  return (
    <ul className={className}>
      {categorias().map(({ rotulo, href }) => (
        <li key={href}>
          <Link
            href={href}
            className={`block whitespace-nowrap px-3 py-2 text-sm text-ink-on-dark-2 hover:text-ink-on-dark hover:bg-surface-dark-raised ${foco}`}
          >
            {rotulo}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function Header() {
  return (
    <header className="bg-surface-dark text-ink-on-dark">
      {/*
        Duas linhas em tela estreita, uma só em tela larga.

        A busca precisa de largura para ser usável: em 375px, logo e menu já
        comem quase tudo, e o campo sairia com uns 130px — cabe o cursor e não
        cabe a palavra. Então o logo ocupa a linha inteira e a busca desce, com
        o menu ao lado dela.

        O menu desce junto, e isso não é detalhe de estética. A primeira
        tentativa foi deixar o menu em cima e mandar só a busca para baixo com
        `order-last` — o que descola a ordem do DOM da ordem de leitura: a
        tabulação ia do logo para a busca, na segunda linha, e voltava para o
        menu, na primeira. `responsivo-home.spec.ts` pegou na hora, e estava
        certo. Com o menu na mesma linha da busca, as duas ordens coincidem nas
        três larguras.

        É uma instância só do componente, posicionada por CSS: duas instâncias
        significariam dois `id`, dois marcos de busca e dois campos a manter em
        sincronia.
      */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 md:gap-x-4 md:px-10 md:py-4">
        <div className="w-full md:w-auto">
          <Logo tom="escuro" tamanho="header" />
        </div>

        <CampoBusca tamanho="header" className="min-w-0 flex-1 md:ml-2 md:min-w-64 md:max-w-md" />

        {/* Navegação larga. Some abaixo de `md` e vira o menu adiante. */}
        <nav aria-label="Navegação principal" className="ml-auto hidden items-center gap-1 md:flex">
          {DESTINOS.map(({ rotulo, href }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 text-sm font-medium text-ink-on-dark-2 hover:text-ink-on-dark ${foco}`}
            >
              {rotulo}
            </Link>
          ))}

          {/*
            `<details>` em vez de menu com JavaScript: abre no clique e no
            teclado sem script nenhum, e continua funcionando se o JS falhar.
          */}
          <details className="group relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-on-dark-2 marker:content-none hover:text-ink-on-dark ${foco}`}
            >
              Categorias
              <span
                aria-hidden="true"
                className="text-[10px] transition-transform group-open:rotate-180"
              >
                ▼
              </span>
            </summary>
            <ListaDeCategorias className="absolute right-0 z-50 mt-2 min-w-52 rounded-lg border border-line-dark bg-surface-dark py-1.5 shadow-lg" />
          </details>
        </nav>

        {/* Menu estreito, um só `<details>` com tudo dentro. */}
        <details className="group relative shrink-0 md:hidden">
          <summary
            className={`flex cursor-pointer list-none items-center gap-2 px-2 py-2 text-sm font-medium text-ink-on-dark marker:content-none ${foco}`}
          >
            <span
              aria-hidden="true"
              className="flex h-4 w-5 flex-col justify-between border-y-2 border-current before:block before:h-0.5 before:w-full before:bg-current"
            />
            Menu
          </summary>
          <div className="absolute right-0 z-50 mt-2 min-w-56 rounded-lg border border-line-dark bg-surface-dark py-1.5 shadow-lg">
            <nav aria-label="Navegação principal">
              <ul>
                {DESTINOS.map(({ rotulo, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`block px-3 py-2 text-sm font-medium text-ink-on-dark hover:bg-surface-dark-raised ${foco}`}
                    >
                      {rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-1 border-t border-line-dark px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-on-dark-3">
                Categorias
              </p>
              <ListaDeCategorias />
            </nav>
          </div>
        </details>
      </div>
    </header>
  )
}
