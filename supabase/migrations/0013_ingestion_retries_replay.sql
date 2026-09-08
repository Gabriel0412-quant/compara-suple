create table ingestion_replay_audit (
  id bigserial primary key,
  run_id uuid not null references ingestion_run(id) on delete restrict,
  item_id bigint references ingestion_run_item(id) on delete restrict,
  include_completed boolean not null default false,
  requeued_count integer not null check (requeued_count >= 0),
  prior_run_state text not null check (prior_run_state in (
    'pending', 'running', 'succeeded', 'partial_failed', 'failed', 'blocked'
  )),
  created_at timestamptz not null default now()
);

create index ingestion_replay_audit_run_created_idx
  on ingestion_replay_audit (run_id, created_at desc);

drop function public.claim_ingestion_batch(uuid, uuid, integer, timestamptz, integer);

alter table ingestion_replay_audit enable row level security;
revoke all on table ingestion_replay_audit from public, anon, authenticated;
grant select, insert on table ingestion_replay_audit to service_role;
grant usage, select on sequence ingestion_replay_audit_id_seq to service_role;

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
    or (old.state = 'blocked' and new.state in ('running', 'pending', 'failed'))
    or (old.state in ('succeeded', 'partial_failed', 'failed') and new.state = 'pending')
  ) then
    raise exception 'invalid_ingestion_run_transition' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

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
    or (old.state = 'retry_scheduled' and new.state in ('processing', 'pending'))
    or (old.state in ('succeeded', 'failed', 'skipped') and new.state = 'pending')
  ) then
    raise exception 'invalid_ingestion_run_item_transition' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.claim_ingestion_batch(
  p_run_id uuid,
  p_worker_id uuid,
  p_limit integer,
  p_now timestamptz,
  p_lease_seconds integer
) returns table (item_id bigint, item_key text, attempt_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  if p_limit not between 1 and 50 or p_worker_id is null or p_lease_seconds not between 1 and 900 then
    raise exception 'invalid_ingestion_claim_input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from ingestion_run
     where id = p_run_id
       and state = 'running'
       and lease_id = p_worker_id
       and lease_expires_at > v_now
  ) then
    raise exception 'ingestion_lease_not_owned' using errcode = '42501';
  end if;

  update ingestion_run_item
     set state = 'pending',
         claimed_by = null,
         claim_expires_at = null,
         started_at = null
   where run_id = p_run_id
     and state = 'processing'
     and claim_expires_at <= v_now;

  return query
  with candidates as (
    select id
      from ingestion_run_item
     where run_id = p_run_id
       and (
         state = 'pending'
         or (state = 'retry_scheduled' and next_retry_at <= v_now)
       )
     order by coalesce(next_retry_at, created_at), id
     limit p_limit
     for update skip locked
  ), claimed as (
    update ingestion_run_item item
       set state = 'processing',
           attempt_count = item.attempt_count + 1,
           next_retry_at = null,
           claimed_by = p_worker_id,
           claim_expires_at = v_now + make_interval(secs => p_lease_seconds),
           started_at = coalesce(item.started_at, v_now)
      from candidates
     where item.id = candidates.id
     returning item.id, item.item_key, item.attempt_count
  )
  select claimed.id, claimed.item_key, claimed.attempt_count from claimed order by claimed.id;
end;
$$;

create or replace function public.record_ingestion_item_outcome(
  p_run_id uuid,
  p_item_id bigint,
  p_worker_id uuid,
  p_outcome text,
  p_error_code text,
  p_next_retry_at timestamptz,
  p_now timestamptz
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  if p_outcome not in ('succeeded', 'retry_scheduled', 'failed')
     or (p_outcome = 'succeeded' and p_error_code is not null)
     or (p_outcome = 'retry_scheduled' and p_next_retry_at is null)
     or (p_outcome <> 'retry_scheduled' and p_next_retry_at is not null)
     or (p_error_code is not null and char_length(p_error_code) > 64) then
    raise exception 'invalid_ingestion_item_outcome' using errcode = '22023';
  end if;

  update ingestion_run_item
     set state = p_outcome,
         error_code = p_error_code,
         next_retry_at = p_next_retry_at,
         claimed_by = null,
         claim_expires_at = null,
         completed_at = case when p_outcome = 'retry_scheduled' then null else v_now end
   where id = p_item_id
     and run_id = p_run_id
     and state = 'processing'
     and claimed_by = p_worker_id
     and claim_expires_at > v_now;
  if not found then
    raise exception 'ingestion_item_claim_not_owned' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.block_ingestion_run(
  p_run_id uuid,
  p_worker_id uuid,
  p_item_id bigint,
  p_error_code text,
  p_now timestamptz
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  if nullif(btrim(p_error_code), '') is null or char_length(p_error_code) > 64 then
    raise exception 'invalid_ingestion_block_input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from ingestion_run
     where id = p_run_id
       and state = 'running'
       and lease_id = p_worker_id
       and lease_expires_at > v_now
  ) then
    raise exception 'ingestion_lease_not_owned' using errcode = '42501';
  end if;

  update ingestion_run_item
     set state = 'pending',
         error_code = left(p_error_code, 64),
         claimed_by = null,
         claim_expires_at = null,
         started_at = null
   where id = p_item_id
     and run_id = p_run_id
     and state = 'processing'
     and claimed_by = p_worker_id;
  if not found then
    raise exception 'ingestion_item_claim_not_owned' using errcode = '42501';
  end if;

  update ingestion_run
     set state = 'blocked',
         error_code = left(p_error_code, 64),
         lease_id = null,
         lease_expires_at = null,
         heartbeat_at = v_now
   where id = p_run_id;
end;
$$;

create or replace function public.finalize_ingestion_run(
  p_run_id uuid,
  p_worker_id uuid,
  p_now timestamptz
) returns table (
  state text,
  item_total integer,
  item_succeeded integer,
  item_failed integer,
  item_skipped integer,
  item_retry_scheduled integer
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_run ingestion_run%rowtype;
  v_pending integer;
  v_total integer;
  v_succeeded integer;
  v_failed integer;
  v_skipped integer;
  v_retry_scheduled integer;
begin
  select * into v_run from ingestion_run where id = p_run_id for update;
  if not found or v_run.state <> 'running' or v_run.lease_id <> p_worker_id or v_run.lease_expires_at <= v_now then
    raise exception 'ingestion_lease_not_owned' using errcode = '42501';
  end if;

  update ingestion_run_item as item
     set state = 'pending',
         claimed_by = null,
         claim_expires_at = null,
         started_at = null
   where item.run_id = p_run_id
     and item.state = 'processing'
     and item.claimed_by = p_worker_id;

  select count(*) filter (where item.state in ('pending', 'processing', 'retry_scheduled'))
    into v_pending from ingestion_run_item as item where item.run_id = p_run_id;
  select count(*) into v_total from ingestion_run_item as item where item.run_id = p_run_id;
  select count(*) filter (where item.state = 'succeeded'),
         count(*) filter (where item.state = 'failed'),
         count(*) filter (where item.state = 'skipped'),
         count(*) filter (where item.state = 'retry_scheduled')
    into v_succeeded, v_failed, v_skipped, v_retry_scheduled
    from ingestion_run_item as item where item.run_id = p_run_id;

  update ingestion_run
     set item_total = v_total,
         item_succeeded = v_succeeded,
         item_failed = v_failed,
         item_skipped = v_skipped,
         item_retry_scheduled = v_retry_scheduled,
         state = case when v_pending > 0 then 'running'
                      when v_failed + v_skipped > 0 then 'partial_failed'
                      else 'succeeded' end,
         completed_at = case when v_pending > 0 then null else v_now end,
         lease_id = case when v_pending > 0 then lease_id else null end,
         lease_expires_at = case when v_pending > 0 then v_now else null end
   where id = p_run_id;
  state := case when v_pending > 0 then 'running'
                when v_failed + v_skipped > 0 then 'partial_failed'
                else 'succeeded' end;
  item_total := v_total;
  item_succeeded := v_succeeded;
  item_failed := v_failed;
  item_skipped := v_skipped;
  item_retry_scheduled := v_retry_scheduled;
  return next;
end;
$$;

create or replace function public.replay_ingestion_run(
  p_run_id uuid,
  p_item_id bigint default null,
  p_include_completed boolean default false,
  p_now timestamptz default null
) returns table (state text, requeued_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_run ingestion_run%rowtype;
  v_selected integer;
  v_requeued integer;
begin
  select * into v_run from ingestion_run where id = p_run_id for update;
  if not found then
    raise exception 'ingestion_replay_scope_invalid' using errcode = '22023';
  end if;
  if v_run.state = 'running' then
    raise exception 'ingestion_replay_run_busy' using errcode = '55P03';
  end if;
  if p_item_id is not null and not exists (
    select 1 from ingestion_run_item where id = p_item_id and run_id = p_run_id
  ) then
    raise exception 'ingestion_replay_scope_invalid' using errcode = '22023';
  end if;

  select count(*) into v_selected
    from ingestion_run_item as item
   where item.run_id = p_run_id
     and (p_item_id is null or item.id = p_item_id)
     and (
       item.state in ('pending', 'retry_scheduled')
       or (p_include_completed and item.state in ('succeeded', 'failed', 'skipped'))
     );

  update ingestion_run_item as item
     set state = 'pending',
         error_code = null,
         next_retry_at = null,
         claimed_by = null,
         claim_expires_at = null,
         started_at = null,
         completed_at = null
   where item.run_id = p_run_id
     and (p_item_id is null or item.id = p_item_id)
     and (
       item.state = 'retry_scheduled'
       or (p_include_completed and item.state in ('succeeded', 'failed', 'skipped'))
     );
  get diagnostics v_requeued = row_count;

  if v_selected > 0 then
    update ingestion_run
       set state = 'pending',
           error_code = null,
           started_at = null,
           completed_at = null,
           heartbeat_at = null,
           lease_id = null,
           lease_expires_at = null
     where id = p_run_id;
  end if;

  insert into ingestion_replay_audit (
    run_id, item_id, include_completed, requeued_count, prior_run_state, created_at
  ) values (
    p_run_id, p_item_id, p_include_completed, v_requeued, v_run.state, v_now
  );

  state := case when v_selected > 0 then 'pending' else v_run.state end;
  requeued_count := v_requeued;
  return next;
end;
$$;

revoke all on function public.claim_ingestion_batch(uuid, uuid, integer, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.record_ingestion_item_outcome(uuid, bigint, uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.block_ingestion_run(uuid, uuid, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_ingestion_run(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.replay_ingestion_run(uuid, bigint, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_ingestion_batch(uuid, uuid, integer, timestamptz, integer) to service_role;
grant execute on function public.record_ingestion_item_outcome(uuid, bigint, uuid, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.block_ingestion_run(uuid, uuid, bigint, text, timestamptz) to service_role;
grant execute on function public.finalize_ingestion_run(uuid, uuid, timestamptz) to service_role;
grant execute on function public.replay_ingestion_run(uuid, bigint, boolean, timestamptz) to service_role;
