create table if not exists ml_oauth_attempt (
  state_hash  text primary key check (length(state_hash) = 64),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists ml_oauth_attempt_pending_expiry_idx
  on ml_oauth_attempt (expires_at)
  where consumed_at is null;

alter table ml_oauth_attempt enable row level security;
revoke all on table ml_oauth_attempt from public, anon, authenticated;
grant select, insert, update, delete on table ml_oauth_attempt to service_role;

alter table ml_oauth_tokens
  add column if not exists token_payload text,
  add column if not exists token_key_version integer,
  add column if not exists connection_state text not null default 'disconnected',
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists refresh_lease_id uuid,
  add column if not exists refresh_lease_expires_at timestamptz;

alter table ml_oauth_tokens
  alter column access_token drop not null,
  alter column refresh_token drop not null;

update ml_oauth_tokens
   set connection_state = 'connected'
 where access_token is not null
   and refresh_token is not null
   and connection_state = 'disconnected';

alter table ml_oauth_tokens
  drop constraint if exists ml_oauth_tokens_connection_state_check,
  add constraint ml_oauth_tokens_connection_state_check
    check (connection_state in (
      'disconnected', 'connected', 'refreshing', 'reconnect_required'
    )),
  drop constraint if exists ml_oauth_tokens_encrypted_payload_check,
  add constraint ml_oauth_tokens_encrypted_payload_check
    check (
      (token_payload is null and token_key_version is null)
      or
      (token_payload is not null and token_key_version is not null)
    ),
  drop constraint if exists ml_oauth_tokens_refresh_lease_check,
  add constraint ml_oauth_tokens_refresh_lease_check
    check (
      (refresh_lease_id is null and refresh_lease_expires_at is null)
      or
      (refresh_lease_id is not null and refresh_lease_expires_at is not null)
    );

alter table ml_oauth_tokens enable row level security;
revoke all on table ml_oauth_tokens from public, anon, authenticated;
grant select, insert, update, delete on table ml_oauth_tokens to service_role;

create or replace function public.consume_ml_oauth_attempt(
  p_state_hash text
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_consumed boolean;
begin
  update ml_oauth_attempt
     set consumed_at = now()
   where state_hash = p_state_hash
     and consumed_at is null
     and expires_at > now()
  returning true into v_consumed;

  return coalesce(v_consumed, false);
end;
$$;

create or replace function public.acquire_ml_refresh_lease(
  p_ml_user_id bigint,
  p_lease_id uuid,
  p_ttl_seconds integer default 30
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_acquired boolean;
begin
  if p_ttl_seconds < 5 or p_ttl_seconds > 300 then
    raise exception 'invalid_refresh_lease_ttl';
  end if;

  update ml_oauth_tokens
     set refresh_lease_id = p_lease_id,
         refresh_lease_expires_at = now() + make_interval(secs => p_ttl_seconds),
         connection_state = 'refreshing',
         updated_at = now()
   where ml_user_id = p_ml_user_id
     and token_payload is not null
     and connection_state in ('connected', 'refreshing')
     and (
       refresh_lease_id is null
       or refresh_lease_expires_at <= now()
     )
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

create or replace function public.complete_ml_token_refresh(
  p_ml_user_id bigint,
  p_lease_id uuid,
  p_token_payload text,
  p_token_key_version integer,
  p_expires_at timestamptz
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_completed boolean;
begin
  if nullif(p_token_payload, '') is null
     or p_token_key_version is null
     or p_expires_at <= now() then
    raise exception 'invalid_refreshed_token_payload';
  end if;

  update ml_oauth_tokens
     set token_payload = p_token_payload,
         token_key_version = p_token_key_version,
         expires_at = p_expires_at,
         connection_state = 'connected',
         last_refreshed_at = now(),
         last_error_code = null,
         refresh_lease_id = null,
         refresh_lease_expires_at = null,
         updated_at = now(),
         access_token = null,
         refresh_token = null
   where ml_user_id = p_ml_user_id
     and refresh_lease_id = p_lease_id
     and refresh_lease_expires_at > now()
  returning true into v_completed;

  return coalesce(v_completed, false);
end;
$$;

create or replace function public.release_ml_refresh_lease(
  p_ml_user_id bigint,
  p_lease_id uuid,
  p_error_code text,
  p_reconnect_required boolean default false
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_released boolean;
begin
  update ml_oauth_tokens
     set connection_state = case
           when p_reconnect_required then 'reconnect_required'
           else 'connected'
         end,
         last_error_code = left(nullif(p_error_code, ''), 64),
         refresh_lease_id = null,
         refresh_lease_expires_at = null,
         updated_at = now()
   where ml_user_id = p_ml_user_id
     and refresh_lease_id = p_lease_id
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;

revoke all on function public.consume_ml_oauth_attempt(text)
  from public, anon, authenticated;
revoke all on function public.acquire_ml_refresh_lease(bigint, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.complete_ml_token_refresh(bigint, uuid, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_ml_refresh_lease(bigint, uuid, text, boolean)
  from public, anon, authenticated;

grant execute on function public.consume_ml_oauth_attempt(text) to service_role;
grant execute on function public.acquire_ml_refresh_lease(bigint, uuid, integer) to service_role;
grant execute on function public.complete_ml_token_refresh(bigint, uuid, text, integer, timestamptz) to service_role;
grant execute on function public.release_ml_refresh_lease(bigint, uuid, text, boolean) to service_role;
