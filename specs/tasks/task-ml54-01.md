# ML54-01 — Eliminar falsa classificação de links afiliados

**Target:** backend (`lib/` e contrato server-side do cron)
**Status:** implementada; gatekeeper aprovado no ciclo 2 e E2E integrado verde
**Hardened spec:** `specs/hardened/issue-54-atribuicao-afiliados-ml.md`

## Context

`resolveOfferUrl` marca como `tracked` qualquer fallback criado com texto em
`ML_AFFILIATE_TAG` e qualquer URL manual HTTPS com `wid` correspondente. Não existe evidência de
que o parâmetro local `affiliate` seja um mecanismo oficial. O sistema precisa conservar uma URL
comprável por oferta sem declarar afiliação inexistente.

Esta tarefa é a entrega independente de segurança semântica. Ela não publica links oficiais nem
encerra a issue como monetização restaurada.

## Acceptance criteria

- **CA01:** tag ausente, arbitrária ou composta apenas por espaços produz
  `untracked_fallback`; não produz estado validado, não inclui parâmetro de afiliação inventado e
  conserva o `wid` igual ao `external_id`.
- **CA02:** uma entrada atual de `affiliate_urls` com HTTPS, host aceito e `wid` correto, mas sem
  proveniência oficial, fica `unverified`, não é publicada e aumenta o total de fallbacks.
- **CA05:** catálogo MLB usa `/p/{catalogId}?wid={externalId}` e MLBU usa
  `/up/{catalogId}?wid={externalId}`, com valores codificados e um único `wid`.
- **CA08 (parcial):** por catálogo e agregado, toda oferta localmente resolvida entra uma única
  vez como fallback; os motivos distinguem candidato ausente de manual legado não verificado.
- **CA09 (parcial):** no PostgreSQL isolado, a simulação com payload fallback não altera a URL da
  oferta nem `price_history`; a execução real persiste exatamente a URL fallback recebida.
- **CA10 (parcial):** a atualização real da URL fallback preserva `offer.id`, `external_id`,
  variante, preço, disponibilidade, ranking e vínculos existentes.
- **CA12 (parcial):** testes e logs desta resolução usam valores sintéticos e não registram URL
  manual completa nem o conteúdo da tag.
- `tracked` é removido do contrato interno e de seus consumidores/testes locais. Nenhum
  nome/comentário afirma comissão por presença da env.
- `sem_tag_de_afiliado` é removido de `OfferUrlCounters` e do retorno `urls`; os totais de fallback
  passam a comunicar ausência ou entrada legada não verificada.
- A ausência de link afiliado não muda o preço, `ml_rank`, disponibilidade, identidade ou payload
  de reconciliação além da URL/estado de link, e não interrompe outros itens.
- `.env.example`, `docs/ml/url-afiliada-por-oferta.md` e
  `docs/ml/rollout-reconciliacao.md` não instruem que `ML_AFFILIATE_TAG` restaura atribuição.

## Affected code

- `lib/ml/offer-url.ts`: modelo da resolução, fallback, motivos e contadores.
- `lib/ml/offer-url.test.ts`: cenários unitários e tabela de tags/entradas legadas.
- `lib/affiliate.ts`: builder de fallback do Mercado Livre sem parâmetro inventado; preservar
  comportamento de outras lojas, se houver consumidor futuro.
- `lib/ml/ingest.ts`: agregação por catálogo e total, aviso operacional e payload de reconciliação.
- `lib/ml/ingest.test.ts`: integração de módulo com RPC simulada e fechamento dos contadores.
- `app/api/cron/ml-ingest/route.test.ts`: somente se o shape público de `urls` mudar.
- `supabase/tests/0007_simulacao.test.sql` ou novo teste SQL sequencial: provar persistência exata
  do fallback na execução real, ausência de mutação na simulação e preservação da identidade.
- `.env.example`, `docs/ml/url-afiliada-por-oferta.md`, `docs/ml/rollout-reconciliacao.md`.

Verificação: Vitest direcionado aos módulos acima, lint, typecheck, build e migrations/testes SQL
em PostgreSQL isolado. Não requer rede externa nem nova migration. O cenário de especificação deve
usar fixtures sintéticas e pinçar o valor integral da URL fallback; mock de RPC não substitui a
asserção do estado persistido.

## Out of scope

- Aceitar, gerar ou importar link oficial.
- Definir API, host allowlist, credencial ou formato do Mercado Livre.
- Resolver redirecionamentos externos.
- Alterar schema ou executar backfill/rollback em produção; a integração SQL isolada desta tarefa
  pode atualizar uma fixture existente para provar o efeito real da ingestão.
- Declarar atribuição observada, conversão ou comissão.

## Open questions

Nenhuma pergunta bloqueia esta tarefa.
