import { normalizarTexto } from './busca'

/**
 * As logos das marcas acompanhadas.
 *
 * Por que agora tem logo, se o #151 disse que não.
 *
 * O #151 recusou pintar o cartão com a cor oficial da marca — vermelho Max
 * Titanium, azul Integralmédica — num cartão que não era o logo dela. A
 * objeção não era à marca de terceiro na tela: era a um cartão nosso vestido
 * com a identidade alheia, o que insinua uma relação institucional que não
 * existe. O logo é outra coisa. Ele identifica a marca cujos preços listamos,
 * que é exatamente o que a faixa promete, e é uso nominativo — o mesmo que
 * qualquer comparador faz. O que continua proibido é o entorno afirmar
 * parceria, e disso cuida `e2e/marcas.spec.ts`.
 *
 * O manifesto é escrito à mão, e não varrido de `public/` em tempo de
 * execução, por dois motivos: o servidor não deve ler disco para desenhar uma
 * faixa, e um arquivo solto na pasta não deve virar logo publicado sem alguém
 * ter decidido. `brand-logos.test.ts` é quem garante que ele não descola dos
 * arquivos de verdade.
 */

export type LogoDeMarca = {
  /** Caminho servido, a partir de `public/`. */
  arquivo: string
  /** Dimensão intrínseca do arquivo. Evita salto de layout enquanto carrega. */
  largura: number
  altura: number
  /**
   * Correção ótica, multiplicando a altura de exibição.
   *
   * Limitar todos à mesma altura iguala a caixa, não o peso visual. O raio da
   * Integralmédica sobe e desce muito além do nome, então na mesma caixa das
   * outras o nome dela sai quase pela metade. O número é o quanto a caixa
   * precisa crescer para o nome empatar com os vizinhos — medido olhando, que
   * é o único jeito, e por isso está declarado aqui em vez de escondido numa
   * classe da tela.
   *
   * Ausente quer dizer 1: a marca ocupa a caixa inteira e não precisa de ajuste.
   */
  escala?: number
}

/**
 * Chave = nome da marca normalizado, do jeito que `agregarMarcas` normaliza.
 *
 * Sem isso "Integralmédica" e "integralmedica" seriam duas marcas diferentes
 * aqui e a mesma lá — o acento sozinho derrubaria o logo.
 */
const LOGOS: Record<string, LogoDeMarca> = {
  'growth supplements': { arquivo: '/marcas/growth-supplements.png', largura: 580, altura: 180 },
  'max titanium': { arquivo: '/marcas/max-titanium.png', largura: 632, altura: 180 },
  'soldiers nutrition': { arquivo: '/marcas/soldiers-nutrition.png', largura: 652, altura: 180 },
  integralmedica: { arquivo: '/marcas/integralmedica.png', largura: 473, altura: 180, escala: 1.45 },
  /*
    O DUX é o único que não chega a 180px de altura.

    O arquivo de origem tem 141x58 depois de aparado, e ampliar não inventa
    detalhe — só peso. Exibido a 36px ele cobre 1,6x, o que basta em tela comum
    e fica levemente macio em retina. Trocar por um vetor resolve; até lá, é o
    melhor que o arquivo dá.
  */
  'dux nutrition': { arquivo: '/marcas/dux-nutrition.png', largura: 141, altura: 58 },
}

/** O logo de uma marca, ou `null` se ainda não temos o arquivo dela. */
export function logoDaMarca(nome: string): LogoDeMarca | null {
  return LOGOS[normalizarTexto(nome)] ?? null
}

/** Exportado só para o teste do manifesto. */
export const MANIFESTO_DE_LOGOS = LOGOS
