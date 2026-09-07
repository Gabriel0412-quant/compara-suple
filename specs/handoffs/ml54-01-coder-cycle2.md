# ML54-01 — handoff coder, ciclo 2

## Defeitos fechados

- D1: S01 cobre `manualByItemId` vazio e S02 cobre os três hosts raiz
  permitidos.
- D2: S11 fixa todos os eventos `ml_url_fallback`, seus contadores e o aviso
  `ml_url_fallback_ativo` com payload exato.
- D3: S06 verifica a soma de cada catálogo, o agregado, o estado inicial e a
  ausência de contribuição de catálogos vazio e falho.
- D4: S10 compara o resultado de fallback inteiro em GET e POST e todos os
  caminhos de erro agora verificam `Content-Type: application/json`.
- D5: S11 usa IDs distintos para store, brand, product e variant; fixa os
  argumentos da RPC e a identidade comercial da primeira oferta.
- D6: S09 busca a oferta após a execução real por `store_id + external_id` e
  compara o estado comercial e o histórico pela chave composta.

## Produção

Nenhuma alteração de produção foi necessária neste ciclo: os defeitos eram
lacunas de asserção e a implementação já satisfazia os comportamentos que os
testes novos fixam.

## Verificações observadas

- `pnpm vitest run lib/ml/offer-url.test.ts lib/ml/ingest.test.ts app/api/cron/ml-ingest/route.test.ts` — verde.
- `pnpm test:property` — verde.
- `pnpm test:db` — verde.
- `pnpm lint` — verde.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `git diff --check` — verde.

Nenhum defeito pendente. Para a próxima etapa, execute `/refactor ML54-01`.
