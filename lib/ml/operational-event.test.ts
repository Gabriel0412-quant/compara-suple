import { afterEach, describe, expect, it, vi } from 'vitest'

import { logMlOAuthEvent } from './operational-event'

describe('ML OAuth operational events', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs only categorized operational fields', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    logMlOAuthEvent({
      event: 'connected',
      result: 'success',
      durationMs: 12.6,
    })

    expect(info).toHaveBeenCalledWith('ml_oauth_event', {
      event: 'connected',
      result: 'success',
      duration_ms: 13,
    })
  })

  it('logs failures with a stable code', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logMlOAuthEvent({
      event: 'refresh',
      result: 'failure',
      durationMs: 5,
      code: 'invalid_grant',
    })

    expect(error).toHaveBeenCalledWith('ml_oauth_event', {
      event: 'refresh',
      result: 'failure',
      duration_ms: 5,
      code: 'invalid_grant',
    })
  })
})
