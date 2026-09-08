# Status, alertas e diagnóstico de ingestão

`GET /api/health/ingestion` é público e só devolve o agregado `healthy`, `degraded` ou `unavailable`. Ele nunca devolve `run_id`, erro, lease, token ou contadores internos.

`GET /api/admin/ml-ingest/status` exige `Authorization: Bearer ${ML_ADMIN_SECRET}` e devolve a última run, duração, estado, heartbeat, lease, contadores e idade do último preço válido. O `run_id` desse retorno é a chave de investigação no banco e nos logs.

O diagnóstico classifica preço velho e falha parcial/final como `degraded`; lease vencido ou OAuth bloqueado como `unavailable`. `INGEST_STATUS_STALE_AFTER_HOURS` controla a idade máxima do último preço válido e `INGEST_ALERT_DEDUP_MINUTES` controla a janela de repetição de alerta.

Os alertas persistem em `ingestion_alert`. Cada ciclo do cron abre, relembra ou recupera os quatro sinais: `price_stale`, `run_stuck`, `auth_blocked` e `run_failed`. Um incidente aberto só volta a produzir log depois da janela configurada; ao se recuperar, emite `recovered` uma única vez.

## Runbook

1. Consulte o endpoint administrativo com o segredo e anote apenas o `run_id`, estado e códigos categorizados.
2. Se houver `auth_blocked`, reconecte o Mercado Livre e faça o replay mínimo descrito em `retries-e-replay-ep03-03.md`.
3. Se houver `run_stuck`, aguarde a expiração do lease e confirme no próximo cron que a mesma run foi retomada; não altere item de outro worker.
4. Para `price_stale` ou `run_failed`, investigue os eventos `ml_ingestion_metric` e `ml_ingestion_alert`, depois faça replay explícito somente se o motivo tiver sido corrigido.
5. Confirme recuperação no endpoint administrativo, no evento `recovered` e no endpoint público agregado. Não copie credenciais, URLs de oferta ou payloads para tickets/logs.
