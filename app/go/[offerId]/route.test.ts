import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  adminFrom: vi.fn(), insert: vi.fn(), registrarEvento: vi.fn(), ehBot: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/lib/db-admin', () => ({ supabaseAdmin: { from: mocks.adminFrom } }))
vi.mock('@/lib/eventos', () => ({ ehBot: mocks.ehBot, registrarEvento: mocks.registrarEvento }))

import { dynamic, GET } from './route'

const destination = "https://www.mercadolivre.com.br/social/revisada?ref=a'b%2Fc&wid=MLB54#fragmento"
const canary = 'https://secret.test/token?review_ref=sensitive-canary'

async function visit(id = '54', query = '?de=home&por=destaque') {
  return GET(new Request(`https://app.test/go/${id}${query}`, {
    headers: { referer: 'https://app.test/produtos', 'user-agent': 'synthetic-browser' },
  }), { params: Promise.resolve({ offerId: id }) })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle })
  mocks.maybeSingle.mockResolvedValue({ data: { id: 54, url: destination }, error: null })
  mocks.adminFrom.mockReturnValue({ insert: mocks.insert })
  mocks.insert.mockResolvedValue({ error: null })
  mocks.registrarEvento.mockResolvedValue(undefined)
  mocks.ehBot.mockReturnValue(false)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('/go/[offerId]', () => {
  it.each(['returned', 'thrown', 'ui-only'])('TestGoRoute_ShouldRedirectWithExactLocationWhenTrackingReturnsOrThrowsError (%s)', async failure => {
    if (failure === 'returned') mocks.insert.mockResolvedValue({ error: { message: canary } })
    if (failure === 'thrown') mocks.insert.mockRejectedValue(new Error(canary))
    mocks.registrarEvento.mockRejectedValue(new Error(canary))
    const response = await visit()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(destination)
    expect(mocks.adminFrom).toHaveBeenCalledExactlyOnceWith('click_event')
    expect(mocks.insert).toHaveBeenCalledExactlyOnceWith({
      offer_id: 54, referrer: 'https://app.test/produtos', user_agent: 'synthetic-browser',
    })
    expect(mocks.registrarEvento).toHaveBeenCalledExactlyOnceWith({
      evento: 'saida_para_loja', superficie: 'home', criterio: 'destaque',
    })
    expect(vi.mocked(console.error).mock.calls).toStrictEqual([
      ...(failure === 'ui-only' ? [] : [['click_event_falhou', { offer_id: 54, code: 'write_failed' }]]),
      ['ui_event_falhou', { evento: 'saida_para_loja', code: 'write_failed' }],
    ])
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(canary)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(destination)
  })

  it.each(['http://example.test/path?x=%2F#frag', destination])('keeps successful tracking and exact safe location %s', async url => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: 54, url }, error: null })
    const response = await visit()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(url)
    expect(dynamic).toBe('force-dynamic')
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('offer')
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith('id, url')
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith('id', 54)
    expect(mocks.ehBot).toHaveBeenCalledExactlyOnceWith('synthetic-browser')
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each(['0', '-1', '1.5', 'invalid'])('rejects invalid offer id %s before lookup', async id => {
    const response = await visit(id)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.test/')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it.each([
    { data: null, error: null },
    { data: { id: 54, url: destination }, error: { message: canary } },
    ...['invalid-url', 'javascript:alert(1)', 'https://example.test/a b',
      'https://example.test/ação', 'https://example.test/\n', 'https://example.test/東京'].map(url => ({ data: { id: 54, url }, error: null })),
  ])('rejects missing, failed or unsafe persisted destinations', async result => {
    mocks.maybeSingle.mockResolvedValue(result)
    const response = await visit()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.test/')
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.registrarEvento).not.toHaveBeenCalled()
  })

  it.each([
    ['home', 'destaque'], ['lista', 'menor_preco'], ['comparador', 'menor_por_dose'], ['produto', 'menor_por_kg'],
    ['produto', null], ['lista', 'invalid'],
  ])('records validated surface %s and criterion %s', async (surface, criterion) => {
    await visit('54', `?de=${surface}${criterion === null ? '' : `&por=${criterion}`}`)
    expect(mocks.registrarEvento).toHaveBeenCalledExactlyOnceWith({
      evento: 'saida_para_loja', superficie: surface, criterio: criterion === 'invalid' ? null : criterion,
    })
  })

  it.each(['', '?de=invalid'])('omits UI event for absent or invalid surface %s', async query => {
    expect((await visit('54', query)).status).toBe(302)
    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(mocks.registrarEvento).not.toHaveBeenCalled()
  })

  it('omits UI event for bots', async () => {
    mocks.ehBot.mockReturnValue(true)
    expect((await visit()).status).toBe(302)
    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(mocks.registrarEvento).not.toHaveBeenCalled()
  })
})
