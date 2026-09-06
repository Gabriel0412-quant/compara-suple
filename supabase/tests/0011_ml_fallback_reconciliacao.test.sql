begin;

do $$
declare
  v_store bigint;
  v_brand bigint;
  v_product bigint;
  v_variant bigint;
  v_offer bigint;
  v_click bigint;
  v_old_url text := 'https://www.mercadolivre.com.br/p/MLB54?wid=MLB54_OLD';
  v_fallback_url text := 'https://www.mercadolivre.com.br/p/MLB54?wid=MLB54_NEW';
  v_payload jsonb;
begin
  insert into store (slug, name) values ('_ml54_store_real', 'ML54 store real') returning id into v_store;
  insert into brand (slug, name) values ('_ml54_brand_real', 'ML54 brand real') returning id into v_brand;
  insert into product (slug, name, brand_id) values ('_ml54_product_real', 'ML54 product real', v_brand) returning id into v_product;
  insert into variant (product_id, flavor, size_grams, servings)
  values (v_product, 'baunilha', 900, 30) returning id into v_variant;
  insert into offer (variant_id, store_id, external_id, url, price, available, ml_rank, raw, source_catalog_id)
  values (v_variant, v_store, 'MLB54_NEW', v_old_url, 89.90, true, 7, '{"seller_id":54}'::jsonb, 'MLB54')
  returning id into v_offer;
  insert into price_history (offer_id, price, available, observed_at)
  values (v_offer, 89.90, true, (now() at time zone 'America/Sao_Paulo')::date);
  insert into click_event (offer_id, referrer, user_agent) values (v_offer, 'ml54', 'ml54') returning id into v_click;

  v_payload := jsonb_build_array(jsonb_build_object(
    'external_id', 'MLB54_NEW',
    'url', v_fallback_url,
    'price', 89.90,
    'ml_rank', 7,
    'raw', '{"seller_id":54}'::jsonb
  ));

  perform reconciliar_catalogo(v_store, 'MLB54', v_variant, v_payload, false);

  assert (select url from offer where id = v_offer) = v_fallback_url,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: url';
  assert (select id from offer where store_id = v_store and external_id = 'MLB54_NEW') = v_offer,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: offer id';
  assert (select variant_id from offer where id = v_offer) = v_variant,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: variant';
  assert (select store_id from offer where id = v_offer) = v_store,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: store';
  assert (select source_catalog_id from offer where id = v_offer) = 'MLB54',
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: catalog';
  assert (select price from offer where id = v_offer) = 89.90,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: price';
  assert (select available from offer where id = v_offer),
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: availability';
  assert (select ml_rank from offer where id = v_offer) = 7,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: rank';
  assert (select raw->>'seller_id' from offer where id = v_offer) = '54',
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: seller';
  assert (select offer_id from click_event where id = v_click) = v_offer,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: click event';
  assert (select price from price_history where offer_id = v_offer and observed_at = (now() at time zone 'America/Sao_Paulo')::date) = 89.90,
    'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity: history';
  raise notice 'TestSql_FallbackReconciliation_ShouldPersistExactUrlAndPreserveOfferIdentity passed';
end;
$$;

do $$
declare
  v_store bigint;
  v_brand bigint;
  v_product bigint;
  v_variant bigint;
  v_offer bigint;
  v_click bigint;
  v_before jsonb;
  v_after jsonb;
  v_history jsonb;
  v_simulated jsonb;
  v_real jsonb;
  v_fallback_url text := 'https://www.mercadolivre.com.br/up/MLBU54?wid=MLB54_SIM';
  v_payload jsonb;
begin
  insert into store (slug, name) values ('_ml54_store_sim', 'ML54 store sim') returning id into v_store;
  insert into brand (slug, name) values ('_ml54_brand_sim', 'ML54 brand sim') returning id into v_brand;
  insert into product (slug, name, brand_id) values ('_ml54_product_sim', 'ML54 product sim', v_brand) returning id into v_product;
  insert into variant (product_id, flavor, size_grams, servings)
  values (v_product, 'morango', 500, 20) returning id into v_variant;
  insert into offer (variant_id, store_id, external_id, url, price, available, ml_rank, raw, source_catalog_id, fetched_at)
  values (v_variant, v_store, 'MLB54_SIM', 'https://www.mercadolivre.com.br/p/MLB54?wid=MLB54_SIM_OLD', 55.50, true, 2, '{"seller_id":55}'::jsonb, 'MLBU54', '2020-01-01T00:00:00Z')
  returning id into v_offer;
  insert into price_history (offer_id, price, available, observed_at)
  values (v_offer, 55.50, true, (now() at time zone 'America/Sao_Paulo')::date);
  insert into click_event (offer_id, referrer, user_agent) values (v_offer, 'ml54', 'ml54') returning id into v_click;

  v_payload := jsonb_build_array(jsonb_build_object(
    'external_id', 'MLB54_SIM',
    'url', v_fallback_url,
    'price', 55.50,
    'ml_rank', 2,
    'raw', '{"seller_id":55}'::jsonb
  ));
  select jsonb_build_object(
    'offer', to_jsonb(o),
    'history', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from price_history ph where ph.offer_id = o.id), '[]'::jsonb),
    'click', (select to_jsonb(c) from click_event c where c.id = v_click)
  ) into v_before from offer o where o.id = v_offer;

  v_simulated := reconciliar_catalogo(v_store, 'MLBU54', v_variant, v_payload, true);

  assert (v_simulated->>'simulado')::boolean,
    'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged: simulado';
  assert (select jsonb_build_object(
    'offer', to_jsonb(o),
    'history', coalesce((select jsonb_agg(to_jsonb(ph) order by ph.id) from price_history ph where ph.offer_id = o.id), '[]'::jsonb),
    'click', (select to_jsonb(c) from click_event c where c.id = v_click)
  ) from offer o where o.id = v_offer) = v_before,
    'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged: simulation changed state';

  v_real := reconciliar_catalogo(v_store, 'MLBU54', v_variant, v_payload, false);

  assert v_simulated - 'simulado' = v_real - 'simulado',
    'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged: counters';
  assert (select url from offer where id = v_offer) = v_fallback_url,
    'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged: real url';
  select jsonb_build_object(
    'variant_id', o.variant_id,
    'store_id', o.store_id,
    'external_id', o.external_id,
    'url', o.url,
    'price', o.price,
    'available', o.available,
    'ml_rank', o.ml_rank,
    'raw', o.raw,
    'source_catalog_id', o.source_catalog_id
  ) into v_after
    from offer o
   where o.store_id = v_store
     and o.external_id = 'MLB54_SIM';
  assert v_after = jsonb_build_object(
    'variant_id', v_variant,
    'store_id', v_store,
    'external_id', 'MLB54_SIM',
    'url', v_fallback_url,
    'price', 55.50,
    'available', true,
    'ml_rank', 2,
    'raw', '{"seller_id":55}'::jsonb,
    'source_catalog_id', 'MLBU54'
  ), 'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged: commercial state';
  assert (select offer_id from click_event where id = v_click) = (
    select id from offer where store_id = v_store and external_id = 'MLB54_SIM'
  ),
    'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged: click';
  select coalesce(jsonb_agg(jsonb_build_object(
    'offer_id', ph.offer_id,
    'price', ph.price,
    'available', ph.available,
    'observed_at', ph.observed_at
  ) order by ph.offer_id, ph.observed_at), '[]'::jsonb) into v_history
    from price_history ph
    join offer o on o.id = ph.offer_id
   where o.store_id = v_store
     and o.external_id = 'MLB54_SIM';
  assert v_history = jsonb_build_array(jsonb_build_object(
    'offer_id', (select id from offer where store_id = v_store and external_id = 'MLB54_SIM'),
    'price', 55.50,
    'available', true,
    'observed_at', (now() at time zone 'America/Sao_Paulo')::date
  )), 'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged: history';
  raise notice 'TestSql_FallbackSimulation_ShouldLeaveOfferAndPriceHistoryUnchanged passed';
end;
$$;

rollback;
