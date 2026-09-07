create or replace function public.acquire_ingestion_run(
  p_ingestion_type text,
  p_idempotency_key text,
  p_trigger_source text,
  p_item_keys text[],
  p_code_version text,
  p_worker_id uuid,
  p_now timestamptz,
  p_lease_seconds integer
) returns table (run_id uuid, disposition text, state text)
language plpgsql
set search_path = public
as $$
declare
  v_run ingestion_run%rowtype;
  v_now timestamptz := coalesce(p_now, now());
begin
  if p_worker_id is null or p_lease_seconds not between 1 and 900 then
    raise exception 'invalid_ingestion_lease_input' using errcode = '22023';
  end if;

  select run.* into v_run
    from ingestion_run as run
   where run.ingestion_type = btrim(p_ingestion_type)
     and run.state in ('pending', 'running', 'blocked')
   order by run.created_at
   limit 1
   for update;

  if not found then
    perform create_ingestion_run(
      p_ingestion_type, p_idempotency_key, p_trigger_source, p_item_keys, p_code_version
    );
    select run.* into v_run
      from ingestion_run as run
     where run.ingestion_type = btrim(p_ingestion_type)
       and run.idempotency_key = btrim(p_idempotency_key)
     for update;
  end if;

  run_id := v_run.id;
  state := v_run.state;
  if v_run.state in ('succeeded', 'partial_failed', 'failed') then
    disposition := 'terminal';
    return next;
    return;
  end if;
  if v_run.state = 'blocked' then
    disposition := 'blocked';
    return next;
    return;
  end if;
  if v_run.state = 'running' and v_run.lease_expires_at > v_now then
    disposition := 'busy';
    return next;
    return;
  end if;

  update ingestion_run
     set state = 'running',
         started_at = coalesce(started_at, v_now),
         heartbeat_at = v_now,
         lease_id = p_worker_id,
         lease_expires_at = v_now + make_interval(secs => p_lease_seconds)
   where id = v_run.id;

  disposition := 'acquired';
  state := 'running';
  return next;
end;
$$;

create or replace function public.claim_ingestion_batch(
  p_run_id uuid,
  p_worker_id uuid,
  p_limit integer,
  p_now timestamptz,
  p_lease_seconds integer
) returns table (item_id bigint, item_key text)
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
       and state = 'pending'
     order by id
     limit p_limit
     for update skip locked
  ), claimed as (
    update ingestion_run_item item
       set state = 'processing',
           attempt_count = item.attempt_count + 1,
           claimed_by = p_worker_id,
           claim_expires_at = v_now + make_interval(secs => p_lease_seconds),
           started_at = coalesce(item.started_at, v_now)
      from candidates
     where item.id = candidates.id
     returning item.id, item.item_key
  )
  select claimed.id, claimed.item_key from claimed order by claimed.id;
end;
$$;

create or replace function public.heartbeat_ingestion_run(
  p_run_id uuid,
  p_worker_id uuid,
  p_now timestamptz,
  p_lease_seconds integer
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  if p_worker_id is null or p_lease_seconds not between 1 and 900 then
    raise exception 'invalid_ingestion_heartbeat_input' using errcode = '22023';
  end if;
  update ingestion_run
     set heartbeat_at = v_now,
         lease_expires_at = v_now + make_interval(secs => p_lease_seconds)
   where id = p_run_id
     and state = 'running'
     and lease_id = p_worker_id
     and lease_expires_at > v_now;
  return found;
end;
$$;

create or replace function public.complete_ingestion_item(
  p_run_id uuid,
  p_item_id bigint,
  p_worker_id uuid,
  p_outcome text,
  p_error_code text,
  p_now timestamptz
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  if p_outcome not in ('succeeded', 'failed')
     or (p_outcome = 'succeeded' and p_error_code is not null)
     or (p_error_code is not null and char_length(p_error_code) > 64) then
    raise exception 'invalid_ingestion_item_completion' using errcode = '22023';
  end if;
  update ingestion_run_item
     set state = p_outcome,
         error_code = p_error_code,
         claimed_by = null,
         claim_expires_at = null,
         completed_at = v_now
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

  select count(*) filter (where item.state in ('pending', 'processing'))
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

revoke all on function public.acquire_ingestion_run(text, text, text, text[], text, uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.claim_ingestion_batch(uuid, uuid, integer, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_ingestion_run(uuid, uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.complete_ingestion_item(uuid, bigint, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_ingestion_run(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.acquire_ingestion_run(text, text, text, text[], text, uuid, timestamptz, integer) to service_role;
grant execute on function public.claim_ingestion_batch(uuid, uuid, integer, timestamptz, integer) to service_role;
grant execute on function public.heartbeat_ingestion_run(uuid, uuid, timestamptz, integer) to service_role;
grant execute on function public.complete_ingestion_item(uuid, bigint, uuid, text, text, timestamptz) to service_role;
grant execute on function public.finalize_ingestion_run(uuid, uuid, timestamptz) to service_role;
