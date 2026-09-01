-- Modo de simulação da reconciliação (EP02-07).
--
-- A primeira reconciliação real desativa ofertas em produção. Antes disso é
-- preciso poder ver exatamente o que ela faria, sem que faça.
--
-- A simulação NÃO é um caminho de código paralelo: ela executa o mesmo comando
-- da reconciliação real e desfaz o efeito no fim. Um dry-run que calcula os
-- números por outro caminho não prova nada sobre o caminho que vai rodar.

drop function if exists public.reconciliar_catalogo(bigint, text, bigint, jsonb);

create or replace function public.reconciliar_catalogo(
  p_store_id   bigint,
  p_catalog_id text,
  p_variant_id bigint,
  p_items      jsonb,
  p_simular    boolean default false
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

  -- Um bloco com EXCEPTION cria um savepoint implícito. Em simulação nós
  -- escrevemos de verdade, lemos os contadores e então levantamos um erro
  -- nosso: o savepoint desfaz a escrita e o handler devolve os contadores.
  begin
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

    if p_simular then
      raise exception using
        errcode = 'MLSIM',
        message = v_contadores::text;
    end if;
  exception when sqlstate 'MLSIM' then
    get stacked diagnostics v_contadores = message_text;
  end;

  -- O chamador precisa saber se está lendo uma previsão ou um fato.
  return jsonb_set(v_contadores, '{simulado}', to_jsonb(coalesce(p_simular, false)));
end;
$$;

-- Mesma restrição da versão anterior: só a service_role reconcilia. A
-- assinatura mudou, então o grant precisa ser refeito.
revoke all on function public.reconciliar_catalogo(bigint, text, bigint, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.reconciliar_catalogo(bigint, text, bigint, jsonb, boolean)
  to service_role;
