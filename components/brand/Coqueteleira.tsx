/**
 * A coqueteleira do logo de Preço Suplemento (variante 5d do Claude Design).
 *
 * O design entregou cinco arquivos SVG — `shaker-orange`, `shaker-orange-l`,
 * `shaker-white`, `shaker-cream`, `shaker-dark` — e a comparação mostrou que
 * os quatro `path` são byte a byte iguais em todos: só muda o `fill` do `<g>`.
 * Cinco arquivos para uma diferença de cor é cinco lugares para o desenho
 * divergir, então aqui existe um componente e a cor vem de fora, por
 * `currentColor`.
 *
 * Os arquivos originais também carregavam ~14 KB de metadata C2PA cada um,
 * para ~700 bytes de geometria. Nada disso sobrevive aqui.
 */

type Props = {
  /** Altura em px. A largura sai da proporção original, 95×180. */
  height?: number
  className?: string
  /**
   * Texto alternativo. Sem ele o ícone é decorativo e sai da árvore de
   * acessibilidade — que é o certo quando ele aparece ao lado do nome escrito,
   * como no header: um leitor de tela não deve ouvir "coqueteleira" antes de
   * "Preço Suplemento".
   */
  title?: string
}

const RAZAO = 95 / 180

export function Coqueteleira({ height = 44, className, title }: Props) {
  return (
    <svg
      viewBox="82 40 95 180"
      height={height}
      width={Math.round(height * RAZAO)}
      fill="currentColor"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d="M94,42 L149,42 C156,43 160,50 160,60 L146,60 C146,54 143,50 137,49 L122,49 L122,60 L99,60 L99,47 L94,47 Z" />
      <path d="M99,60 C94,66 84,74 84,84 L84,90 C84,94 87,96 91,96 L168,96 C172,96 175,94 175,90 L175,84 C175,74 166,66 160,60 Z" />
      <path d="M90,100 L169,100 L168,123 L91,123 Z" />
      <path
        fillRule="evenodd"
        d="M91,124 L168,124 L163,208 C162,214 158,218 152,218 L107,218 C101,218 97,214 96,208 Z M100,127 C112,122 118,128 130,133 C142,138 152,140 159,136 L156,203 C155,208 152,210 148,210 L111,210 C107,210 104,208 103,203 Z"
      />
    </svg>
  )
}
