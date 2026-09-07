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
 */

// Cada acesso é um clique que precisa ser contado; cachear perderia registro.
export const dynamic = 'force-dynamic'

/** Só redirecionamos para http(s) — barra `javascript:`, `data:` e afins. */
function isSafeRedirect(rawUrl: string): boolean {
  if (!URL.canParse(rawUrl) || /[^\x21-\x7e]/.test(rawUrl)) return false
  const { protocol } = new URL(rawUrl)
  return protocol === 'http:' || protocol === 'https:'
}

function redirectWithExactLocation(location: string): Response {
  return new Response(null, { status: 302, headers: { location } })
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

type UiTracking = {
  superficie: (typeof SUPERFICIES)[number] | null
  criterio: (typeof CRITERIOS)[number] | null
}

type RedirectOffer = { id: number; url: string }

function validOfferId(offerId: string): number | null {
  const id = Number(offerId)
  return Number.isInteger(id) && id > 0 ? id : null
}

function uiTrackingFromRequest(request: Request): UiTracking {
  const query = new URL(request.url).searchParams
  return {
    superficie: valido(query.get('de'), SUPERFICIES),
    criterio: valido(query.get('por'), CRITERIOS),
  }
}

async function loadRedirectOffer(id: number): Promise<RedirectOffer | null> {
  const { data: offer, error } = await supabase
    .from('offer')
    .select('id, url')
    .eq('id', id)
    .maybeSingle()

  if (error || !offer || !isSafeRedirect(offer.url)) return null
  return offer
}

async function recordClickEvent(offer: RedirectOffer, request: Request): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('click_event').insert({
      offer_id: offer.id,
      referrer: request.headers.get('referer'),
      user_agent: request.headers.get('user-agent'),
    })
    if (error) console.error('click_event_falhou', { offer_id: offer.id, code: 'write_failed' })
  } catch {
    console.error('click_event_falhou', { offer_id: offer.id, code: 'write_failed' })
  }
}

async function recordUiEvent(request: Request, tracking: UiTracking): Promise<void> {
  if (!tracking.superficie || ehBot(request.headers.get('user-agent'))) return
  try {
    await registrarEvento({
      evento: 'saida_para_loja',
      superficie: tracking.superficie,
      criterio: tracking.criterio,
    })
  } catch {
    console.error('ui_event_falhou', { evento: 'saida_para_loja', code: 'write_failed' })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await params
  const home = new URL('/', request.url)
  const tracking = uiTrackingFromRequest(request)
  const id = validOfferId(offerId)

  if (id === null) {
    return NextResponse.redirect(home)
  }

  // Oferta apagada pela ingestão ou id inventado: manda pra home em vez de
  // mostrar erro. O usuário clicou em "Comprar", não merece uma tela de stack.
  const offer = await loadRedirectOffer(id)
  if (offer === null) {
    return NextResponse.redirect(home)
  }

  // O clique é gravado sem bloquear o redirect: se o insert falhar, o usuário
  // ainda chega na loja. Perder uma métrica é melhor do que perder a venda.
  //
  // LGPD: gravamos apenas referrer e user-agent. Nada de IP, cookie ou
  // identificador pessoal — não há consentimento coletado para isso.
  await recordClickEvent(offer, request)

  /*
    O mesmo clique alimenta duas tabelas com propósitos diferentes:
    `click_event` sustenta conferência de comissão e guarda referrer e
    user-agent desde o #18; `ui_event` mede o funil e não guarda nenhum dos
    dois. Não é contagem em dobro da mesma coisa — é o mesmo fato registrado
    para duas perguntas.
  */
  await recordUiEvent(request, tracking)

  return redirectWithExactLocation(offer.url)
}
