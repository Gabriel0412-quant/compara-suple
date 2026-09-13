import Image from 'next/image'

import { logoDaMarca } from '@/lib/brand-logos'
import { type Marca } from '@/lib/brands'

/**
 * O logo de uma marca, com o nome escrito quando não temos o arquivo.
 *
 * Nasceu dentro da faixa da home (#203) e saiu de lá quando `/marcas` passou a
 * mostrar o mesmo logo num painel muito maior (#219). O que as duas telas
 * compartilham não é o tamanho: é a regra de correção ótica por marca e o
 * caminho de quando o arquivo não existe.
 *
 * O fallback não é decoração — a lista é dado vivo. A próxima coleta pode
 * trazer uma marca cujo logo não temos, e sem este caminho o painel sairia
 * vazio.
 */

/**
 * Altura de exibição do logo por tamanho, antes da correção ótica de cada marca.
 *
 * `faixa` é o cartão da home. `painel` é o topo do cartão de `/marcas`, que a
 * maquete 1a desenha com 168px de altura — o logo fica em 84 para sobrar
 * respiro em volta, e a Integralmédica, com escala 1,45, chega a 122 sem
 * encostar na borda.
 */
const TAMANHOS = {
  faixa: { altura: 36, nome: 'text-base' },
  painel: { altura: 84, nome: 'text-2xl sm:text-3xl' },
} as const

export type TamanhoDoLogo = keyof typeof TAMANHOS

/**
 * O fundo que o logo da marca exige.
 *
 * Escrito por extenso, e não interpolado: o Tailwind varre o código atrás de
 * nomes de classe literais, e uma classe montada em tempo de execução não é
 * gerada — o elemento sai transparente, sem erro de build nem de tipo. Mesma
 * armadilha que `CLASSE_DO_TOM` documenta.
 *
 * Os dois valores são tokens da casa. Não é cor de marca: o #151 recusou
 * vestir um cartão nosso com a identidade de terceiro, e continua valendo. O
 * que se escolhe aqui é qual dos nossos neutros deixa o arquivo legível.
 */
const FUNDO = {
  claro: 'bg-surface-muted',
  escuro: 'bg-surface-dark',
} as const

/**
 * A classe de fundo para o painel desta marca.
 *
 * Mora aqui, e não em cada tela, porque a faixa da home e o cartão de
 * `/marcas` mostram o mesmo arquivo: se cada uma escolhesse o fundo por conta,
 * a Dark Lab ficaria legível numa e invisível na outra.
 */
export function fundoDoLogo(marca: Marca): string {
  return FUNDO[logoDaMarca(marca.nome)?.painel ?? 'claro']
}

/** Se o arquivo desta marca é azulejo, e cobre o painel de borda a borda. */
export function logoPreencheOPainel(marca: Marca): boolean {
  return logoDaMarca(marca.nome)?.preenche === true
}

export function ConteudoDoCartao({
  marca,
  tamanho = 'faixa',
}: {
  marca: Marca
  tamanho?: TamanhoDoLogo
}) {
  const logo = logoDaMarca(marca.nome)
  const t = TAMANHOS[tamanho]

  /*
    O azulejo cobre a caixa nos dois tamanhos.

    Deixá-lo só no painel de `/marcas` fazia a Integralmédica virar um quadrado
    vermelho de 36px na faixa da home, e a DUX um quadrado cinza com o nome
    ilegível — o arquivo é 1:1, e contido numa caixa de 36px de altura sobra
    36px de largura. Medido antes de mudar.
  */
  if (logo?.preenche) {
    return (
      <Image
        src={logo.arquivo}
        alt={marca.nome}
        width={logo.largura}
        height={logo.altura}
        unoptimized
        className="h-full w-full object-cover"
      />
    )
  }

  if (!logo) {
    return (
      <span
        className={`text-center ${t.nome} font-bold uppercase leading-tight tracking-[-0.02em] text-ink`}
      >
        {marca.nome}
      </span>
    )
  }

  return (
    <Image
      src={logo.arquivo}
      // O nome é o texto alternativo: é o que o logo diz. Junto com o `sr-only`
      // abaixo, forma o nome acessível do link.
      alt={marca.nome}
      width={logo.largura}
      height={logo.altura}
      /*
        Sem o otimizador. São marcas pequenas, exibidas em tamanho fixo, e o
        otimizador do Next recusa SVG sem `dangerouslyAllowSVG` ligado no
        projeto inteiro — o que valeria a pena se a imagem viesse de fora, mas
        estas são nossas e estão em `public/`.
      */
      unoptimized
      /*
        A altura vai em `style`, não em classe.

        `max-h-[${...}px]` montado em tempo de execução não é gerado pelo
        Tailwind e sai sem altura nenhuma, em silêncio — a mesma armadilha que
        `CLASSE_DO_TOM` existe para evitar.

        Havia aqui uma correção ótica por marca (`escala`), porque limitar todos
        à mesma altura iguala a caixa e não o peso visual: o raio da
        Integralmédica subia e descia muito além do nome, e na mesma caixa das
        outras o nome dela saía quase pela metade. Ela era a única marca a usar
        o campo, e o arquivo novo dela é azulejo — a correção perdeu o último
        usuário e saiu junto. Volta se alguma marca precisar de novo.
      */
      style={{ maxHeight: `${t.altura}px` }}
      /*
        Cor de origem, sempre — e não só no hover, como o #203 tinha deixado.

        Aquela versão neutralizava a cor para a fileira ler como um conjunto,
        já que a Growth é a única colorida entre quatro marcas quase pretas.
        Vista no ar, a troca não compensou: quem passa o mouse é minoria, e
        quem não passa via cinco logos apagadas. Reconhecer a marca é o que a
        faixa existe para fazer.

        Continua sem relação com o #151: ali a cor era nossa, pintada num
        cartão que não era o logo. Aqui a cor é do próprio logo e identifica de
        fato quem ela diz identificar.
      */
      className="w-auto max-w-full object-contain"
    />
  )
}
