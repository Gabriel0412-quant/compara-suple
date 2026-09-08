begin;

set local role service_role;

do $$
declare
  v_first uuid := '00000000-0000-0000-0000-000000000201';
  v_second uuid := '00000000-0000-0000-0000-000000000202';
  v_run_id uuid;
  v_auth_run_id uuid;
  v_item_id bigint;
  v_auth_item_id bigint;
  v_state text;
  v_disposition text;
  v_requeued integer;
  v_now timestamptz := '2026-09-08 09:00:00+00';
begin
  select run_id, disposition into v_run_id, v_disposition
    from acquire_ingestion_run(
      'retry_test', '2026-09-08', 'test', array['MLB_RETRY'],
      'commit-a', v_first, v_now, 360
    );
  assert v_disposition = 'acquired', 'a run de retry não recebeu lease';

  select item_id into v_item_id
    from claim_ingestion_batch(v_run_id, v_first, 1, v_now, 360);
  perform record_ingestion_item_outcome(
    v_run_id, v_item_id, v_first, 'retry_scheduled', 'ml_rate_limited',
    v_now + interval '60 seconds', v_now + interval '1 second'
  );
  assert (select state = 'retry_scheduled'
            and next_retry_at = v_now + interval '60 seconds'
            and attempt_count = 1
          from ingestion_run_item where id = v_item_id),
    '429 não preservou a tentativa e o Retry-After';

  select state into v_state
    from finalize_ingestion_run(v_run_id, v_first, v_now + interval '2 seconds');
  assert v_state = 'running', 'retry agendado não pode fechar a run';
  assert (select item_retry_scheduled = 1 from ingestion_run where id = v_run_id),
    'contador de retry não foi recalculado';

  select disposition into v_disposition
    from acquire_ingestion_run(
      'retry_test', '2026-09-08', 'test', array['MLB_RETRY'],
      'commit-a', v_second, v_now + interval '30 seconds', 360
    );
  assert v_disposition = 'acquired', 'run aguardando retry não foi retomável';
  assert not exists (
    select 1 from claim_ingestion_batch(
      v_run_id, v_second, 1, v_now + interval '30 seconds', 360
    )
  ), 'item foi reclamado antes de Retry-After';

  select item_id into v_item_id
    from claim_ingestion_batch(v_run_id, v_second, 1, v_now + interval '61 seconds', 360);
  perform record_ingestion_item_outcome(
    v_run_id, v_item_id, v_second, 'succeeded', null, null, v_now + interval '62 seconds'
  );
  select state into v_state
    from finalize_ingestion_run(v_run_id, v_second, v_now + interval '62 seconds');
  assert v_state = 'succeeded', 'retry recuperado não concluiu a run';
  assert (select attempt_count = 2 from ingestion_run_item where id = v_item_id),
    'recuperação não preservou a contagem de tentativas';

  select state, requeued_count into v_state, v_requeued
    from replay_ingestion_run(v_run_id, null, false, v_now + interval '63 seconds');
  assert v_state = 'succeeded' and v_requeued = 0,
    'replay padrão reabriu item concluído';

  select state, requeued_count into v_state, v_requeued
    from replay_ingestion_run(v_run_id, v_item_id, true, v_now + interval '64 seconds');
  assert v_state = 'pending' and v_requeued = 1,
    'replay explícito não reabriu somente o item solicitado';
  assert (select count(*) = 2 from ingestion_replay_audit where run_id = v_run_id),
    'replay não foi auditado';

  select run_id into v_auth_run_id
    from acquire_ingestion_run(
      'auth_retry_test', '2026-09-08', 'test', array['MLB_AUTH'],
      'commit-a', v_first, v_now, 360
    );
  select item_id into v_auth_item_id
    from claim_ingestion_batch(v_auth_run_id, v_first, 1, v_now, 360);
  perform block_ingestion_run(
    v_auth_run_id, v_first, v_auth_item_id, 'oauth_reconnect_required', v_now + interval '1 second'
  );
  assert (select state = 'blocked' and error_code = 'oauth_reconnect_required'
            from ingestion_run where id = v_auth_run_id),
    'falha OAuth não bloqueou a run';
  assert (select state = 'pending' from ingestion_run_item where id = v_auth_item_id),
    'item OAuth não foi preservado para retomada';

  select state, requeued_count into v_state, v_requeued
    from replay_ingestion_run(v_auth_run_id, v_auth_item_id, false, v_now + interval '2 seconds');
  assert v_state = 'pending' and v_requeued = 0,
    'replay pós-autorização não liberou somente o escopo pendente';
end;
$$;

rollback;
