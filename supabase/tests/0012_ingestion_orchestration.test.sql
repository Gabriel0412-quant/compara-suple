begin;

set local role service_role;

do $$
declare
  v_first uuid := '00000000-0000-0000-0000-000000000101';
  v_second uuid := '00000000-0000-0000-0000-000000000102';
  v_run_id uuid;
  v_item_id bigint;
  v_state text;
  v_disposition text;
  v_now timestamptz := '2026-09-08 09:00:00+00';
begin
  select run_id, disposition, state into v_run_id, v_disposition, v_state
    from acquire_ingestion_run(
      'orchestration_test', '2026-09-08', 'test', array['MLB_A', 'MLB_B'],
      'commit-a', v_first, v_now, 360
    );
  assert v_disposition = 'acquired' and v_state = 'running',
    'a run pendente não recebeu lease';

  select disposition into v_disposition
    from acquire_ingestion_run(
      'orchestration_test', '2026-09-08', 'test', array['MLB_A', 'MLB_B'],
      'commit-a', v_second, v_now + interval '1 minute', 360
    );
  assert v_disposition = 'busy', 'um segundo worker recebeu lease vivo';

  select item_id into v_item_id
    from claim_ingestion_batch(v_run_id, v_first, 2, v_now + interval '1 minute', 360)
   order by item_id
   limit 1;
  assert v_item_id is not null, 'o primeiro lote não reclamou item';

  perform complete_ingestion_item(
    v_run_id, v_item_id, v_first, 'succeeded', null, v_now + interval '2 minutes'
  );

  select state into v_state
    from finalize_ingestion_run(v_run_id, v_first, v_now + interval '2 minutes');
  assert v_state = 'running', 'uma run com item pendente terminou antes da hora';
  assert (select count(*) from ingestion_run_item
            where run_id = v_run_id and state = 'pending') = 1,
    'item reclamado e não processado não voltou para pendente';
  assert (select lease_expires_at <= v_now + interval '2 minutes'
            from ingestion_run where id = v_run_id),
    'run pendente reteve o lease depois de encerrar o lote';

  select disposition into v_disposition
    from acquire_ingestion_run(
      'orchestration_test', '2026-09-08', 'test', array['MLB_A', 'MLB_B'],
      'commit-a', v_second, v_now + interval '2 minutes 1 second', 360
    );
  assert v_disposition = 'acquired', 'o próximo worker não retomou uma run pendente';

  select item_id into v_item_id
    from claim_ingestion_batch(v_run_id, v_second, 1, v_now + interval '3 minutes', 360);
  perform complete_ingestion_item(
    v_run_id, v_item_id, v_second, 'failed', 'item_processing_failed', v_now + interval '4 minutes'
  );
  select state into v_state
    from finalize_ingestion_run(v_run_id, v_second, v_now + interval '4 minutes');
  assert v_state = 'partial_failed', 'falha final não tornou a run parcial';
  assert (select item_succeeded from ingestion_run where id = v_run_id) = 1,
    'contador de sucesso não foi recalculado';
  assert (select item_failed from ingestion_run where id = v_run_id) = 1,
    'contador de falha não foi recalculado';
  assert (select lease_id from ingestion_run where id = v_run_id) is null,
    'run terminal reteve lease';
end;
$$;

rollback;
