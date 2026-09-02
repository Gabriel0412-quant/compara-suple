begin;

do $$
declare
  v_run_id uuid;
  v_same_run_id uuid;
  v_other_run_id uuid;
  v_item_id bigint;
  v_index_count integer;
begin
  v_run_id := create_ingestion_run(
    'ml_catalog',
    '2026-09-02',
    'test',
    array['MLB_B', 'MLB_A', 'MLB_A'],
    'commit-a'
  );

  v_same_run_id := create_ingestion_run(
    'ml_catalog',
    '2026-09-02',
    'test',
    array['MLB_C'],
    'commit-b'
  );

  assert v_same_run_id = v_run_id, 'a chave idempotente criou outra execução';
  assert (select count(*) from ingestion_run where id = v_run_id) = 1,
    'a execução foi duplicada';
  assert (select item_total from ingestion_run where id = v_run_id) = 2,
    'o total não deduplicou as chaves';
  assert (select count(*) from ingestion_run_item where run_id = v_run_id) = 2,
    'os itens foram duplicados';

  begin
    update ingestion_run
       set state = 'succeeded',
           started_at = now(),
           completed_at = now()
     where id = v_run_id;
    raise exception 'a transição inválida deveria falhar';
  exception when check_violation then
    null;
  end;

  update ingestion_run
     set state = 'running',
         started_at = now(),
         heartbeat_at = now(),
         lease_id = '00000000-0000-0000-0000-000000000001',
         lease_expires_at = now() + interval '30 seconds'
   where id = v_run_id;

  v_other_run_id := create_ingestion_run(
    'ml_catalog',
    '2026-09-03',
    'test',
    array['MLB_C'],
    'commit-a'
  );

  begin
    update ingestion_run
       set state = 'running',
           started_at = now(),
           heartbeat_at = now(),
           lease_id = '00000000-0000-0000-0000-000000000002',
           lease_expires_at = now() + interval '30 seconds'
     where id = v_other_run_id;
    raise exception 'duas execuções do mesmo tipo ficaram ativas';
  exception when unique_violation then
    null;
  end;

  select id into v_item_id
    from ingestion_run_item
   where run_id = v_run_id
   order by id
   limit 1;

  begin
    update ingestion_run_item
       set state = 'succeeded',
           completed_at = now()
     where id = v_item_id;
    raise exception 'a transição inválida do item deveria falhar';
  exception when check_violation then
    null;
  end;

  begin
    update ingestion_run_item
       set item_key = 'OUTRO'
     where id = v_item_id;
    raise exception 'a chave imutável deveria falhar';
  exception when check_violation then
    null;
  end;

  select count(*) into v_index_count
    from pg_indexes
   where schemaname = 'public'
     and indexname in (
       'ingestion_run_one_running_per_type_idx',
       'ingestion_run_latest_idx',
       'ingestion_run_stale_lease_idx',
       'ingestion_run_item_ready_idx',
       'ingestion_run_item_stale_claim_idx'
     );

  assert v_index_count = 5, 'faltam índices operacionais';
end;
$$;

set local role service_role;

do $$
declare
  v_run_id uuid;
begin
  v_run_id := create_ingestion_run(
    'service_role_test',
    '2026-09-02',
    'test',
    array['MLB_SERVICE'],
    null
  );

  update ingestion_run
     set state = 'running',
         started_at = now(),
         heartbeat_at = now(),
         lease_id = '00000000-0000-0000-0000-000000000003',
         lease_expires_at = now() + interval '30 seconds'
   where id = v_run_id;

  assert (select state from ingestion_run where id = v_run_id) = 'running',
    'service_role não conseguiu operar a execução';
end;
$$;

reset role;

set local role anon;

do $$
begin
  perform id from ingestion_run limit 1;
  raise exception 'anon conseguiu ler ingestion_run';
exception when insufficient_privilege then
  null;
end;
$$;

do $$
begin
  perform create_ingestion_run(
    'ml_catalog',
    'anon',
    'test',
    array['MLB_X'],
    null
  );
  raise exception 'anon conseguiu criar uma execução';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;

rollback;
