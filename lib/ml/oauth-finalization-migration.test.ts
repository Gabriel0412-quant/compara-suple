import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0009_finalize_ml_oauth_security.sql'),
  'utf8',
).toLowerCase()

describe('final ML OAuth security migration', () => {
  it('fails before dropping plaintext columns when encrypted backfill is missing', () => {
    expect(migration).toContain('ml_oauth_plaintext_backfill_required')
    expect(migration).toContain('where token_payload is null')
  })

  it('removes both legacy plaintext token columns', () => {
    expect(migration).toContain('drop column if exists access_token')
    expect(migration).toContain('drop column if exists refresh_token')
  })

  it('defines an atomic disconnect restricted to service_role', () => {
    expect(migration).toContain('function public.disconnect_ml_oauth')
    expect(migration).toContain('grant execute on function public.disconnect_ml_oauth')
    expect(migration).toContain('to service_role')
    expect(migration).not.toContain('security definer')
  })

  it('redefines refresh completion without plaintext references', () => {
    const functionBody = migration.slice(
      migration.indexOf('create or replace function public.complete_ml_token_refresh'),
      migration.indexOf('create or replace function public.disconnect_ml_oauth'),
    )
    expect(functionBody).not.toContain('access_token')
    expect(functionBody).not.toContain('refresh_token')
  })
})
