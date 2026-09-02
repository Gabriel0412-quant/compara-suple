/**
 * Eventos de uso das telas públicas.
 *
 * O dicionário está na #17 e foi aprovado na opção A: nenhum identificador de
 * pessoa ou de sessão. Cada evento é uma linha solta, e a leitura é sempre
 * agregada — "quantas buscas terminaram em zero", não "esta pessoa buscou e
 * saiu".
 *
 * Duas regras herdadas do `/go`, que registra clique desde o #18:
 *
 * 1. **Nunca bloquear.** Registrar evento não pode atrasar nem impedir busca,
 *    comparação ou saída. Por isso `registrarEvento` engole o próprio erro, e
 *    as páginas o chamam dentro de `after()`, que roda depois da resposta.
 * 2. **Nada pessoal.** Sem IP, sem cookie, sem user-agent, sem referrer.
 */
import { supabaseAdmin } from './db-admin'

export type Superficie = 'home' | 'lista' | 'comparador' | 'produto'

export type Evento =
  | { evento: 'busca_enviada'; superficie: Superficie; nResultados: number; termo: string }
  | { evento: 'comparacao_montada'; superficie: 'comparador'; nProdutos: number }
  | { evento: 'metodologia_aberta'; superficie: Superficie }
  | { evento: 'saida_para_loja'; superficie: Superficie; criterio?: string | null }

/** A linha como vai para o banco. Campos ausentes ficam null. */
export type LinhaUiEvent = {
  evento: Evento['evento']
  superficie: Superficie
  n_resultados: number | null
  n_produtos: number | null
  criterio: string | null
  termo: string | null
}

/** Acima disto o termo é ruído; a constraint do banco também recusa. */
const MAX_TERMO = 100

/**
 * Monta a linha aplicando a regra do termo.
 *
 * O texto da busca só sobrevive quando a consulta devolveu zero resultados —
 * o caso em que ele vira decisão de catálogo e deixa de descrever qualquer
 * outra coisa sobre quem digitou. A migration `0010` tem a mesma regra como
 * `check`; aqui é a primeira barreira, lá é a que não depende de ninguém
 * lembrar.
 */
export function montarLinha(e: Evento): LinhaUiEvent {
  const base: LinhaUiEvent = {
    evento: e.evento,
    superficie: e.superficie,
    n_resultados: null,
    n_produtos: null,
    criterio: null,
    termo: null,
  }

  if (e.evento === 'busca_enviada') {
    base.n_resultados = e.nResultados
    if (e.nResultados === 0) {
      const limpo = e.termo.trim().slice(0, MAX_TERMO)
      base.termo = limpo === '' ? null : limpo
    }
    return base
  }

  if (e.evento === 'comparacao_montada') {
    base.n_produtos = e.nProdutos
    return base
  }

  if (e.evento === 'saida_para_loja') {
    base.criterio = e.criterio ?? null
    return base
  }

  return base
}

/*
  Rastreadores disparariam `busca_enviada` a cada URL com `?q=` que
  encontrassem, e a contagem agregada — que é toda a leitura possível na opção
  A — ficaria dominada por robô. A lista cobre os comuns; não pretende ser
  exaustiva, e errar para menos aqui é preferível a descartar gente de verdade.
*/
const BOTS = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|semrush|ahrefs|screaming frog|curl|wget|python-requests|node-fetch|playwright/i

export function ehBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true // sem user-agent, trate como automação
  return BOTS.test(userAgent)
}

/**
 * Grava o evento. Nunca lança: perder uma métrica é melhor do que quebrar a
 * página que a produziu.
 */
export async function registrarEvento(e: Evento): Promise<void> {
  try {
    await supabaseAdmin.from('ui_event').insert(montarLinha(e))
  } catch (erro) {
    console.error('ui_event_falhou', { evento: e.evento, erro: String(erro) })
  }
}
