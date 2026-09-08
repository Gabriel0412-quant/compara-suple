import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0013_ingestion_retries_replay.sql'),
  'utf8',
).toLowerCase()

describe('ingestion retry and replay migration', () => {
  it('claims only pending work or retries whose scheduled instant has passed', () => {
    expect(migration).toContain("state = 'retry_scheduled' and next_retry_at <= v_now")
    expect(migration).toContain('attempt_count = item.attempt_count + 1')
  })

  it('persists a sanitized outcome and prevents retry loops from bypassing transitions', () => {
    expect(migration).toContain('function public.record_ingestion_item_outcome')
    expect(migration).toContain("p_outcome not in ('succeeded', 'retry_scheduled', 'failed')")
    expect(migration).toContain("old.state = 'processing' and new.state in")
  })

  it('blocks a run while preserving its claimed item as pending work', () => {
    expect(migration).toContain('function public.block_ingestion_run')
    expect(migration).toContain("set state = 'pending'")
    expect(migration).toContain("set state = 'blocked'")
  })

  it('audits a replay and keeps completed items closed unless explicitly requested', () => {
    expect(migration).toContain('create table ingestion_replay_audit')
    expect(migration).toContain('function public.replay_ingestion_run')
    expect(migration).toContain('p_include_completed and item.state in')
    expect(migration).toContain('insert into ingestion_replay_audit')
  })

  it('restricts the new data and RPCs to service role', () => {
    expect(migration).toContain('revoke all on table ingestion_replay_audit from public, anon, authenticated')
    expect(migration).toContain('grant select, insert on table ingestion_replay_audit to service_role')
    expect(migration).toContain('grant execute on function public.replay_ingestion_run')
    expect(migration).not.toContain('security definer')
  })
})
