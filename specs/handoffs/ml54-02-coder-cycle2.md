# ML54-02 — handoff coder, ciclo 2

## Resultado

D1–D7 estão fechados. A entrada revisada valida tipos e metadados em runtime,
recusa URL social fora da forma textual permitida, preserva a URL aprovada sem
normalizá-la e mantém fallback, origem, validação e contadores exatos. URLs
dot-segment, escapes inválidos, protocolo em maiúsculas, portas, userinfo e
caminhos extras são recusados sem chamadas HTTP adicionais.

Foram simplificados guardas que eram equivalentes sob as validações restantes:
a data é aceita somente pelo round-trip ISO e o resultado de validação de path
usa `null` como único sucesso explícito. Isso tornou a falha de decoding
observável e eliminou os sobreviventes sem reduzir o comportamento coberto.

## Verificações observadas

- `pnpm vitest run lib/ml/offer-url.test.ts lib/ml/offer-url.property.test.ts lib/ml/catalog-id.test.ts lib/ml/ingest.test.ts app/api/cron/ml-ingest/route.test.ts` — 5 arquivos, 116 testes verdes.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `pnpm lint` — verde.
- `pnpm test:db` — verde, incluindo `0007_simulacao.test.sql`.
- `MUTATION_BASE=5a265a1d27d7e35e7aae290dff1129d0787c57b8 pnpm test:mutation` — 310 mortos, 0 sobreviventes, 0 sem cobertura.
- `git diff --check` — verde.

O relatório final de mutação está em `coverage/mutation/mutation.json` e o log
em `/tmp/ml54-02-cycle2-mutation8.log`.

## Próximo estágio

Executar `/refactor ml54-02`.
