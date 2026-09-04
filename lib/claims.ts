/**
 * Vocabulário proibido nas superfícies públicas.
 *
 * Cada entrada aqui já esteve na tela e foi removida por não ter como ser
 * sustentada. A lista existe para que não voltem: uma auditoria roda sobre o
 * código das páginas e falha quando alguma reaparece.
 *
 * O critério para entrar na lista é um só — a frase afirma ao visitante algo
 * que não temos dado para provar. Não é sobre tom; é sobre lastro.
 */

export type ClaimProibido = {
  /** O que procurar. Case-insensitive. */
  padrao: RegExp
  /** Por que não pode. Aparece na falha do teste. */
  porque: string
  /** O que dizer no lugar, quando há alternativa. */
  alternativa?: string
}

export const CLAIMS_PROIBIDOS: ClaimProibido[] = [
  {
    padrao: /em estoque/i,
    porque:
      'O snapshot do Mercado Livre não traz disponibilidade de estoque. A tabela afirmava isso para toda oferta, com uma string fixa.',
    alternativa: 'Omitir. A oferta estar listada já significa que estava ativa na última coleta.',
  },
  {
    padrao: /compra segura/i,
    porque: 'Não auditamos a segurança de nenhuma loja e não temos como responder por ela.',
  },
  {
    padrao: /✓\s*Link de afiliado/i,
    porque:
      'Usava a marca de item verificado para o que é divulgação, e afirmava atribuição que hoje não existe (#54).',
    alternativa: 'Dizer em texto corrido que ganhamos comissão, sem custo extra para quem compra.',
  },
  {
    padrao: /comprar agora/i,
    porque: 'Sugere que o checkout acontece no Preço Suplemento. Ele acontece na loja.',
    alternativa: 'Ver oferta no {marketplace}, dizendo que abre em nova aba.',
  },
  {
    padrao: /melhor (suplemento|produto|whey|creatina)/i,
    porque:
      'Comparação de preço não sustenta juízo sobre qual produto é melhor. O destaque é sempre por critério nomeado.',
    alternativa: 'Nomear o critério: menor preço, menor R$/dose, menor R$/kg.',
  },
  {
    padrao: /(garantia de )?menor preço garantido/i,
    porque: 'Não monitoramos todas as lojas nem asseguramos preço.',
  },
  {
    padrao: /frete grátis para todo/i,
    porque: 'Frete grátis é por oferta, vem do campo `shipping.free_shipping`, e não vale para todo o catálogo.',
  },
  {
    padrao: /\b(cura|trata|previne|emagrece)\b/i,
    porque:
      'Alegação de saúde. Preço Suplemento compara preço; não avalia eficácia, segurança ou adequação nutricional.',
  },
  {
    padrao: /aprovado pela anvisa/i,
    porque: 'Não verificamos registro sanitário de nenhum produto.',
  },
  {
    /*
      Mira economia agregada ou prometida — "economize até R$ 1.200", "R$ 4,2M
      economizados" —, que precisa de baseline histórico e só existirá com o
      EP10.

      Não mira o desconto de uma oferta: "Economiza R$ 30" ao lado do preço
      riscado sai de `original_price`, campo do próprio anúncio, e tem origem.
      A primeira versão deste padrão não fazia a distinção e acusou a home;
      quem apontou foi a auditoria sobre o HTML servido, que enxerga texto
      gerado a partir de dados e a leitura do código-fonte não alcança.
    */
    padrao: /(economiz\w+ até R\$|R\$\s*[\d.,]+\s*(mi|milh|M\b).{0,20}economiz|economia (total|coletiva|acumulada|dos usuários))/i,
    porque:
      'Economia agregada ou prometida precisa de baseline histórico, que só existirá com o EP10. A home já exibiu "R$4,2M economizados" sem origem.',
    alternativa:
      'Desconto por oferta, derivado de `original_price`, com o preço anterior visível ao lado.',
  },
]

/**
 * Remove comentários antes de auditar.
 *
 * Sem isto a auditoria acusa a própria documentação: o comentário que explica
 * por que "Compra segura no ML" saiu da tela contém a frase, e seria lido como
 * reincidência. O que interessa é o que pode chegar ao visitante — JSX e
 * strings —, não o que explica a decisão para quem lê o código.
 *
 * A remoção é por linha e por bloco, o suficiente para comentário de código e
 * para `{/* ... *\/}` no JSX. Não tenta ser um parser de TypeScript: uma
 * string de produto que contivesse `//` sobreviveria, e tudo bem — auditar
 * demais é mais seguro do que auditar de menos.
 */
export function removerComentarios(codigo: string): string {
  return codigo
    // blocos /* ... */ e {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // linhas iniciadas por // (com indentação)
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
}

export type OcorrenciaDeClaim = {
  arquivo: string
  claim: ClaimProibido
  trecho: string
}

/**
 * Procura claims proibidos em um texto.
 *
 * Recebe o conteúdo já lido para que o chamador decida o que auditar — os
 * arquivos de UI, no teste; o HTML servido, num teste de ponta a ponta.
 */
export function encontrarClaims(conteudo: string, arquivo: string): OcorrenciaDeClaim[] {
  const achados: OcorrenciaDeClaim[] = []
  for (const claim of CLAIMS_PROIBIDOS) {
    const m = conteudo.match(claim.padrao)
    if (m) achados.push({ arquivo, claim, trecho: m[0] })
  }
  return achados
}

/** Mensagem de falha legível, com o porquê e a alternativa. */
export function descreverOcorrencia(o: OcorrenciaDeClaim): string {
  const alt = o.claim.alternativa ? `\n     Em vez disso: ${o.claim.alternativa}` : ''
  return `  ${o.arquivo}: "${o.trecho}"\n     ${o.claim.porque}${alt}`
}
