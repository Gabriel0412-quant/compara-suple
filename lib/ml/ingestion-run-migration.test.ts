import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0010_ingestion_runs.sql'),
  'utf8',
).toLowerCase()

describe('ingestion run migration', () => {
  it('creates durable runs and items with unique identities', () => {
    expect(migration).toContain('create table if not exists ingestion_run')
    expect(migration).toContain('create table if not exists ingestion_run_item')
    expect(migration).toContain('ingestion_run_identity_unique')
    expect(migration).toContain('ingestion_run_item_identity_unique')
  })

  it('enforces a single active run per ingestion type', () => {
    expect(migration).toContain('ingestion_run_one_running_per_type_idx')
    expect(migration).toContain("where state = 'running'")
  })

  it('indexes ready retries, stale claims and recent executions', () => {
    expect(migration).toContain('ingestion_run_latest_idx')
    expect(migration).toContain('ingestion_run_stale_lease_idx')
    expect(migration).toContain('ingestion_run_item_ready_idx')
    expect(migration).toContain('ingestion_run_item_stale_claim_idx')
  })

  it('protects state transitions and immutable identities', () => {
    expect(migration).toContain('invalid_ingestion_run_transition')
    expect(migration).toContain('invalid_ingestion_run_item_transition')
    expect(migration).toContain('immutable_ingestion_run_field')
    expect(migration).toContain('immutable_ingestion_run_item_field')
  })

  it('allows only service role access', () => {
    for (const table of ['ingestion_run', 'ingestion_run_item']) {
      expect(migration).toContain(
        `alter table ${table} enable row level security`,
      )
      expect(migration).toContain(
        `revoke all on table ${table} from public, anon, authenticated`,
      )
      expect(migration).toContain(
        `grant select, insert, update, delete on table ${table} to service_role`,
      )
    }
  })

  it('creates an idempotent atomic creation function', () => {
    expect(migration).toContain('function public.create_ingestion_run')
    expect(migration).toContain(
      'on conflict (ingestion_type, idempotency_key) do nothing',
    )
    expect(migration).toContain(
      'grant execute on function public.create_ingestion_run',
    )
    expect(migration).not.toContain('security definer')
  })
})

