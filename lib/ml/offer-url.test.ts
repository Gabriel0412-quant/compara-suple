import { describe, expect, it } from 'vitest'
import { newOfferUrlCounters, resolveOfferUrl } from './offer-url'

const CATALOGO = 'MLB19049048'
const ITEM_A = 'MLB5872093596'
const ITEM_B = 'MLB4169713445'
const TAG = 'tag-de-teste'

function urlDoItem(itemId: string) {
  return `https://www.mercadolivre.com.br/p/${CATALOGO}?affiliate=oficial&wid=${itemId}`
}

function resolver(externalId: string, manualByItemId?: Record<string, string>) {
  return resolveOfferUrl({ catalogId: CATALOGO, externalId, manualByItemId, affiliateTag: TAG })
}

describe('resolveOfferUrl', () => {
  it('dá a cada oferta o link do seu próprio anúncio', () => {
    const a = resolver(ITEM_A)
    const b = resolver(ITEM_B)

    expect(a.url).not.toBe(b.url)
    expect(new URL(a.url).searchParams.get('wid')).toBe(ITEM_A)
    expect(new URL(b.url).searchParams.get('wid')).toBe(ITEM_B)
  })

  it('aceita a URL curada quando o wid dela é o da própria oferta', () => {
    const r = resolver(ITEM_A, { [ITEM_A]: urlDoItem(ITEM_A) })

    expect(r).toEqual({ url: urlDoItem(ITEM_A), reason: 'manual', tracked: true })
  })

  it('nunca aplica em B a URL curada de A', () => {
    const curadas = { [ITEM_A]: urlDoItem(ITEM_A) }

    const b = resolver(ITEM_B, curadas)

    expect(b.url).not.toContain(ITEM_A)
    expect(b.reason).toBe('fallback_sem_manual')
    expect(new URL(b.url).searchParams.get('wid')).toBe(ITEM_B)
  })

  it.each([
    ['http', `http://www.mercadolivre.com.br/p/${CATALOGO}?wid=${ITEM_A}`, 'fallback_protocolo'],
    ['domínio de fora', `https://exemplo.com/p/${CATALOGO}?wid=${ITEM_A}`, 'fallback_dominio'],
    ['domínio parecido', `https://mercadolivre.com.br.exemplo.com/?wid=${ITEM_A}`, 'fallback_dominio'],
    ['sem wid', `https://www.mercadolivre.com.br/social/abc?matt_word=abc`, 'fallback_wid'],
    ['wid de outra oferta', urlDoItem(ITEM_B), 'fallback_wid'],
    ['não é URL', 'nao-e-uma-url', 'fallback_url_invalida'],
  ] as const)('recusa URL curada com %s e cai no fallback', (_caso, manual, motivo) => {
    const r = resolver(ITEM_A, { [ITEM_A]: manual })

    expect(r.reason).toBe(motivo)
    expect(r.url).toBe(
      `https://www.mercadolivre.com.br/p/${CATALOGO}?affiliate=${TAG}&wid=${ITEM_A}`,
    )
  })

  it('aceita subdomínios do Mercado Livre', () => {
    const manual = `https://produto.mercadolivre.com.br/MLB-x?wid=${ITEM_A}`

    expect(resolver(ITEM_A, { [ITEM_A]: manual }).reason).toBe('manual')
  })

  it('usa a rota /up/ dos user products no fallback', () => {
    const r = resolveOfferUrl({
      catalogId: 'MLBU3907661448',
      externalId: ITEM_A,
      affiliateTag: TAG,
    })

    expect(r.url).toBe(
      `https://www.mercadolivre.com.br/up/MLBU3907661448?affiliate=${TAG}&wid=${ITEM_A}`,
    )
  })

  it('marca como não rastreado o link construído sem tag de afiliado', () => {
    const semTag = resolveOfferUrl({ catalogId: CATALOGO, externalId: ITEM_A, affiliateTag: '' })

    expect(semTag.tracked).toBe(false)
    expect(semTag.url).not.toContain('affiliate=')
    expect(resolver(ITEM_A).tracked).toBe(true)
  })

  it('começa com todos os contadores zerados', () => {
    expect(Object.values(newOfferUrlCounters()).every(n => n === 0)).toBe(true)
  })
})
