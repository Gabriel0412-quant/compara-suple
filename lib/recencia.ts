/**
 * Regra única de recência da coleta.
 *
 * Antes, cada superfície só formatava a data — "hoje", "ontem", "31/08" — e
 * nenhuma dizia se aquilo ainda era aceitável. "31/08" parece informação
 * neutra; se hoje for 05/09, é um aviso que ninguém deu.
 *
 * A classificação fica aqui, em um lugar só, para que lista, comparador e
 * produto digam a mesma coisa sobre o mesmo dado — e para que o limite seja
 * um número testável em vez de um texto fixo escrito em cada página.
 */

/**
 * Acima disto a coleta está atrasada.
 *
 * A coleta é diária, agendada para 09:00 UTC. O Vercel Cron tem janela de
 * tolerância — em 02/09/2026 a execução saiu às 09:46 —, então duas coletas
 * consecutivas podem ficar a mais de 24 h uma da outra sem que nada esteja
 * errado. 36 h acomoda esse atraso e ainda acusa uma coleta perdida.
 */
export const LIMITE_ATRASO_HORAS = 36

export type Recencia =
  /** Coletado dentro do esperado. */
  | 'em-dia'
  /** Passou do limite: os preços podem não refletir a loja. */
  | 'atrasado'
  /** Nunca houve coleta. */
  | 'sem-coleta'

export function classificarRecencia(
  ultimaColeta: Date | null,
  agora: Date = new Date(),
  limiteHoras: number = LIMITE_ATRASO_HORAS,
): Recencia {
  if (!ultimaColeta || Number.isNaN(ultimaColeta.getTime())) return 'sem-coleta'
  const horas = (agora.getTime() - ultimaColeta.getTime()) / 3_600_000
  // Data no futuro é relógio fora de sincronia, não atraso.
  if (horas < 0) return 'em-dia'
  return horas > limiteHoras ? 'atrasado' : 'em-dia'
}

/** Texto do aviso, ou null quando não há o que avisar. */
export function avisoDeRecencia(recencia: Recencia): string | null {
  if (recencia === 'atrasado') {
    return 'Os preços podem estar desatualizados: a última coleta passou do intervalo diário esperado. Confira o valor na loja antes de comprar.'
  }
  if (recencia === 'sem-coleta') {
    return 'Ainda não há coleta de preços registrada.'
  }
  return null
}
