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
  /** Data da coleta mais recente. null quando ainda não houve coleta. */
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
  const [products, offersRes, freshest] = await Promise.all([
    countOf('product'),
    supabase
      .from('offer')
      .select('id', { count: 'exact', head: true })
      .eq('available', true),
    supabase
      .from('offer')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (offersRes.error) throw new Error(`getCatalogStats/offers: ${offersRes.error.message}`)
  if (freshest.error) throw new Error(`getCatalogStats/fetched_at: ${freshest.error.message}`)

  const raw = (freshest.data as { fetched_at?: string } | null)?.fetched_at
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
 * Recência em linguagem de gente: "hoje", "ontem" ou a data.
 *
 * Compara por dia civil, não por diferença de horas — uma coleta das 6h de
 * ontem não deve virar "hoje" só porque faz menos de 24 horas.
 */
export function formatUpdatedAt(date: Date | null): string {
  if (!date) return 'sem coleta'

  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((day(new Date()) - day(date)) / 86_400_000)

  if (diffDays <= 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}
