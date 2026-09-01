do $$
begin
  if exists (
    select 1
      from ml_oauth_tokens
     where token_payload is null
        or token_key_version is null
  ) then
    raise exception 'ml_oauth_plaintext_backfill_required';
  end if;
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
         updated_at = now()
   where ml_user_id = p_ml_user_id
     and refresh_lease_id = p_lease_id
     and refresh_lease_expires_at > now()
  returning true into v_completed;

  return coalesce(v_completed, false);
end;
$$;

create or replace function public.disconnect_ml_oauth(
  p_ml_user_id bigint
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_disconnected boolean;
begin
  update ml_oauth_tokens
     set token_payload = null,
         token_key_version = null,
         connection_state = 'disconnected',
         last_error_code = null,
         refresh_lease_id = null,
         refresh_lease_expires_at = null,
         updated_at = now()
   where ml_user_id = p_ml_user_id
  returning true into v_disconnected;

  return coalesce(v_disconnected, false);
end;
$$;

alter table ml_oauth_tokens
  drop constraint if exists ml_oauth_tokens_encrypted_payload_check;

alter table ml_oauth_tokens
  add constraint ml_oauth_tokens_encrypted_payload_check
    check (
      (
        connection_state = 'disconnected'
        and token_payload is null
        and token_key_version is null
      )
      or
      (
        connection_state in ('connected', 'refreshing', 'reconnect_required')
        and token_payload is not null
        and token_key_version is not null
      )
    ),
  drop column if exists access_token,
  drop column if exists refresh_token;

comment on table ml_oauth_tokens is
  'Cofre OAuth do Mercado Livre. Tokens existem apenas no payload AES-256-GCM.';

revoke all on function public.complete_ml_token_refresh(bigint, uuid, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.disconnect_ml_oauth(bigint)
  from public, anon, authenticated;

grant execute on function public.complete_ml_token_refresh(bigint, uuid, text, integer, timestamptz)
  to service_role;
grant execute on function public.disconnect_ml_oauth(bigint)
  to service_role;
