# ML54-01 — handoff refactorer

## Resultado

O contrato permanece preservado. A documentação agora chama as entradas de
`affiliate_urls` de URLs legadas e declara expressamente que o `affiliate=...`
do exemplo não é evidência de atribuição nem conteúdo publicável.

Não há refatoração de produção necessária no escopo: `buildMlCatalogLink`
continua sendo o único builder do fallback e a resolução mantém os três estados
fechados do contrato. Não foram encontradas duplicações novas nos caminhos
alterados.

## Arquivos alterados nesta etapa

- `docs/ml/url-afiliada-por-oferta.md`
- `specs/handoffs/ml54-01-refactorer.md`

## Complexidade e cobertura

- `lib/affiliate.ts`: 100% statements/branches/functions/lines.
- `lib/ml/offer-url.ts`: 100% statements/branches/functions/lines.
- `lib/ml/ingest.ts`: 89,68% statements/lines, 68,35% branches e 100% funções.
- A propriedade S05 continua presente e passou com 200 gerações:
  `TestProperty_ResolveOfferUrl_ShouldPreserveIdentityAndNeverInventAffiliate`.

O lint com `complexity <= 6` nos módulos mutados não encontra infrator em
`affiliate.ts` nem `offer-url.ts`. Os quatro infratores de `ingest.ts` são
dívida anterior; o comparativo contra `HEAD` é:

| Função | HEAD | atual |
| --- | ---: | ---: |
| `loadCuratedItems` | 14 | 14 |
| `upsertVariant` | 7 | 7 |
| `ingestCatalog` | 20 | 19 |
| `runCuratedIngest` | 10 | 9 |

Refatorá-los até seis exigiria decompor fluxos legados inteiros e foge da
ML54-01. A alteração reduziu a complexidade das duas funções que tocou.

## Revisão PostgreSQL

Não houve alteração de migration nem de SQL de produção; `0011` somente exerce
`reconciliar_catalogo` existente. A RPC mantém escrita set-based por CTE e
parâmetros do cliente Supabase, sem SQL concatenado. O `ON CONFLICT` usa a
unicidade de `offer(store_id, external_id)`; a desativação usa o índice
`offer_source_catalog_idx(store_id, source_catalog_id)`; os históricos usam a
unicidade `(offer_id, observed_at)` e `price_history_offer_idx`; o vínculo de
clique tem `click_event_offer_idx(offer_id, created_at desc)`. Não há tabela
particionada nem predicado de partição neste caminho. Nenhuma migration de
índice é necessária.

## Verificações observadas

- `pnpm vitest run --coverage ...` — 4 arquivos, 47 testes, verde.
- `pnpm test:property` — 1 propriedade, verde.
- `pnpm test:db` — migrations e testes SQL, incluindo S08/S09, verdes.
- `pnpm lint` — verde.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `git diff --check` — verde.

As suítes unitária, property e de banco executadas nesta etapa não ficaram
vermelhas. O coder também registrou `pnpm test` e `pnpm build` verdes antes
desta revisão.

## Próximo passo

Rodar `/gate ML54-01`. O gatekeeper deve executar a mutação configurada e
decidir sobre sobreviventes nos módulos alterados, distinguindo a dívida de
complexidade pré-existente de regressões desta tarefa.
