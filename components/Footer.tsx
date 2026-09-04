import Link from 'next/link'

import { Logo } from '@/components/brand/Logo'

/**
 * Rodapé de Preço Suplemento.
 *
 * Extraído do JSX inline de `app/page.tsx`, onde vivia só na home — as outras
 * sete páginas públicas não tinham rodapé nenhum, e portanto não exibiam a
 * divulgação de afiliado em lugar nenhum abaixo da dobra.
 *
 * A lista de destinos e o comentário sobre links institucionais vieram de lá
 * sem mudança de critério: só entram destinos que existem. Sobre, Blog,
 * Privacidade, Termos e Contato apontavam para "#", pareciam navegação e não
 * levavam a lugar nenhum; voltam quando as páginas existirem.
 */

const DESTINOS = [
  { rotulo: 'Produtos', href: '/produtos' },
  { rotulo: 'Ofertas', href: '/ofertas' },
  { rotulo: 'Comparador', href: '/comparar' },
] as const

export default function Footer() {
  return (
    <footer className="mt-auto bg-surface-darker px-4 py-10 text-ink-on-dark md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row md:items-start">
        <div>
          <Logo tom="escuro" tamanho="rodape" />
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-on-dark-3">
            Alguns links são de afiliados. O preço que você paga é o mesmo.
          </p>
        </div>

        <nav
          aria-label="Navegação do rodapé"
          className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm md:justify-end"
        >
          {DESTINOS.map(({ rotulo, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md text-ink-on-dark-3 transition-colors hover:text-ink-on-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              {rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
