import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0014_ingestion_observability.sql'),
  'utf8',
).toLowerCase()

describe('ingestion observability migration', () => {
  it('creates a service-only durable alert ledger with recovery state', () => {
    expect(migration).toContain('create table ingestion_alert')
    expect(migration).toContain("state in ('open', 'resolved')")
    expect(migration).toContain('revoke all on table ingestion_alert from public, anon, authenticated')
  })

  it('provides a sanitized operational read model and deduplicated alert transitions', () => {
    expect(migration).toContain('function public.get_ingestion_operational_status')
    expect(migration).toContain('function public.record_ingestion_alert')
    expect(migration).toContain("event := case when emitted then 'reminded' else 'deduplicated' end")
    expect(migration).toContain("event := 'recovered'")
  })

  it('does not use security definer or expose RPCs to public roles', () => {
    expect(migration).not.toContain('security definer')
    expect(migration).toContain('grant execute on function public.get_ingestion_operational_status')
    expect(migration).toContain('grant execute on function public.record_ingestion_alert')
  })
})
