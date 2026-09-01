-- Reconciliação atômica de ofertas por catálogo (EP02-03).
--
-- O ingest antigo só inseria e atualizava: ofertas que sumiam do snapshot
-- continuavam com available = true para sempre. Aqui o snapshot passa a ser o
-- estado comercial completo do catálogo, aplicado numa única transação.

-- 1. Vínculo explícito oferta -> catálogo de origem.
--    Antes isso só existia dentro de offer.raw->>'catalog_id', que não dá para
--    indexar com segurança nem usar como chave de reconciliação.
alter table offer add column if not exists source_catalog_id text;

update offer
   set source_catalog_id = raw->>'catalog_id'
 where source_catalog_id is null
   and raw ? 'catalog_id';

create index if not exists offer_source_catalog_idx
  on offer (store_id, source_catalog_id);

-- 2. A reconciliação em si.
--
-- p_items é o snapshot completo e já validado do catálogo, no formato
-- [{ "external_id": "MLB...", "url": "...", "price": 1.23, "ml_rank": 0, "raw": {...} }].
-- Um array vazio é um snapshot válido e significa "este catálogo não tem mais
-- nenhuma oferta ativa".
create or replace function public.reconciliar_catalogo(
  p_store_id   bigint,
  p_catalog_id text,
  p_variant_id bigint,
  p_items      jsonb
) returns jsonb
language plpgsql
as $$
declare
  -- O site é lido no fuso de São Paulo; o histórico é por dia civil de lá.
  v_dia        date := (now() at time zone 'America/Sao_Paulo')::date;
  v_contadores jsonb;
begin
  if p_store_id is null or p_catalog_id is null then
    raise exception 'reconciliar_catalogo: p_store_id e p_catalog_id são obrigatórios';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'reconciliar_catalogo: p_items precisa ser um array jsonb';
  end if;

  if p_variant_id is null and jsonb_array_length(p_items) > 0 then
    raise exception 'reconciliar_catalogo: p_variant_id é obrigatório quando há ofertas';
  end if;

  -- Tudo abaixo é um único comando: os CTEs enxergam o mesmo snapshot do banco,
  -- então "antes" lê o estado anterior mesmo com "upsertadas" escrevendo.
  with entrada as (
    -- distinct on protege o ON CONFLICT: o mesmo external_id duas vezes no
    -- array faria o comando tentar atualizar a mesma linha duas vezes e falhar.
    select distinct on (external_id) *
      from (
        select
          nullif(i->>'external_id', '')           as external_id,
          nullif(i->>'url', '')                   as url,
          (i->>'price')::numeric                  as price,
          nullif(i->>'ml_rank', '')::int          as ml_rank,
          coalesce(i->'raw', 'null'::jsonb)       as raw
          from jsonb_array_elements(p_items) as i
      ) bruto
     where external_id is not null
       and url is not null
       and price is not null
     order by external_id, ml_rank nulls last
  ),
  antes as (
    select o.external_id, o.available
      from offer o
      join entrada e on e.external_id = o.external_id
     where o.store_id = p_store_id
  ),
  upsertadas as (
    insert into offer (
      variant_id, store_id, external_id, url, price,
      available, ml_rank, raw, source_catalog_id, fetched_at
    )
    select
      p_variant_id, p_store_id, e.external_id, e.url, e.price,
      true, e.ml_rank, e.raw, p_catalog_id, now()
      from entrada e
    on conflict (store_id, external_id) do update set
      variant_id        = excluded.variant_id,
      url               = excluded.url,
      price             = excluded.price,
      available         = true,
      ml_rank           = excluded.ml_rank,
      raw               = excluded.raw,
      source_catalog_id = excluded.source_catalog_id,
      fetched_at        = excluded.fetched_at
    returning id, external_id, price
  ),
  -- Ofertas do catálogo que não vieram no snapshot de hoje. O filtro por
  -- external_id garante que este UPDATE e o UPSERT acima nunca tocam a mesma linha.
  desativadas as (
    update offer o
       set available  = false,
           fetched_at = now()
     where o.store_id          = p_store_id
       and o.source_catalog_id = p_catalog_id
       and o.available is distinct from false
       and not exists (select 1 from entrada e where e.external_id = o.external_id)
    returning o.id, o.price
  ),
  -- Os dois inserts de histórico rodam mesmo sem ninguém referenciá-los:
  -- CTE que escreve sempre é executado.
  historico_ativas as (
    insert into price_history (offer_id, price, available, observed_at)
    select id, price, true, v_dia from upsertadas
    on conflict (offer_id, observed_at) do update set
      price     = excluded.price,
      available = excluded.available
  ),
  historico_inativas as (
    insert into price_history (offer_id, price, available, observed_at)
    select id, price, false, v_dia from desativadas
    on conflict (offer_id, observed_at) do update set
      available = excluded.available
  )
  select jsonb_build_object(
    'recebidas',          (select count(*) from entrada),
    'criadas',            (select count(*) from upsertadas u
                            where not exists (select 1 from antes a
                                               where a.external_id = u.external_id)),
    'reativadas',         (select count(*) from upsertadas u
                            join antes a on a.external_id = u.external_id
                           where a.available is distinct from true),
    'atualizadas',        (select count(*) from upsertadas u
                            join antes a on a.external_id = u.external_id
                           where a.available is not distinct from true),
    'indisponibilizadas', (select count(*) from desativadas),
    'observado_em',       v_dia
  )
    into v_contadores;

  return v_contadores;
end;
$$;

-- 3. Só a service_role reconcilia. Sem isso, o PostgREST exporia a função ao
--    anon key, que poderia zerar o catálogo inteiro com um array vazio.
revoke all on function public.reconciliar_catalogo(bigint, text, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.reconciliar_catalogo(bigint, text, bigint, jsonb)
  to service_role;
