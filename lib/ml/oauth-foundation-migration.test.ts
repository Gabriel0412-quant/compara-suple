import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0007_secure_ml_oauth_foundation.sql'),
  'utf8',
).toLowerCase()

describe('secure ML OAuth foundation migration', () => {
  it('creates single-use OAuth attempts protected by RLS', () => {
    expect(migration).toContain('create table if not exists ml_oauth_attempt')
    expect(migration).toContain('state_hash')
    expect(migration).toContain('consumed_at')
    expect(migration).toContain('alter table ml_oauth_attempt enable row level security')
  })

  it('adds encrypted connection metadata and refresh lease fields', () => {
    expect(migration).toContain('token_payload')
    expect(migration).toContain('token_key_version')
    expect(migration).toContain('connection_state')
    expect(migration).toContain('refresh_lease_id')
    expect(migration).toContain('refresh_lease_expires_at')
  })

  it.each([
    'consume_ml_oauth_attempt',
    'acquire_ml_refresh_lease',
    'complete_ml_token_refresh',
    'release_ml_refresh_lease',
  ])('defines the atomic function %s', functionName => {
    expect(migration).toContain(`function public.${functionName}`)
    expect(migration).toContain(
      `revoke all on function public.${functionName}`,
    )
    expect(migration).toContain(
      `grant execute on function public.${functionName}`,
    )
  })

  it('does not elevate function execution privileges', () => {
    expect(migration).not.toContain('security definer')
  })

  it('keeps legacy columns only as nullable rollout compatibility', () => {
    expect(migration).toContain('alter column access_token drop not null')
    expect(migration).toContain('alter column refresh_token drop not null')
    expect(migration).not.toContain('drop column access_token')
    expect(migration).not.toContain('drop column refresh_token')
  })
})
