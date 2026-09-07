# ML54-03 — handoff refactorer

## Resultado

Refatorei os fluxos novos sem alterar o contrato. O parser da CLI agora delega
cada flag, leitura de catálogo e finalização a helpers coesos; o runner separa
operação, log de sucesso e adaptador Supabase. A rota `/go` separa validação,
consulta da oferta e os dois registros de tracking, preservando o `302` e o
`Location` literal mesmo quando um tracking falha.

Adicionei `affiliate-links.property.test.ts`: em 200 entradas geradas, o
rollback preserva a identidade persistida de cada oferta, escolhe o caminho de
catálogo correto, mantém somente um `wid` e não inventa marcador de afiliado.

## Complexidade

`parseAffiliateLinksCliArgs` e `GET` da rota `/go` ficaram dentro de
`complexity <= 6`, confirmado com ESLint sobre os módulos novos e o script da
CLI. `montarLinha` (7) em `lib/eventos.ts` é baseline legado fora do escopo
ML54-03 e não foi alterada nesta etapa.

## Revisão PostgreSQL

A migration `0011_ml_affiliate_links.sql` continua set-based onde importa:
valida o lote antes da escrita, ordena locks por `external_id`, confere loja,
catálogo e seller antes de atualizar somente `offer.url` e
`raw.affiliate_link`, e desfaz a simulação no savepoint. O `ON CONFLICT` não
é usado porque a operação só atualiza linhas existentes. A unicidade
`offer(store_id, external_id)` e o índice
`offer_source_catalog_idx(store_id, source_catalog_id)` atendem os filtros;
dblink existe somente no teste concorrente. Não é necessária migration de
índice adicional.

## Verificações observadas

- `pnpm vitest run lib/ml/affiliate-links.test.ts lib/ml/affiliate-links.property.test.ts lib/ml/affiliate-links-cli.test.ts lib/ml/affiliate-links-cli-default.test.ts app/go/[offerId]/route.test.ts lib/eventos.track.test.ts` — 101 testes, verde.
- `pnpm lint` — verde.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- Cobertura focada: `affiliate-links.ts` 100% linhas/ramos/funções;
  `affiliate-links-cli.ts` 100% linhas/funções e 98,78% ramos; rota `/go`
  100% linhas/ramos/funções.
- ESLint explícito com `complexity <= 6` nos módulos novos, rota e script — verde.
- Evidência do coder/root: 517 testes, SQL, bootstrap limpo e mutação conjunta 577/0/0, verdes.

SQL não mudou nesta refatoração; a revisão anterior da migration
`0011_ml_affiliate_links.sql` permanece válida. E2E e mutação não foram
repetidos nesta etapa; o gate reexecutará mutação e o root executa o E2E
integrado após o gate.

## Próximo passo

Pronto para `/gate ML54-03`.
