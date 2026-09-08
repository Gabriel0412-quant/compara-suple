# Retries persistidos e replay administrativo

## Decisões

A tentativa de um item é persistida em `ingestion_run_item.attempt_count`. Falhas transitórias, internas e timeouts usam backoff exponencial com jitter; o horário persistido em `next_retry_at` é o maior entre o backoff e o valor de `Retry-After` recebido do Mercado Livre. O cron só reclama o item quando esse horário chega.

O limite é `INGEST_MAX_ATTEMPTS`, com padrão 5 e faixa aceita de 1 a 10. Ao esgotá-lo, o item fica em `failed`; identificador removido, inválido, payload incompatível e outros erros permanentes também falham sem agendamento. Os códigos gravados e enviados aos logs são categorias curtas, nunca resposta HTTP, token, URL ou payload.

Falha de OAuth que exige reconexão bloqueia a run. O item reclamado volta a `pending`, o lease é removido e o cron recebe `blocked`, sem iniciar itens novos. Depois de corrigir a conexão, o operador libera apenas o escopo necessário pelo replay.

`ingestion_replay_audit` registra toda solicitação de replay, inclusive as que não reabrem itens. A tabela e todas as RPCs são exclusivas de `service_role`.

## Métricas operacionais

O executor emite `ml_ingestion_metric` com eventos `attempt`, `retry_scheduled`, `recovered`, `final_failure` e `blocked`. Os campos são `run_id`, `item_id`, tentativa e código categorizado. Isso permite separar tentativas, recuperações e falhas definitivas sem registrar material sensível.

## Replay seguro

`POST /api/admin/ml-ingest/replay` exige `Authorization: Bearer ${ML_ADMIN_SECRET}`. O segredo é diferente de `CRON_SECRET`; não o use em browser, job público ou log.

Exemplo para liberar uma run bloqueada sem reabrir itens concluídos:

```sh
curl -X POST "$APP_URL/api/admin/ml-ingest/replay" \
  -H "Authorization: Bearer $ML_ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  --data '{"runId":"<uuid-da-run>"}'
```

Para reprocessar um item específico que já terminou, a ampliação de escopo precisa ser explícita:

```sh
curl -X POST "$APP_URL/api/admin/ml-ingest/replay" \
  -H "Authorization: Bearer $ML_ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  --data '{"runId":"<uuid-da-run>","itemId":123,"includeCompleted":true}'
```

Sem `includeCompleted: true`, itens `succeeded`, `failed` e `skipped` permanecem fechados. A resposta inclui apenas escopo, quantidade reaberta e estado; não inclui payload nem erro bruto.

## Runbook

1. Confirme o evento `blocked` e o código categorizado; não repita o cron para uma run bloqueada.
2. Reconecte o Mercado Livre pelo fluxo OAuth administrativo e confirme que a conexão está saudável.
3. Faça o replay no menor escopo. Para uma run bloqueada, o corpo só com `runId` libera os itens pendentes; para um item terminal, informe também `itemId` e `includeCompleted: true`.
4. Aguarde o próximo cron autenticado com `CRON_SECRET` ou dispare-o manualmente. Ele retoma apenas a run liberada.
5. Verifique `ml_ingestion_metric`: uma recuperação aparece como `recovered`; ao atingir o limite, aparece `final_failure`.

Não use replay para contornar 429: o `Retry-After` já está persistido. Se houver falha interna repetida, preserve a run e investigue o código categorizado antes de um replay explícito.
