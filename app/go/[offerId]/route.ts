import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { supabaseAdmin } from '@/lib/db-admin'
import { ehBot, registrarEvento } from '@/lib/eventos'

/**
 * Redirecionamento de saída com tracking de clique.
 *
 * Todo botão "Comprar" do site aponta pra cá em vez de ir direto pro Mercado
 * Livre. O desvio existe pra registrar o clique: sem ele não sabemos qual
 * produto ou qual página realmente converte.
 *
 * A `offer.url` já vem do banco com a tag de afiliado aplicada pela ingestão
 * (ver lib/ml/ingest.ts), então aqui NÃO remontamos o link — só validamos e
 * redirecionamos. Reaplicar a tag arriscaria duplicar parâmetro e quebrar o
 * rastreio do ML.
 */

// Cada acesso é um clique que precisa ser contado; cachear perderia registro.
export const dynamic = 'force-dynamic'

/** Só redirecionamos para http(s) — barra `javascript:`, `data:` e afins. */
function isSafeRedirect(rawUrl: string): boolean {
  try {
    const { protocol } = new URL(rawUrl)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/*
  De onde veio o clique e por qual critério a oferta estava em destaque. Chegam
  pela URL porque o redirecionamento é a única coisa que a saída atravessa —
  criar um segundo caminho de tracking só para carregar dois rótulos seria o que
  a #17 pede para não fazer.

  Vocabulário fechado nos dois: valor fora da lista é descartado, e não gravado.
  Sem isso, qualquer pessoa poderia encher a tabela com texto arbitrário só
  editando o link.
*/
const SUPERFICIES = ['home', 'lista', 'comparador', 'produto'] as const
const CRITERIOS = ['destaque', 'menor_preco', 'menor_por_dose', 'menor_por_kg'] as const

function valido<T extends string>(valor: string | null, aceitos: readonly T[]): T | null {
  return aceitos.includes((valor ?? '') as T) ? (valor as T) : null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await params
  const id = Number(offerId)
  const home = new URL('/', request.url)
  const query = new URL(request.url).searchParams
  const superficie = valido(query.get('de'), SUPERFICIES)
  const criterio = valido(query.get('por'), CRITERIOS)

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.redirect(home)
  }

  const { data: offer, error } = await supabase
    .from('offer')
    .select('id, url')
    .eq('id', id)
    .maybeSingle()

  // Oferta apagada pela ingestão ou id inventado: manda pra home em vez de
  // mostrar erro. O usuário clicou em "Comprar", não merece uma tela de stack.
  if (error || !offer || !isSafeRedirect(offer.url)) {
    return NextResponse.redirect(home)
  }

  // O clique é gravado sem bloquear o redirect: se o insert falhar, o usuário
  // ainda chega na loja. Perder uma métrica é melhor do que perder a venda.
  //
  // LGPD: gravamos apenas referrer e user-agent. Nada de IP, cookie ou
  // identificador pessoal — não há consentimento coletado para isso.
  try {
    await supabaseAdmin.from('click_event').insert({
      offer_id: offer.id,
      referrer: request.headers.get('referer'),
      user_agent: request.headers.get('user-agent'),
    })
  } catch (e) {
    console.error('[go] falha ao registrar clique da oferta', offer.id, e)
  }

  /*
    O mesmo clique alimenta duas tabelas com propósitos diferentes:
    `click_event` sustenta conferência de comissão e guarda referrer e
    user-agent desde o #18; `ui_event` mede o funil e não guarda nenhum dos
    dois. Não é contagem em dobro da mesma coisa — é o mesmo fato registrado
    para duas perguntas.
  */
  if (superficie && !ehBot(request.headers.get('user-agent'))) {
    await registrarEvento({ evento: 'saida_para_loja', superficie, criterio })
  }

  return NextResponse.redirect(offer.url, { status: 302 })
}
