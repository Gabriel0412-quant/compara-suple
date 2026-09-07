# ML54-02 — handoff coder, ciclo 3

## Resultado

O cenário S05 agora concentra no teste contratual nomeado a mistura de entrada
revisada aprovada, legado, objeto rejeitado e ausências. Ele compara todos os
motivos e contadores por catálogo e no agregado, verifica a ausência dos campos
legados e roda uma segunda ingestão vazia/falha com agregado zerado.

S07 injeta `erro-externo-canary` em uma chamada real de catálogo. A ingestão o
transforma no estado finito `product_error`/`product_request_failed`; o canário,
URL, referência, tag, token e objeto importado não aparecem em logs nem no
resultado. O contrato registra que a resposta HTTP sanitizada é exercitada em
S09. A documentação também esclarece que o conteúdo de `review_ref` cabe à
curadoria; o código aplica somente alfabeto e tamanho.

## Verificações observadas

- `pnpm vitest run lib/ml/ingest.test.ts app/api/cron/ml-ingest/route.test.ts` — 2 arquivos, 34 testes verdes.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `pnpm lint` — verde.
- `git diff --check` — verde.

Não houve mudança de runtime. A mutação final anterior permanece em 316 mortos,
0 sobreviventes e 0 sem cobertura; não foi repetida neste ciclo.

## Próximo estágio

Executar `/refactor ml54-02`.
