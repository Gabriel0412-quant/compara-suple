create table ingestion_alert (
  alert_key text primary key check (alert_key in (
    'price_stale', 'run_stuck', 'auth_blocked', 'run_failed'
  )),
  state text not null check (state in ('open', 'resolved')),
  run_id uuid references ingestion_run(id) on delete set null,
  opened_at timestamptz,
  last_seen_at timestamptz,
  last_notified_at timestamptz,
  resolved_at timestamptz,
  occurrence_count integer not null default 0 check (occurrence_count >= 0),
  updated_at timestamptz not null default now(),
  constraint ingestion_alert_timestamps_check check (
    (state = 'open' and opened_at is not null and last_seen_at is not null and resolved_at is null)
    or (state = 'resolved' and resolved_at is not null)
  )
);

alter table ingestion_alert enable row level security;
revoke all on table ingestion_alert from public, anon, authenticated;
grant select, insert, update on table ingestion_alert to service_role;

create or replace function public.get_ingestion_operational_status(
  p_ingestion_type text,
  p_now timestamptz default null
) returns table (
  run_id uuid,
  run_state text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  heartbeat_at timestamptz,
  lease_expires_at timestamptz,
  item_total integer,
  item_succeeded integer,
  item_failed integer,
  item_retry_scheduled integer,
  item_skipped integer,
  last_valid_price_at timestamptz,
  lease_expired boolean,
  auth_blocked boolean
)
language sql
stable
set search_path = public
as $$
  with latest_run as (
    select *
      from ingestion_run
     where ingestion_type = btrim(p_ingestion_type)
     order by created_at desc
     limit 1
  ), latest_price as (
    select max(fetched_at) as fetched_at
      from offer
     where available = true
  ), auth as (
    select exists (
      select 1
        from ml_oauth_tokens
       where connection_state = 'reconnect_required'
    ) as reconnect_required
  )
  select
    run.id,
    run.state,
    run.started_at,
    run.completed_at,
    run.created_at,
    run.heartbeat_at,
    run.lease_expires_at,
    coalesce(run.item_total, 0),
    coalesce(run.item_succeeded, 0),
    coalesce(run.item_failed, 0),
    coalesce(run.item_retry_scheduled, 0),
    coalesce(run.item_skipped, 0),
    price.fetched_at,
    coalesce(run.state = 'running' and run.lease_expires_at <= coalesce(p_now, now()), false),
    coalesce(run.state = 'blocked' and run.error_code like 'oauth_%', false)
      or auth.reconnect_required
  from (select true as singleton) as fallback
  left join latest_run as run on true
  cross join latest_price as price
  cross join auth;
$$;

create or replace function public.record_ingestion_alert(
  p_alert_key text,
  p_active boolean,
  p_run_id uuid,
  p_now timestamptz default null,
  p_dedup_minutes integer default 60
) returns table (event text, emitted boolean)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_alert ingestion_alert%rowtype;
begin
  if p_alert_key not in ('price_stale', 'run_stuck', 'auth_blocked', 'run_failed')
     or p_dedup_minutes not between 1 and 1440 then
    raise exception 'invalid_ingestion_alert_input' using errcode = '22023';
  end if;

  select * into v_alert from ingestion_alert where alert_key = p_alert_key for update;
  if p_active then
    if not found then
      insert into ingestion_alert (
        alert_key, state, run_id, opened_at, last_seen_at, last_notified_at, occurrence_count, updated_at
      ) values (
        p_alert_key, 'open', p_run_id, v_now, v_now, v_now, 1, v_now
      );
      event := 'opened';
      emitted := true;
      return next;
      return;
    end if;

    if v_alert.state = 'resolved' then
      update ingestion_alert
         set state = 'open', run_id = p_run_id, opened_at = v_now, last_seen_at = v_now,
             last_notified_at = v_now, resolved_at = null, occurrence_count = v_alert.occurrence_count + 1,
             updated_at = v_now
       where alert_key = p_alert_key;
      event := 'reopened';
      emitted := true;
      return next;
      return;
    end if;

    emitted := v_alert.last_notified_at <= v_now - make_interval(mins => p_dedup_minutes);
    update ingestion_alert
       set run_id = p_run_id,
           last_seen_at = v_now,
           last_notified_at = case when emitted then v_now else last_notified_at end,
           occurrence_count = v_alert.occurrence_count + 1,
           updated_at = v_now
     where alert_key = p_alert_key;
    event := case when emitted then 'reminded' else 'deduplicated' end;
    return next;
    return;
  end if;

  if found and v_alert.state = 'open' then
    update ingestion_alert
       set state = 'resolved', resolved_at = v_now, updated_at = v_now
     where alert_key = p_alert_key;
    event := 'recovered';
    emitted := true;
    return next;
    return;
  end if;

  event := 'quiet';
  emitted := false;
  return next;
end;
$$;

revoke all on function public.get_ingestion_operational_status(text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_ingestion_alert(text, boolean, uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_ingestion_operational_status(text, timestamptz) to service_role;
grant execute on function public.record_ingestion_alert(text, boolean, uuid, timestamptz, integer) to service_role;
