import { afterEach, describe, expect, it, vi } from 'vitest'

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))

vi.mock('../db-admin', () => ({ supabaseAdmin: { from, rpc } }))

import { runDefaultAffiliateLinksCli } from './affiliate-links-cli'

const originalArgv = process.argv
const originalExitCode = process.exitCode

afterEach(() => {
  process.argv = originalArgv
  process.exitCode = originalExitCode
  vi.restoreAllMocks()
  from.mockReset()
  rpc.mockReset()
})

function chain(result: unknown) {
  const value = Promise.resolve(result)
  const range = vi.fn(() => value)
  const order = vi.fn(() => ({ range }))
  const eqCatalog = vi.fn(() => ({ order }))
  const eqStore = vi.fn(() => ({ eq: eqCatalog }))
  const single = vi.fn(() => value)
  const eqSlug = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq: eqStore }))
  return { select, eqSlug, eqStore, eqCatalog, order, range }
}

describe('runDefaultAffiliateLinksCli', () => {
  it('paginates offers, resolves the store and invokes the RPC with its real id', async () => {
    process.argv = ['node', 'script', '--apply', '--rollback', '--catalog', 'MLB1']
    const store = chain({ data: { id: 77 }, error: null })
    const first = chain({ data: Array.from({ length: 500 }, (_, index) => ({ external_id: `MLB${index + 1}`, source_catalog_id: 'MLB1', raw: { seller_id: 9 } })), error: null })
    const second = chain({ data: [{ external_id: 'MLB501', source_catalog_id: 'MLB1', raw: { seller_id: 9 } }], error: null })
    const storeSelect = vi.fn(() => ({ eq: store.eqSlug }))
    from.mockImplementationOnce(() => ({ select: storeSelect }))
    from.mockImplementationOnce(() => ({ select: first.select }))
    from.mockImplementationOnce(() => ({ select: second.select }))
    rpc.mockResolvedValue({ data: { recebidas: 501, alteradas: 501, iguais: 0 }, error: null })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await runDefaultAffiliateLinksCli()

    expect(from).toHaveBeenNthCalledWith(1, 'store')
    expect(from).toHaveBeenNthCalledWith(2, 'offer')
    expect(from).toHaveBeenNthCalledWith(3, 'offer')
    expect(storeSelect).toHaveBeenCalledWith('id')
    expect(store.eqSlug).toHaveBeenCalledWith('slug', 'mercado-livre')
    expect(first.select).toHaveBeenCalledWith('external_id, source_catalog_id, raw')
    expect(first.eqStore).toHaveBeenCalledWith('store_id', 77)
    expect(first.eqCatalog).toHaveBeenCalledWith('source_catalog_id', 'MLB1')
    expect(first.order).toHaveBeenCalledWith('id')
    expect(first.range).toHaveBeenCalledWith(0, 499)
    expect(second.range).toHaveBeenCalledWith(500, 999)
    expect(rpc).toHaveBeenCalledWith('aplicar_links_afiliados_ml', expect.objectContaining({ p_store_id: 77, p_catalog_id: 'MLB1', p_simular: false }))
    const payload = rpc.mock.calls[0]?.[1] as { p_items: Array<{ external_id: string; seller_id: number; url: string; affiliate_link: { destination: string } }> }
    expect(payload.p_items).toHaveLength(501)
    expect(payload.p_items[0]).toEqual({
      external_id: 'MLB1',
      seller_id: 9,
      url: 'https://www.mercadolivre.com.br/p/MLB1?wid=MLB1',
      affiliate_link: { origin: 'none', validation: 'absent', destination: 'untracked_fallback', reason: 'fallback_absent' },
    })
    expect(payload.p_items[500]?.external_id).toBe('MLB501')
    expect(info).toHaveBeenCalledWith('ml_affiliate_links_completed', { catalog_id: 'MLB1', simulado: false, recebidas: 501, alteradas: 501, iguais: 0 })
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    ['missing store', () => {
      from.mockReturnValue({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'raw-canary' } }) }) }),
      })
    }],
    ['invalid seller', () => {
      const store = chain({ data: { id: 77 }, error: null })
      const offers = chain({ data: [{ external_id: 'MLB1', source_catalog_id: 'MLB1', raw: {} }], error: null })
      from.mockImplementationOnce(() => ({ select: () => ({ eq: store.eqSlug }) })).mockImplementationOnce(() => ({ select: offers.select }))
    }],
    ['missing source catalog', () => {
      const store = chain({ data: { id: 77 }, error: null })
      const offers = chain({ data: [{ external_id: 'MLB1', source_catalog_id: null, raw: { seller_id: 9 } }], error: null })
      from.mockImplementationOnce(() => ({ select: () => ({ eq: store.eqSlug }) })).mockImplementationOnce(() => ({ select: offers.select }))
    }],
    ['rpc error', () => {
      const store = chain({ data: { id: 77 }, error: null })
      const offers = chain({ data: [], error: null })
      from.mockImplementationOnce(() => ({ select: () => ({ eq: store.eqSlug }) })).mockImplementationOnce(() => ({ select: offers.select }))
      rpc.mockResolvedValue({ data: { recebidas: 0, alteradas: 0, iguais: 0 }, error: { message: 'raw-canary' } })
    }],
  ])('emits a finite error for %s', async (_name, setup) => {
    process.argv = ['node', 'script', '--catalog', 'MLB1']
    setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await runDefaultAffiliateLinksCli()

    expect(error).toHaveBeenCalledWith('ml_affiliate_links_failed', { code: 'operation_failed' })
    expect(JSON.stringify(error.mock.calls)).not.toContain('raw-canary')
    expect(process.exitCode).toBe(1)
  })

  it('reports a finite configuration failure when loading the server client fails', async () => {
    process.argv = ['node', 'script', '--catalog', 'MLB1']
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await runDefaultAffiliateLinksCli(async () => { throw new Error('raw-configuration-canary') })

    expect(error).toHaveBeenCalledWith('ml_affiliate_links_failed', { code: 'configuration_error' })
    expect(JSON.stringify(error.mock.calls)).not.toContain('raw-configuration-canary')
    expect(process.exitCode).toBe(1)
  })
})
