-- Schema inicial do ComparaSuple
-- Tabelas: category, brand, store, product, variant, offer, price_history
-- Base: schema descrito no CLAUDE.md
-- Extensões: external_id e raw jsonb na offer (necessário para ingestão e debug),
--            unique compostas e índices para performance.

create table if not exists category (
  id          bigserial primary key,
  slug        text unique not null,
  name        text not null,
  parent_id   bigint references category(id)
);

create table if not exists brand (
  id          bigserial primary key,
  slug        text unique not null,
  name        text not null
);

create table if not exists store (
  id              bigserial primary key,
  slug            text unique not null,
  name            text not null,
  affiliate_type  text,           -- 'query_param', 'oauth', 'awin', etc.
  base_url        text
);

create table if not exists product (
  id          bigserial primary key,
  slug        text unique not null,
  name        text not null,
  brand_id    bigint references brand(id),
  category_id bigint references category(id),
  description text,
  created_at  timestamptz default now()
);

create table if not exists variant (
  id          bigserial primary key,
  product_id  bigint not null references product(id) on delete cascade,
  ean         text,
  flavor      text,
  size_grams  numeric,
  servings    numeric
);

-- Quando o EAN existe, ele é a chave forte de variante dentro de um produto
create unique index if not exists variant_product_ean_unique
  on variant (product_id, ean) where ean is not null;

create table if not exists offer (
  id           bigserial primary key,
  variant_id   bigint not null references variant(id) on delete cascade,
  store_id     bigint not null references store(id),
  external_id  text not null,        -- ID do produto na loja (ex.: "MLB1234567890")
  url          text not null,        -- URL com tracking de afiliado já aplicado
  price        numeric not null,
  available    boolean default true,
  raw          jsonb,                -- payload bruto da última coleta (debug/auditoria)
  fetched_at   timestamptz default now(),
  unique (store_id, external_id)
);

create index if not exists offer_variant_idx on offer (variant_id);
create index if not exists offer_store_idx   on offer (store_id);
create index if not exists offer_fetched_idx on offer (fetched_at);

create table if not exists price_history (
  id          bigserial primary key,
  offer_id    bigint not null references offer(id) on delete cascade,
  price       numeric not null,
  available   boolean,
  observed_at date not null,
  unique (offer_id, observed_at)
);

create index if not exists price_history_offer_idx on price_history (offer_id);

-- Seed: loja Mercado Livre (a primeira que vamos integrar)
insert into store (slug, name, affiliate_type, base_url)
values ('mercado-livre', 'Mercado Livre', 'query_param', 'https://www.mercadolivre.com.br')
on conflict (slug) do nothing;

-- Notas de RLS (Row Level Security)
-- ----------------------------------
-- Esta migração NÃO habilita RLS, para simplificar a fase inicial.
-- Antes do go-live público, configurar:
--   - SELECT público (anon role) em product, variant, offer, brand, category, store, price_history
--   - INSERT/UPDATE/DELETE apenas via service_role (jobs de ingestão server-side)
-- Exemplo:
--   alter table offer enable row level security;
--   create policy offer_read_public on offer for select using (true);
--   (writes ficam negadas implicitamente; service_role bypassa RLS)
