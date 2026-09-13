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
  /**
   * O painel que este logo exige, quando o claro não serve.
   *
   * Quase todo logo aqui é escuro sobre transparente, e o painel claro é o que
   * os deixa legíveis — foi medido no #203, quando o cartão escuro da faixa
   * fazia três das cinco logos sumirem.
   *
   * A Dark Lab é o contrário: o arquivo dela é a versão negativa, com o
   * wordmark branco e o crânio recortado de uma caixa branca opaca. No painel
   * creme ela desaparece. Declarar a polaridade aqui, junto do arquivo, é o
   * que faz as duas telas que mostram logo acertarem o fundo sem cada uma
   * decidir por conta.
   *
   * Não é cor de marca: os dois valores possíveis são tokens da casa, e o
   * #151 continua valendo. O que muda é qual dos nossos neutros entra atrás.
   */
  painel?: 'escuro'
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
  /*
    A FTW veio com a assinatura "SPORTS NUTRITION" embaixo da marca, em branco.

    Branco sobre o painel creme de `/marcas` é invisível, e o arquivo entraria
    com uma faixa de nada ocupando um terço da altura — o que encolhe a marca
    de verdade dentro da mesma caixa. Aparado na marca, como o DUX já tinha
    sido: o original tem 1000x377 entrelaçado, e o que entra é o recorte
    x 24–975, y 0–315, sem a assinatura e sem a margem transparente.

    Se um dia o painel virar escuro, a assinatura volta a ser legível e vale
    reimportar o arquivo inteiro.
  */
  ftw: { arquivo: '/marcas/ftw.png', largura: 952, altura: 316 },
  /*
    A Dark Lab só existe na versão para fundo escuro.

    Wordmark branco e crânio recortado de uma caixa branca opaca. Medido: de
    299.965 pixels opacos, 259.602 são claros. Sobre o `surface-muted` do
    painel (#F4F1EE) o nome da marca some e a caixa vira um retângulo branco
    solto. Vai inteira, sobre o painel escuro.
  */
  'dark lab': { arquivo: '/marcas/dark-lab.png', largura: 1190, altura: 511, painel: 'escuro' },
}

/** O logo de uma marca, ou `null` se ainda não temos o arquivo dela. */
export function logoDaMarca(nome: string): LogoDeMarca | null {
  return LOGOS[normalizarTexto(nome)] ?? null
}

/** Exportado só para o teste do manifesto. */
export const MANIFESTO_DE_LOGOS = LOGOS
