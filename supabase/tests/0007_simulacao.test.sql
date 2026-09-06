-- Teste do modo de simulação (EP02-07).
--
-- Roda dentro de begin/rollback, não deixa resíduo. Cole no SQL Editor depois
-- de aplicar 0007_reconciliar_simulacao.sql.
-- Sucesso = "simulacao: todos os casos ok".
--
-- A propriedade central: a simulação prevê exatamente o que a execução real
-- faz, e não deixa nenhum efeito.

begin;

do $$
declare
  v_store    bigint;
  v_brand    bigint;
  v_produto  bigint;
  v_variant  bigint;
  v_cat      text := '_teste_MLB_SIMULACAO';
  v_sim      jsonb;
  v_real     jsonb;
  v_snapshot jsonb;
  v_id_a     bigint;
  v_ofertas  int;
  v_hist     int;
begin
  insert into store (slug, name) values ('_teste-loja', 'Loja de teste') returning id into v_store;
  insert into brand (slug, name) values ('_teste-marca', 'Marca de teste') returning id into v_brand;
  insert into product (slug, name, brand_id)
       values ('_teste-produto', 'Produto de teste', v_brand) returning id into v_produto;
  insert into variant (product_id) values (v_produto) returning id into v_variant;

  -- Estado inicial: A e B ativas.
  perform reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
    jsonb_build_object('external_id','MLB_A','url','https://x/a','price',10.00,'ml_rank',0,'raw','{}'::jsonb),
    jsonb_build_object('external_id','MLB_B','url','https://x/b','price',20.00,'ml_rank',1,'raw','{}'::jsonb)
  ));
  select id into v_id_a from offer where store_id = v_store and external_id = 'MLB_A';
  select count(*) into v_ofertas from offer where store_id = v_store;
  select count(*) into v_hist from price_history ph
    join offer o on o.id = ph.offer_id where o.store_id = v_store;

  -- Snapshot seguinte: A some, B muda de preço, C aparece.
  v_snapshot := jsonb_build_array(
    jsonb_build_object('external_id','MLB_B','url','https://x/b','price',22.50,'ml_rank',0,'raw','{}'::jsonb),
    jsonb_build_object('external_id','MLB_C','url','https://x/c','price',30.00,'ml_rank',1,'raw','{}'::jsonb)
  );

  -- ---------- caso 1: simular não altera nada ----------
  v_sim := reconciliar_catalogo(v_store, v_cat, v_variant, v_snapshot, true);

  assert (v_sim->>'simulado')::boolean, 'caso 1: retorno não marcou simulado';
  assert (select count(*) from offer where store_id = v_store) = v_ofertas,
         'caso 1: a simulação criou ou apagou oferta';
  assert (select available from offer where id = v_id_a) = true,
         'caso 1: a simulação desativou A';
  assert (select price from offer where store_id = v_store and external_id = 'MLB_B') = 20.00,
         'caso 1: a simulação alterou o preço de B';
  assert not exists (select 1 from offer where store_id = v_store and external_id = 'MLB_C'),
         'caso 1: a simulação criou C';
  assert (select count(*) from price_history ph
            join offer o on o.id = ph.offer_id where o.store_id = v_store) = v_hist,
         'caso 1: a simulação gravou histórico';

  -- ---------- caso 2: simular duas vezes dá o mesmo resultado ----------
  assert reconciliar_catalogo(v_store, v_cat, v_variant, v_snapshot, true) = v_sim,
         'caso 2: duas simulações do mesmo snapshot divergiram';

  -- ---------- caso 3: a previsão bate com a execução real ----------
  v_real := reconciliar_catalogo(v_store, v_cat, v_variant, v_snapshot, false);

  assert not (v_real->>'simulado')::boolean, 'caso 3: execução real marcada como simulada';
  assert v_sim - 'simulado' = v_real - 'simulado',
         'caso 3: previsão ' || v_sim::text || ' != realidade ' || v_real::text;

  -- E a execução real fez mesmo o que foi previsto.
  assert (select available from offer where id = v_id_a) = false, 'caso 3: A não caiu';
  assert (select price from offer where store_id = v_store and external_id = 'MLB_B') = 22.50,
         'caso 3: B não atualizou';
  assert exists (select 1 from offer where store_id = v_store and external_id = 'MLB_C'),
         'caso 3: C não foi criada';

  -- ---------- caso 4: simular o snapshot vazio prevê o esvaziamento sem executá-lo ----------
  v_sim := reconciliar_catalogo(v_store, v_cat, null, '[]'::jsonb, true);

  assert (v_sim->>'indisponibilizadas')::int = 2, 'caso 4: previsão ' || v_sim::text;
  assert (select count(*) from offer where store_id = v_store and available) = 2,
         'caso 4: a simulação do vazio desativou de verdade';

  -- ---------- caso 5: erro de argumento falha igual nos dois modos ----------
  begin
    perform reconciliar_catalogo(v_store, v_cat, null, v_snapshot, true);
    raise exception 'caso 5: simulação aceitou variant nulo com ofertas';
  exception when raise_exception then
    if position('p_variant_id' in sqlerrm) = 0 then
      raise exception 'caso 5: erro inesperado — %', sqlerrm;
    end if;
  end;

  raise notice 'simulacao: todos os casos ok';
end;
$$;

do $$
declare
  v_store bigint;
  v_brand bigint;
  v_product bigint;
  v_variant bigint;
  v_url text := 'https://www.mercadolivre.com.br/social/revisao-sql?wid=MLB_SQL';
  v_raw jsonb := '{"affiliate_link":{"origin":"reviewed_import","validation":"reviewed","destination":"affiliate_link","reason":"reviewed_import","seller_id":77,"reviewed_at":"2026-09-05","review_ref":"review-sql"}}'::jsonb;
  v_old_raw jsonb := '{"affiliate_link":{"origin":"reviewed_import","validation":"reviewed","destination":"affiliate_link","reason":"reviewed_import","seller_id":77,"reviewed_at":"2026-09-04","review_ref":"review-anterior"}}'::jsonb;
  v_initial_payload jsonb;
  v_payload jsonb;
  v_error_payload jsonb;
  v_before jsonb;
  v_after_simulation jsonb;
  v_after_error jsonb;
  v_simulated jsonb;
  v_real jsonb;
begin
  insert into store (slug, name) values ('_ml54_review_store', 'ML54 review store') returning id into v_store;
  insert into brand (slug, name) values ('_ml54_review_brand', 'ML54 review brand') returning id into v_brand;
  insert into product (slug, name, brand_id) values ('_ml54_review_product', 'ML54 review product', v_brand) returning id into v_product;
  insert into variant (product_id) values (v_product) returning id into v_variant;

  v_initial_payload := jsonb_build_array(jsonb_build_object(
    'external_id', 'MLB_SQL', 'url', 'https://www.mercadolivre.com.br/social/anterior?wid=MLB_SQL',
    'price', 41.50, 'ml_rank', 1, 'raw', v_old_raw
  ));
  perform reconciliar_catalogo(v_store, 'MLB_SQL_CAT', v_variant, v_initial_payload, false);
  v_payload := jsonb_build_array(jsonb_build_object('external_id', 'MLB_SQL', 'url', v_url, 'price', 42.50, 'ml_rank', 0, 'raw', v_raw));

  select jsonb_build_object(
    'offers', coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from offer o where o.store_id = v_store), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from price_history ph join offer o on o.id = ph.offer_id where o.store_id = v_store), '[]'::jsonb)
  ) into v_before;

  v_simulated := reconciliar_catalogo(v_store, 'MLB_SQL_CAT', v_variant, v_payload, true);
  select jsonb_build_object(
    'offers', coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from offer o where o.store_id = v_store), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from price_history ph join offer o on o.id = ph.offer_id where o.store_id = v_store), '[]'::jsonb)
  ) into v_after_simulation;
  assert v_after_simulation = v_before,
    'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: simulation changed state';

  v_real := reconciliar_catalogo(v_store, 'MLB_SQL_CAT', v_variant, v_payload, false);
  assert v_simulated - 'simulado' = v_real - 'simulado',
    'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: counters';
  assert (select url from offer where store_id = v_store and external_id = 'MLB_SQL') = v_url,
    'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: url real';
  assert (select raw->'affiliate_link' from offer where store_id = v_store and external_id = 'MLB_SQL') = v_raw->'affiliate_link',
    'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: raw real';
  assert (select price from offer where store_id = v_store and external_id = 'MLB_SQL') = 42.50,
    'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: price real';
  assert (select ph.price from price_history ph join offer o on o.id = ph.offer_id where o.store_id = v_store and o.external_id = 'MLB_SQL' and ph.observed_at = (now() at time zone 'America/Sao_Paulo')::date) = 42.50,
    'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: history real';

  select jsonb_build_object(
    'offers', coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from offer o where o.store_id = v_store), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from price_history ph join offer o on o.id = ph.offer_id where o.store_id = v_store), '[]'::jsonb)
  ) into v_before;
  v_error_payload := jsonb_build_array(
    jsonb_build_object('external_id', 'MLB_SQL_VALID', 'url', 'https://www.mercadolivre.com.br/social/valid?wid=MLB_SQL_VALID', 'price', 60.00, 'ml_rank', 1, 'raw', v_raw),
    jsonb_build_object('external_id', 'MLB_SQL_INVALID', 'url', 'https://www.mercadolivre.com.br/social/invalid?wid=MLB_SQL_INVALID', 'price', 'not-a-number', 'ml_rank', 2, 'raw', v_raw)
  );

  begin
    perform reconciliar_catalogo(v_store, 'MLB_SQL_CAT', v_variant, v_error_payload, false);
    raise exception 'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: accepted invalid price';
  exception when invalid_text_representation then
    null;
  end;
  select jsonb_build_object(
    'offers', coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from offer o where o.store_id = v_store), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from price_history ph join offer o on o.id = ph.offer_id where o.store_id = v_store), '[]'::jsonb)
  ) into v_after_error;
  assert v_after_error = v_before,
    'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation: invalid price changed state';
  raise notice 'TestSql_ReviewedAffiliateLink_ShouldPersistAtomicallyAndRollbackSimulation passed';
end;
$$;

rollback;
