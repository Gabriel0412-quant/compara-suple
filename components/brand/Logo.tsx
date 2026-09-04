import Link from 'next/link'

import { Coqueteleira } from './Coqueteleira'

/**
 * O lockup de Preço Suplemento: coqueteleira + nome em duas linhas + tagline.
 *
 * Vem da variante 5d do Claude Design. As duas linhas não são quebra de texto:
 * "Preço" e "Suplemento" são blocos separados de propósito, com entrelinha
 * apertada (0.95), e só o primeiro leva o laranja.
 *
 * A tagline sai em telas estreitas. No desenho ela tem 7px, que funciona num
 * canvas de 1440px e não funciona num celular — abaixo de `sm` ela vira ruído
 * ilegível, e o lockup se sustenta sem ela.
 */

type Tom = 'escuro' | 'claro'
type Tamanho = 'header' | 'rodape'

const TAMANHOS = {
  header: { icone: 40, nome: 'text-lg', tagline: 'text-[9px] tracking-[0.135em]', gap: 'gap-2.5' },
  rodape: { icone: 34, nome: 'text-base', tagline: 'text-[9px] tracking-[0.12em]', gap: 'gap-2' },
} as const

export function Logo({
  tom = 'escuro',
  tamanho = 'header',
}: {
  /** `escuro` = sobre fundo escuro (header, rodapé). `claro` = sobre fundo claro. */
  tom?: Tom
  tamanho?: Tamanho
}) {
  const t = TAMANHOS[tamanho]
  const corDoNome = tom === 'escuro' ? 'text-ink-on-dark' : 'text-ink'

  return (
    <Link
      href="/"
      // O nome já é o texto acessível do link; a coqueteleira fica decorativa
      // para o leitor de tela não anunciar "coqueteleira Preço Suplemento".
      aria-label="Preço Suplemento — página inicial"
      className={`flex items-center ${t.gap} rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand`}
    >
      <Coqueteleira height={t.icone} className="text-brand shrink-0" />
      <span className="flex flex-col gap-[3px]">
        <span className={`${t.nome} font-bold leading-[0.95] tracking-[-0.03em]`} aria-hidden="true">
          <span className="block text-brand">Preço</span>
          <span className={`block ${corDoNome}`}>Suplemento</span>
        </span>
        <span
          className={`hidden sm:block font-mono ${t.tagline} font-medium uppercase text-brand`}
          aria-hidden="true"
        >
          Compare e economize
        </span>
      </span>
    </Link>
  )
}
