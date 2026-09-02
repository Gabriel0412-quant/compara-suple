create table if not exists ingestion_run (
  id uuid primary key default gen_random_uuid(),
  ingestion_type text not null,
  idempotency_key text not null,
  trigger_source text not null default 'cron',
  state text not null default 'pending',
  code_version text,
  item_total integer not null default 0,
  item_succeeded integer not null default 0,
  item_failed integer not null default 0,
  item_retry_scheduled integer not null default 0,
  item_skipped integer not null default 0,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  heartbeat_at timestamptz,
  lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingestion_run_identity_unique
    unique (ingestion_type, idempotency_key),
  constraint ingestion_run_type_check
    check (char_length(btrim(ingestion_type)) between 1 and 64),
  constraint ingestion_run_idempotency_key_check
    check (char_length(btrim(idempotency_key)) between 1 and 160),
  constraint ingestion_run_trigger_source_check
    check (trigger_source in ('cron', 'manual', 'retry', 'test')),
  constraint ingestion_run_state_check
    check (state in (
      'pending', 'running', 'succeeded', 'partial_failed', 'failed', 'blocked'
    )),
  constraint ingestion_run_code_version_check
    check (code_version is null or char_length(code_version) between 1 and 128),
  constraint ingestion_run_error_code_check
    check (error_code is null or char_length(error_code) between 1 and 64),
  constraint ingestion_run_counters_check
    check (
      item_total >= 0
      and item_succeeded >= 0
      and item_failed >= 0
      and item_retry_scheduled >= 0
      and item_skipped >= 0
      and item_succeeded + item_failed + item_retry_scheduled + item_skipped
        <= item_total
    ),
  constraint ingestion_run_lease_check
    check (
      (state = 'running'
        and lease_id is not null
        and lease_expires_at is not null
        and heartbeat_at is not null)
      or
      (state <> 'running'
        and lease_id is null
        and lease_expires_at is null)
    ),
  constraint ingestion_run_timestamps_check
    check (
      (state = 'pending' and started_at is null and completed_at is null)
      or
      (state in ('running', 'blocked')
        and started_at is not null
        and completed_at is null)
      or
      (state in ('succeeded', 'partial_failed', 'failed')
        and started_at is not null
        and completed_at is not null)
    )
);

create unique index if not exists ingestion_run_one_running_per_type_idx
  on ingestion_run (ingestion_type)
  where state = 'running';

create index if not exists ingestion_run_latest_idx
  on ingestion_run (ingestion_type, created_at desc);

create index if not exists ingestion_run_stale_lease_idx
  on ingestion_run (lease_expires_at)
  where state = 'running';

create table if not exists ingestion_run_item (
  id bigserial primary key,
  run_id uuid not null references ingestion_run(id) on delete cascade,
  item_key text not null,
  state text not null default 'pending',
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  claimed_by uuid,
  claim_expires_at timestamptz,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingestion_run_item_identity_unique unique (run_id, item_key),
  constraint ingestion_run_item_key_check
    check (char_length(btrim(item_key)) between 1 and 160),
  constraint ingestion_run_item_state_check
    check (state in (
      'pending', 'processing', 'succeeded', 'retry_scheduled', 'failed', 'skipped'
    )),
  constraint ingestion_run_item_attempt_count_check check (attempt_count >= 0),
  constraint ingestion_run_item_error_code_check
    check (error_code is null or char_length(error_code) between 1 and 64),
  constraint ingestion_run_item_claim_check
    check (
      (state = 'processing'
        and claimed_by is not null
        and claim_expires_at is not null
        and started_at is not null)
      or
      (state <> 'processing'
        and claimed_by is null
        and claim_expires_at is null)
    ),
  constraint ingestion_run_item_retry_check
    check (
      (state = 'retry_scheduled' and next_retry_at is not null)
      or
      (state <> 'retry_scheduled' and next_retry_at is null)
    ),
  constraint ingestion_run_item_completion_check
    check (
      (state in ('succeeded', 'failed', 'skipped') and completed_at is not null)
      or
      (state not in ('succeeded', 'failed', 'skipped') and completed_at is null)
    )
);

create index if not exists ingestion_run_item_ready_idx
  on ingestion_run_item (run_id, next_retry_at, id)
  where state in ('pending', 'retry_scheduled');

create index if not exists ingestion_run_item_stale_claim_idx
  on ingestion_run_item (claim_expires_at)
  where state = 'processing';

create or replace function public.validate_ingestion_run_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id
     or new.ingestion_type <> old.ingestion_type
     or new.idempotency_key <> old.idempotency_key
     or new.trigger_source <> old.trigger_source
     or new.created_at <> old.created_at then
    raise exception 'immutable_ingestion_run_field' using errcode = '23514';
  end if;

  if new.state <> old.state and not (
    (old.state = 'pending' and new.state in ('running', 'failed', 'blocked'))
    or (old.state = 'running' and new.state in (
      'succeeded', 'partial_failed', 'failed', 'blocked'
    ))
    or (old.state = 'blocked' and new.state in ('running', 'failed'))
  ) then
    raise exception 'invalid_ingestion_run_transition' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_ingestion_run_update_trigger
before update on ingestion_run
for each row execute function public.validate_ingestion_run_update();

create or replace function public.validate_ingestion_run_item_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id
     or new.run_id <> old.run_id
     or new.item_key <> old.item_key
     or new.created_at <> old.created_at then
    raise exception 'immutable_ingestion_run_item_field' using errcode = '23514';
  end if;

  if new.state <> old.state and not (
    (old.state = 'pending' and new.state in ('processing', 'skipped'))
    or (old.state = 'processing' and new.state in (
      'pending', 'succeeded', 'retry_scheduled', 'failed'
    ))
    or (old.state = 'retry_scheduled' and new.state in ('processing', 'failed'))
    or (old.state = 'failed' and new.state = 'pending')
  ) then
    raise exception 'invalid_ingestion_run_item_transition' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_ingestion_run_item_update_trigger
before update on ingestion_run_item
for each row execute function public.validate_ingestion_run_item_update();

create or replace function public.create_ingestion_run(
  p_ingestion_type text,
  p_idempotency_key text,
  p_trigger_source text,
  p_item_keys text[],
  p_code_version text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_run_id uuid;
  v_item_total integer;
begin
  if nullif(btrim(p_ingestion_type), '') is null
     or nullif(btrim(p_idempotency_key), '') is null
     or p_item_keys is null
     or cardinality(p_item_keys) = 0
     or exists (
       select 1 from unnest(p_item_keys) as item_key
       where nullif(btrim(item_key), '') is null
     ) then
    raise exception 'invalid_ingestion_run_input' using errcode = '22023';
  end if;

  insert into ingestion_run (
    ingestion_type,
    idempotency_key,
    trigger_source,
    code_version
  ) values (
    btrim(p_ingestion_type),
    btrim(p_idempotency_key),
    p_trigger_source,
    nullif(btrim(p_code_version), '')
  )
  on conflict (ingestion_type, idempotency_key) do nothing
  returning id into v_run_id;

  if v_run_id is null then
    select id into v_run_id
      from ingestion_run
     where ingestion_type = btrim(p_ingestion_type)
       and idempotency_key = btrim(p_idempotency_key);

    return v_run_id;
  end if;

  insert into ingestion_run_item (run_id, item_key)
  select v_run_id, normalized.item_key
    from (
      select distinct btrim(item_key) as item_key
        from unnest(p_item_keys) as item_key
    ) as normalized
   order by normalized.item_key;

  get diagnostics v_item_total = row_count;

  update ingestion_run
     set item_total = v_item_total
   where id = v_run_id;

  return v_run_id;
end;
$$;

alter table ingestion_run enable row level security;
alter table ingestion_run_item enable row level security;

revoke all on table ingestion_run from public, anon, authenticated;
revoke all on table ingestion_run_item from public, anon, authenticated;
revoke all on sequence ingestion_run_item_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table ingestion_run to service_role;
grant select, insert, update, delete on table ingestion_run_item to service_role;
grant usage, select on sequence ingestion_run_item_id_seq to service_role;

revoke all on function public.create_ingestion_run(text, text, text, text[], text)
  from public, anon, authenticated;
grant execute on function public.create_ingestion_run(text, text, text, text[], text)
  to service_role;

revoke all on function public.validate_ingestion_run_update()
  from public, anon, authenticated;
revoke all on function public.validate_ingestion_run_item_update()
  from public, anon, authenticated;

