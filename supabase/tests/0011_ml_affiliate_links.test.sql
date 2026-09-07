begin;

do $$
declare
  v_store bigint;
  v_brand bigint;
  v_product bigint;
  v_variant bigint;
  v_offer bigint;
  v_before jsonb;
  v_payload jsonb;
  v_result jsonb;
  v_simulation jsonb;
  v_history jsonb;
  v_events jsonb;
  v_invalid jsonb;
  v_second bigint;
begin
  insert into store (slug, name) values ('_ml54_03_store', 'ML54 03 store') returning id into v_store;
  insert into brand (slug, name) values ('_ml54_03_brand', 'ML54 03 brand') returning id into v_brand;
  insert into product (slug, name, brand_id) values ('_ml54_03_product', 'ML54 03 product', v_brand) returning id into v_product;
  insert into variant (product_id, flavor, size_grams, servings) values (v_product, 'natural', 900, 30) returning id into v_variant;
  insert into offer (variant_id, store_id, external_id, url, price, available, ml_rank, raw, source_catalog_id, fetched_at)
  values (v_variant, v_store, 'MLB5403', 'https://www.mercadolivre.com.br/p/MLB5403?wid=MLB5403', 99.9, true, 4,
    '{"seller_id":5403,"other":"preserve"}', 'MLB5403CAT', '2020-01-01T00:00:00Z') returning id into v_offer;
  insert into price_history (offer_id, price, available, observed_at) values (v_offer, 99.9, true, current_date);
  insert into click_event (offer_id, referrer, user_agent) values (v_offer, 'test', 'test');

  v_payload := jsonb_build_array(jsonb_build_object(
    'external_id', 'MLB5403', 'seller_id', 5403,
    'url', 'https://www.mercadolivre.com.br/social/revisada?wid=MLB5403&ref=a%2Fb#frag',
    'affiliate_link', '{"origin":"reviewed_import","validation":"reviewed","destination":"affiliate_link","reason":"reviewed_import","seller_id":5403,"reviewed_at":"2026-09-05","review_ref":"review-5403"}'::jsonb
  ));

  select to_jsonb(o) into v_before from offer o where o.id = v_offer;
  select jsonb_agg(to_jsonb(h) order by id) into v_history from price_history h where offer_id = v_offer;
  select jsonb_agg(to_jsonb(e) order by id) into v_events from click_event e where offer_id = v_offer;
  begin
    perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', jsonb_build_array(
      jsonb_set(v_payload->0, '{url}', '"https://www.mercadolivre.com.br/social/parcial"'::jsonb),
      jsonb_set(v_payload->0, '{external_id}', '"MLB5403_MISSING"'::jsonb)
    ), false);
    raise exception 'partial batch should fail';
  exception when others then
    if sqlerrm <> 'affiliate_link_identity_invalid' then raise; end if;
  end;
  assert (select to_jsonb(o) from offer o where o.id = v_offer) = v_before,
    'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: partial batch';
  v_result := public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', v_payload, true);
  assert v_result = '{"simulado":true,"recebidas":1,"alteradas":1,"iguais":0}'::jsonb,
    'TestSql_ApplyAffiliateLinks_ShouldRollbackSimulationWithExactRealCounters: counters';
  assert (select to_jsonb(o) from offer o where o.id = v_offer) = v_before,
    'TestSql_ApplyAffiliateLinks_ShouldRollbackSimulationWithExactRealCounters: state';
  assert (select jsonb_agg(to_jsonb(h) order by id) from price_history h where offer_id = v_offer) = v_history
    and (select jsonb_agg(to_jsonb(e) order by id) from click_event e where offer_id = v_offer) = v_events,
    'TestSql_ApplyAffiliateLinks_ShouldRollbackSimulationWithExactRealCounters: exact history and events';
  v_simulation := v_result;

  v_result := public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', v_payload, false);
  assert v_result = '{"simulado":false,"recebidas":1,"alteradas":1,"iguais":0}'::jsonb,
    'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata: counters';
  assert v_result - 'simulado' = v_simulation - 'simulado',
    'TestSql_ApplyAffiliateLinks_ShouldRollbackSimulationWithExactRealCounters: same real counters';
  assert (select (to_jsonb(o) - 'url') #- '{raw,affiliate_link}' from offer o where o.id = v_offer)
    = (v_before - 'url') #- '{raw,affiliate_link}',
    'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata: all other columns';
  assert (select url from offer where id = v_offer) = v_payload->0->>'url',
    'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata: exact url';
  assert (select jsonb_agg(to_jsonb(h) order by id) from price_history h where offer_id = v_offer) = v_history
    and (select jsonb_agg(to_jsonb(e) order by id) from click_event e where offer_id = v_offer) = v_events,
    'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata: exact history and events';
  assert (select id from offer where id = v_offer) = v_offer
    and (select variant_id from offer where id = v_offer) = v_variant
    and (select price from offer where id = v_offer) = 99.9
    and (select ml_rank from offer where id = v_offer) = 4
    and (select fetched_at from offer where id = v_offer) = '2020-01-01T00:00:00Z'::timestamptz
    and (select raw->>'other' from offer where id = v_offer) = 'preserve',
    'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata: identity';
  assert (select raw->'affiliate_link' from offer where id = v_offer) = v_payload->0->'affiliate_link',
    'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata: metadata';
  assert (select count(*) from price_history where offer_id = v_offer) = 1
    and not exists (select 1 from price_history where offer_id = v_offer and price <> 99.9)
    and (select count(*) from click_event where offer_id = v_offer) = 1,
    'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata: history events';

  v_result := public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', v_payload, false);
  assert v_result = '{"simulado":false,"recebidas":1,"alteradas":0,"iguais":1}'::jsonb,
    'TestSql_ApplyAffiliateLinks_ShouldBeIdempotentAndSeparateEqualItems: apply';
  v_payload := jsonb_set(v_payload, '{0,url}', '"https://www.mercadolivre.com.br/p/MLB5403CAT?wid=MLB5403"'::jsonb);
  v_payload := jsonb_set(v_payload, '{0,affiliate_link}', '{"origin":"none","validation":"absent","destination":"untracked_fallback","reason":"fallback_absent"}'::jsonb);
  perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', v_payload, false);
  v_result := public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', v_payload, false);
  assert v_result = '{"simulado":false,"recebidas":1,"alteradas":0,"iguais":1}'::jsonb,
    'TestSql_ApplyAffiliateLinks_ShouldBeIdempotentAndSeparateEqualItems: rollback';
  assert (select url from offer where id = v_offer) = v_payload->0->>'url'
    and (select raw->'affiliate_link' from offer where id = v_offer) = v_payload->0->'affiliate_link',
    'TestSql_ApplyAffiliateLinks_ShouldBeIdempotentAndSeparateEqualItems: rollback exact state';
  insert into offer (variant_id, store_id, external_id, url, price, available, raw, source_catalog_id)
    values (v_variant, v_store, 'MLB5404', 'https://www.mercadolivre.com.br/p/MLB5403?wid=MLB5404',
      101, false, '{"seller_id":5403}', 'MLB5403CAT') returning id into v_second;
  v_result := public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', jsonb_build_array(
    v_payload->0, jsonb_set(jsonb_set(v_payload->0, '{external_id}', '"MLB5404"'),
      '{url}', '"https://www.mercadolivre.com.br/p/MLB5403?wid=MLB5404"')
  ), false);
  assert v_result = '{"simulado":false,"recebidas":2,"alteradas":1,"iguais":1}'::jsonb,
    'TestSql_ApplyAffiliateLinks_ShouldBeIdempotentAndSeparateEqualItems: mixed counters';
  assert (select (to_jsonb(o) - 'url') #- '{raw,affiliate_link}' from offer o where o.id = v_offer)
    = (v_before - 'url') #- '{raw,affiliate_link}'
    and (select jsonb_agg(to_jsonb(h) order by id) from price_history h where offer_id = v_offer) = v_history
    and (select jsonb_agg(to_jsonb(e) order by id) from click_event e where offer_id = v_offer) = v_events,
    'TestSql_ApplyAffiliateLinks_ShouldBeIdempotentAndSeparateEqualItems: identity history events';

  begin
    perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', jsonb_build_array(v_payload->0, jsonb_set(v_payload->0, '{seller_id}', '999'::jsonb)), false);
    raise exception 'batch invalid should fail';
  exception when others then
    if sqlerrm <> 'affiliate_link_duplicate_item' then raise; end if;
  end;
  begin
    perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', jsonb_set(v_payload, '{0,seller_id}', '999'::jsonb), false);
    raise exception 'identity mismatch should fail';
  exception when others then
    if sqlerrm <> 'affiliate_link_identity_invalid' then raise; end if;
  end;
  begin
    perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', jsonb_build_array(jsonb_build_object(
      'external_id', 'MLB5403', 'seller_id', 5403, 'url', 'https://www.mercadolivre.com.br/social/missing'
    )), false);
    raise exception 'missing metadata should fail';
  exception when others then
    if sqlerrm <> 'affiliate_link_item_invalid' then raise; end if;
  end;
  assert (select url from offer where id = v_offer) = v_payload->0->>'url',
    'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: atomic';
  assert not has_function_privilege('anon', 'public.aplicar_links_afiliados_ml(bigint,text,jsonb,boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.aplicar_links_afiliados_ml(bigint,text,jsonb,boolean)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.aplicar_links_afiliados_ml(bigint,text,jsonb,boolean)', 'EXECUTE'),
    'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: grants';

  select to_jsonb(o) into v_before from offer o where o.id = v_offer;
  for v_invalid in select value from jsonb_array_elements(jsonb_build_array(
    (v_payload->0) - 'affiliate_link',
    jsonb_set(v_payload->0, '{affiliate_link}', 'null'),
    jsonb_set(v_payload->0, '{affiliate_link}', '"sensitive-canary"'),
    jsonb_set(v_payload->0, '{affiliate_link}', '[]'),
    (v_payload->0) - 'seller_id',
    jsonb_set(v_payload->0, '{seller_id}', '0'),
    jsonb_set(v_payload->0, '{seller_id}', '-1'),
    jsonb_set(v_payload->0, '{seller_id}', '"sensitive-canary"'),
    jsonb_set(v_payload->0, '{seller_id}', '9223372036854775808'),
    jsonb_set(v_payload->0, '{seller_id}', '1.5'),
    jsonb_set(v_payload->0, '{url}', '{}'),
    '"sensitive-canary"'::jsonb,
    (v_payload->0) - 'external_id',
    jsonb_set(v_payload->0, '{url}', '""')
  )) loop
    begin
      perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', jsonb_build_array(v_invalid), false);
      raise exception 'invalid item accepted';
    exception when others then
      assert sqlerrm = 'affiliate_link_item_invalid',
        'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: finite item rejection';
    end;
  end loop;
  for v_invalid in select value from jsonb_array_elements('[null,{},"sensitive-canary",1]') loop
    begin
      perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', v_invalid, false);
      raise exception 'invalid batch accepted';
    exception when others then
      assert sqlerrm = 'affiliate_link_items_invalid',
        'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: finite batch rejection';
    end;
  end loop;
  begin
    perform public.aplicar_links_afiliados_ml(v_store, 'MLB999999', v_payload, false);
    raise exception 'wrong catalog accepted';
  exception when others then
    assert sqlerrm = 'affiliate_link_identity_invalid',
      'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: catalog mismatch';
  end;
  begin
    perform public.aplicar_links_afiliados_ml(-1, 'MLB5403CAT', v_payload, false);
    raise exception 'wrong store accepted';
  exception when others then
    assert sqlerrm = 'affiliate_link_identity_invalid',
      'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: store mismatch';
  end;
  assert (select to_jsonb(o) from offer o where id = v_offer) = v_before,
    'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: every invalid case preserves row';

  raise notice 'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor passed';
  raise notice 'TestSql_ApplyAffiliateLinks_ShouldChangeOnlyUrlAndAffiliateMetadata passed';
  raise notice 'TestSql_ApplyAffiliateLinks_ShouldRollbackSimulationWithExactRealCounters passed';
  raise notice 'TestSql_ApplyAffiliateLinks_ShouldBeIdempotentAndSeparateEqualItems passed';
end;
$$;

do $$
declare
  v_store bigint;
  v_result jsonb;
begin
  select id into v_store from store where slug = '_ml54_03_store';
  execute 'set local role service_role';
  v_result := public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', jsonb_build_array(jsonb_build_object(
    'external_id', 'MLB5403', 'seller_id', 5403,
    'url', 'https://www.mercadolivre.com.br/p/MLB5403CAT?wid=MLB5403&role=synthetic',
    'affiliate_link', '{"origin":"none","validation":"absent","destination":"untracked_fallback","reason":"fallback_absent"}'::jsonb
  )), false);
  execute 'reset role';
  assert v_result = '{"simulado":false,"recebidas":1,"alteradas":1,"iguais":0}'::jsonb
    and (select url from offer where store_id = v_store and external_id = 'MLB5403')
      = 'https://www.mercadolivre.com.br/p/MLB5403CAT?wid=MLB5403&role=synthetic',
    'TestSql_ApplyAffiliateLinks_ShouldValidateBatchAtomicallyAndRestrictExecutor: actual service_role write';
  execute 'set local role anon';
  begin
    perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', '[]'::jsonb, true);
    raise exception 'anon should not execute affiliate links';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  execute 'set local role authenticated';
  begin
    perform public.aplicar_links_afiliados_ml(v_store, 'MLB5403CAT', '[]'::jsonb, true);
    raise exception 'authenticated should not execute affiliate links';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$$;

rollback;

begin;
create extension if not exists dblink;

do $concurrency$
declare
  v_store bigint;
  v_product bigint;
  v_variant bigint;
  v_offer bigint;
  v_pid integer;
  v_waiting boolean;
  v_url text;
  v_seller text;
  v_payload jsonb;
  v_rollback boolean;
  v_attempt integer;
begin
  perform dblink_connect('ml54_apply', format('dbname=%L user=%L application_name=ml54_apply', current_database(), current_user));
  perform dblink_connect('ml54_writer', format('dbname=%L user=%L application_name=ml54_writer', current_database(), current_user));
  select id into v_store from dblink('ml54_writer',
    $$insert into public.store(slug,name) values ('_ml54_concurrent_store','ML54 concurrent') returning id$$) as t(id bigint);
  select id into v_product from dblink('ml54_writer',
    $$insert into public.product(slug,name) values ('_ml54_concurrent_product','ML54 concurrent') returning id$$) as t(id bigint);
  select id into v_variant from dblink('ml54_writer', format(
    'insert into public.variant(product_id) values (%s) returning id', v_product)) as t(id bigint);
  select id into v_offer from dblink('ml54_writer', format(
    $$insert into public.offer(variant_id,store_id,external_id,url,price,available,source_catalog_id,raw)
      values (%s,%s,'MLB5499','https://www.mercadolivre.com.br/p/MLB5400?wid=MLB5499',10,true,'MLB5400','{"seller_id":5499}') returning id$$,
    v_variant, v_store)) as t(id bigint);
  select pid into v_pid from dblink('ml54_apply', 'select pg_backend_pid()') as t(pid integer);
  perform dblink_exec('ml54_apply', $$set statement_timeout = '5s'$$);

  foreach v_rollback in array array[false, true] loop
    perform dblink_exec('ml54_writer', format(
      $$update public.offer set raw='{"seller_id":5499}', source_catalog_id='MLB5400' where id=%s$$, v_offer));
    perform dblink_exec('ml54_writer', 'begin');
    perform dblink_exec('ml54_writer', format(
      $$update public.offer set raw='{"seller_id":9999}', source_catalog_id='MLB9999' where id=%s$$, v_offer));
    v_payload := jsonb_build_array(jsonb_build_object(
      'external_id', 'MLB5499', 'seller_id', 5499,
      'url', case when v_rollback then 'https://www.mercadolivre.com.br/p/MLB5400?wid=MLB5499&rollback=synthetic'
        else 'https://www.mercadolivre.com.br/social/synthetic?wid=MLB5499' end,
      'affiliate_link', jsonb_build_object('destination', case when v_rollback then 'untracked_fallback' else 'affiliate_link' end)
    ));
    assert dblink_send_query('ml54_apply', format(
      'select public.aplicar_links_afiliados_ml(%s,%L,%L::jsonb,false)', v_store, 'MLB5400', v_payload::text)) = 1,
      'TestSql_ApplyAffiliateLinks_ShouldRejectConcurrentIdentityChangeBeforeOverwrite: asynchronous call';
    v_waiting := false;
    for v_attempt in 1..100 loop
      perform pg_stat_clear_snapshot();
      select wait_event_type = 'Lock' into v_waiting from pg_stat_activity where pid = v_pid;
      exit when v_waiting;
      perform pg_sleep(0.02);
    end loop;
    assert v_waiting,
      'TestSql_ApplyAffiliateLinks_ShouldRejectConcurrentIdentityChangeBeforeOverwrite: actual competing lock';
    perform dblink_exec('ml54_writer', 'commit');
    perform result from dblink_get_result('ml54_apply', false) as t(result jsonb);
    assert dblink_error_message('ml54_apply') like '%affiliate_link_identity_invalid%'
      or dblink_error_message('ml54_apply') like '%affiliate_link_identity_changed%',
      'TestSql_ApplyAffiliateLinks_ShouldRejectConcurrentIdentityChangeBeforeOverwrite: stale identity rejected';
    perform result from dblink_get_result('ml54_apply', false) as t(result jsonb);
    select url, seller into v_url, v_seller from dblink('ml54_writer', format(
      $$select url, raw->>'seller_id' from public.offer where id=%s$$, v_offer)) as t(url text, seller text);
    assert v_url = 'https://www.mercadolivre.com.br/p/MLB5400?wid=MLB5499' and v_seller = '9999',
      'TestSql_ApplyAffiliateLinks_ShouldRejectConcurrentIdentityChangeBeforeOverwrite: committed writer preserved';
  end loop;
  perform dblink_exec('ml54_writer', format('delete from public.product where id=%s', v_product));
  perform dblink_exec('ml54_writer', format('delete from public.store where id=%s', v_store));
  perform dblink_disconnect('ml54_apply');
  perform dblink_disconnect('ml54_writer');
  raise notice 'TestSql_ApplyAffiliateLinks_ShouldRejectConcurrentIdentityChangeBeforeOverwrite passed';
exception when others then
  if 'ml54_writer' = any(coalesce(dblink_get_connections(), array[]::text[])) then
    perform dblink_exec('ml54_writer', 'rollback');
    if v_product is not null then perform dblink_exec('ml54_writer', format('delete from public.product where id=%s', v_product)); end if;
    if v_store is not null then perform dblink_exec('ml54_writer', format('delete from public.store where id=%s', v_store)); end if;
    perform dblink_disconnect('ml54_writer');
  end if;
  if 'ml54_apply' = any(coalesce(dblink_get_connections(), array[]::text[])) then
    perform dblink_disconnect('ml54_apply');
  end if;
  raise;
end;
$concurrency$;

rollback;
