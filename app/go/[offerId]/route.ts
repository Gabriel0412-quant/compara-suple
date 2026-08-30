import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { supabaseAdmin } from '@/lib/db-admin'

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await params
  const id = Number(offerId)
  const home = new URL('/', request.url)

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

  return NextResponse.redirect(offer.url, { status: 302 })
}
