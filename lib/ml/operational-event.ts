export type MlOAuthOperationalEvent = {
  event: string
  result: 'started' | 'success' | 'failure'
  durationMs: number
  code?: string
}

export function logMlOAuthEvent(input: MlOAuthOperationalEvent): void {
  const payload = {
    event: input.event,
    result: input.result,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    ...(input.code ? { code: input.code } : {}),
  }
  if (input.result === 'failure') {
    console.error('ml_oauth_event', payload)
    return
  }
  console.info('ml_oauth_event', payload)
}
