# Execuções duráveis de ingestão

`ingestion_run` representa um disparo lógico. A combinação de tipo e chave de idempotência identifica esse disparo, mesmo quando a Vercel repete a requisição. `ingestion_run_item` representa cada item curado dentro dele.

Uma execução começa em `pending`, passa para `running` quando recebe lease e termina em `succeeded`, `partial_failed` ou `failed`. `blocked` preserva o trabalho pendente quando uma dependência exige intervenção. Um item começa em `pending`, é reclamado como `processing` e termina ou agenda nova tentativa. Identidade e transições são protegidas no banco.

A função `create_ingestion_run` cria execução e itens atomicamente. Repetir tipo e chave retorna o mesmo identificador e não modifica a lista original. Apenas `service_role` possui acesso às tabelas e à função; clientes anônimos e autenticados não têm políticas nem privilégios.

O cron adquire o lease da run, reclama no máximo `INGEST_BATCH_SIZE` itens e responde antes de `INGEST_TIME_BUDGET_MS`. O próximo disparo retoma a mesma run. `INGEST_LEASE_SECONDS` controla o prazo de recuperação de worker interrompido. Os defaults são 12 itens, 240 segundos e 360 segundos; iniciar rollout com lote 4 e aumentar somente após observar duração e recuperação.

O executor usa cron diário às 09:00 UTC. No Vercel Hobby, a execução pode começar em qualquer momento entre 09:00 e 09:59 UTC; cada disparo processa um lote e uma run pendente é retomada no dia seguinte. Uma recuperação urgente pode chamar o endpoint manualmente com `CRON_SECRET`. `?simular=1` não cria nem atualiza runs ou itens.

## Reversão

Antes de reverter, confirme que nenhuma versão em produção lê ou escreve as tabelas. Remova a função `create_ingestion_run`, os dois triggers e suas funções; depois remova `ingestion_run_item` e `ingestion_run`, nessa ordem. Como a entrega ainda não troca o cron para esse modelo, a reversão não afeta snapshots ou ofertas atuais.
