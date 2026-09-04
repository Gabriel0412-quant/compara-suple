// Números do catálogo, lidos do banco.
//
// Existem porque a home exibia estatísticas escritas à mão — "1.482 produtos
// monitorados", "R$4,2M economizados", "30 min intervalo de atualização" —
// que nunca corresponderam ao banco. Número em tela precisa ter origem, e a
// única origem confiável é a própria tabela.

import { supabase } from './db'

export type CatalogStats = {
  /** Produtos no catálogo. */
  products: number
  /** Ofertas disponíveis. Indisponíveis não entram: não são comparáveis. */
  offers: number
  /** Data que confirma que todas as ofertas ativas foram atualizadas. */
  lastUpdated: Date | null
}

/** Conta sem trazer linha: `head: true` devolve só o total no content-range. */
async function countOf(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(`countOf(${table}): ${error.message}`)
  return count ?? 0
}

export async function getCatalogStats(): Promise<CatalogStats> {
  const [products, offersRes, oldestAvailableOffer] = await Promise.all([
    countOf('product'),
    supabase
      .from('offer')
      .select('id', { count: 'exact', head: true })
      .eq('available', true),
    supabase
      .from('offer')
      .select('fetched_at')
      .eq('available', true)
      .order('fetched_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (offersRes.error) throw new Error(`getCatalogStats/offers: ${offersRes.error.message}`)
  if (oldestAvailableOffer.error) {
    throw new Error(`getCatalogStats/fetched_at: ${oldestAvailableOffer.error.message}`)
  }

  const raw = (oldestAvailableOffer.data as { fetched_at?: string } | null)?.fetched_at
  const lastUpdated = raw ? new Date(raw) : null

  return {
    products,
    offers: offersRes.count ?? 0,
    lastUpdated: lastUpdated && !Number.isNaN(lastUpdated.getTime()) ? lastUpdated : null,
  }
}

/** 1482 → "1.482". Mantém o separador de milhar do pt-BR. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/**
 * Fuso do leitor.
 *
 * Os `fetched_at` são gravados em UTC e a Vercel roda o servidor em UTC, mas
 * quem lê está no Brasil. Sem fixar o fuso aqui, "hoje" é o hoje de Londres:
 * entre 21h e meia-noite de Brasília o servidor já virou o dia, e a coleta da
 * manhã aparecia como "ontem" para quem estava lendo à noite do mesmo dia.
 */
const FUSO = 'America/Sao_Paulo'

/** Dia civil em São Paulo, como "2026-09-04", para comparar sem hora. */
function diaEmSaoPaulo(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function diferencaEmDias(alvo: Date, agora: Date): number {
  const [a, b] = [diaEmSaoPaulo(agora), diaEmSaoPaulo(alvo)].map((iso) => Date.parse(`${iso}T00:00:00Z`))
  return Math.round((a - b) / 86_400_000)
}

/**
 * Recência em linguagem de gente: "hoje", "ontem" ou a data.
 *
 * Compara por dia civil, não por diferença de horas — uma coleta das 6h de
 * ontem não deve virar "hoje" só porque faz menos de 24 horas.
 *
 * `agora` é injetável para o teste não depender do relógio da máquina. Sem
 * isso as asserções passavam ou falhavam conforme o dia em que rodassem.
 */
export function formatUpdatedAt(date: Date | null, agora: Date = new Date()): string {
  if (!date) return 'sem coleta'

  const dias = diferencaEmDias(date, agora)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO }).format(date)
}

/**
 * A mesma recência, com a hora — para o hero da home, que diz
 * "Última coleta hoje às 06:45".
 *
 * A hora importa aqui e não nas outras telas porque o hero é a promessa de
 * frescor do produto inteiro: dizer só "hoje" às 23h esconde que o dado pode
 * ter dezessete horas. E quando a coleta não é de hoje nem de ontem, a data
 * aparece por extenso em vez de sumir — dado velho é informação, não algo a
 * omitir.
 */
export function formatUltimaColeta(date: Date | null, agora: Date = new Date()): string {
  if (!date) return 'sem coleta registrada'

  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  const dias = diferencaEmDias(date, agora)
  if (dias <= 0) return `hoje às ${hora}`
  if (dias === 1) return `ontem às ${hora}`

  const data = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
  }).format(date)
  return `em ${data} às ${hora}`
}
