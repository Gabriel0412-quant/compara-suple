export const DEFAULT_READINESS_DEGRADED_AFTER_HOURS = 30
export const DEFAULT_READINESS_UNAVAILABLE_AFTER_HOURS = 72
export const DEFAULT_READINESS_TIMEOUT_MS = 2_000

export type ReadinessThresholds = {
  degradedAfterHours: number
  unavailableAfterHours: number
  timeoutMs: number
}

function positiveNumber(
  value: string | undefined,
  fallback: number,
  minimum: number,
): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback
}

export function getReadinessThresholds(
  env: Record<string, string | undefined> = process.env,
): ReadinessThresholds {
  const degradedAfterHours = positiveNumber(
    env.READINESS_DEGRADED_AFTER_HOURS,
    DEFAULT_READINESS_DEGRADED_AFTER_HOURS,
    1,
  )
  const configuredUnavailableAfterHours = positiveNumber(
    env.READINESS_UNAVAILABLE_AFTER_HOURS,
    DEFAULT_READINESS_UNAVAILABLE_AFTER_HOURS,
    degradedAfterHours + 1,
  )

  return {
    degradedAfterHours,
    unavailableAfterHours: Math.max(
      configuredUnavailableAfterHours,
      degradedAfterHours + 1,
    ),
    timeoutMs: positiveNumber(
      env.READINESS_TIMEOUT_MS,
      DEFAULT_READINESS_TIMEOUT_MS,
      100,
    ),
  }
}
