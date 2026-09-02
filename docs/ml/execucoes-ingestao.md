# Execuções duráveis de ingestão

`ingestion_run` representa um disparo lógico. A combinação de tipo e chave de idempotência identifica esse disparo, mesmo quando a Vercel repete a requisição. `ingestion_run_item` representa cada item curado dentro dele.

Uma execução começa em `pending`, passa para `running` quando recebe lease e termina em `succeeded`, `partial_failed` ou `failed`. `blocked` preserva o trabalho pendente quando uma dependência exige intervenção. Um item começa em `pending`, é reclamado como `processing` e termina ou agenda nova tentativa. Identidade e transições são protegidas no banco.

A função `create_ingestion_run` cria execução e itens atomicamente. Repetir tipo e chave retorna o mesmo identificador e não modifica a lista original. Apenas `service_role` possui acesso às tabelas e à função; clientes anônimos e autenticados não têm políticas nem privilégios.

Os próximos passos do EP03 vão adquirir o lease, reclamar lotes e recalcular os contadores. Até lá, a migration cria o contrato persistente sem alterar o comportamento do cron existente.

## Reversão

Antes de reverter, confirme que nenhuma versão em produção lê ou escreve as tabelas. Remova a função `create_ingestion_run`, os dois triggers e suas funções; depois remova `ingestion_run_item` e `ingestion_run`, nessa ordem. Como a entrega ainda não troca o cron para esse modelo, a reversão não afeta snapshots ou ofertas atuais.

