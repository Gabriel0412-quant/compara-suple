-- Migration 0002: armazena tokens OAuth do Mercado Livre.
--
-- Por que existe: a Catalog API do ML deixou de ser pública (retorna 403
-- de PolicyAgent em chamadas sem auth). Agora toda chamada precisa de
-- Authorization: Bearer {access_token} obtido via Authorization Code flow.
--
-- A tabela é praticamente um singleton — só temos um app ML + um usuário ML
-- (o owner). O unique em ml_user_id evita duplicação.

create table if not exists ml_oauth_tokens (
  id            bigserial primary key,
  ml_user_id    bigint unique not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz default now() not null
);

comment on table ml_oauth_tokens is
  'Tokens OAuth do Mercado Livre. Refresh token vale 6 meses; access token vale 6h.';
