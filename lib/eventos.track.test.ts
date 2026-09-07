import { describe, expect, it, vi } from 'vitest'

const { insert, from } = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn() }))

vi.mock('./db-admin', () => ({
  supabaseAdmin: { from },
}))

import { registrarEvento } from './eventos'

describe('registrarEvento', () => {
  it.each([
    ['returned', () => insert.mockResolvedValueOnce({ error: { message: 'ui-external-canary' } })],
    ['thrown', () => insert.mockRejectedValueOnce(new Error('ui-external-canary'))],
  ])('sanitizes a %s persistence error', async (_case, setup) => {
    setup()
    from.mockReturnValue({ insert })
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(registrarEvento({ evento: 'saida_para_loja', superficie: 'home' })).resolves.toBeUndefined()

    expect(error).toHaveBeenCalledWith('ui_event_falhou', { evento: 'saida_para_loja', code: 'write_failed' })
    expect(JSON.stringify(error.mock.calls)).not.toContain('ui-external-canary')
    error.mockRestore()
  })
  it('writes the event to the correct table without logging a successful write', async () => {
    from.mockReturnValue({ insert })
    insert.mockResolvedValueOnce({ error: null })
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await registrarEvento({ evento: 'metodologia_aberta', superficie: 'produto' })
    expect(from).toHaveBeenLastCalledWith('ui_event')
    expect(insert).toHaveBeenLastCalledWith({
      evento: 'metodologia_aberta', superficie: 'produto', n_resultados: null,
      n_produtos: null, criterio: null, termo: null,
    })
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
