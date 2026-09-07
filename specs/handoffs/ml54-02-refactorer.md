# ML54-02 — handoff refactorer

## Resultado

O contrato foi preservado e a implementação ficou legível sem mudança de
comportamento. O resolvedor agora separa parsing, `wid`, metadados revisados,
autoridade/caminho social e os dois fluxos de resolução. Os helpers mantêm um
único builder de fallback e uma única montagem de metadados e contadores na
ingestão; não restaram clones novos nos caminhos alterados.

## Testes e documentação reforçados

- S02 passou a fixar o motivo de cada rejeição, seller negativo/não inteiro,
  chave ausente e fallback próprio dos dois candidatos com URL duplicada.
- S10 agora confirma que a rejeição por seller mantém a rota, um único `wid`,
  ausência de `affiliate` e não compartilha a URL revisada de A ou B.
- S08 usa exatamente o mesmo payload para simulação e real, compara o snapshot
  completo de `offer` e `price_history` antes/depois da simulação, compara os
  contadores e prova que um lote com item válido e `price` inválido não deixa
  escrita parcial.
- A documentação distingue strings legadas de objetos revisados, restringe a
  regra de `wid` das strings ao fluxo legado e enumera todos os contadores com
  a equação `ofertas_resolvidas = affiliate_reviewed + fallback`.

## Complexidade e propriedades

`lib/ml/offer-url.ts` passa o lint forçado com `complexity <= 6`. Os alertas
restantes em `ingest.ts` são dívida da base ML54-01; o comparativo é:

| Função | base ML54-01 | atual |
| --- | ---: | ---: |
| `loadCuratedItems` | 14 | 13 |
| `upsertVariant` | 7 | 7 |
| `ingestCatalog` | 19 | 19 |
| `runCuratedIngest` | 10 | 10 |

Portanto a tarefa não introduziu infrator de complexidade. A propriedade S10
gera identidades A/B e confirma URL revisada byte a byte para as aprovadas e
fallback isolado para a rejeitada; o primeiro ajuste da propriedade revelou a
codificação `+` de espaço do `URLSearchParams`, e o assert passou a validar a
identidade pela URL parseada, sem assumir uma codificação incorreta.

## Revisão PostgreSQL

Não houve migration nem SQL de produção novo. `reconciliar_catalogo` continua
set-based por CTE, recebe parâmetros pelo RPC e grava `offer` e
`price_history` na mesma transação. A unicidade de `offer(store_id,
external_id)` atende o `ON CONFLICT`; `offer_source_catalog_idx(store_id,
source_catalog_id)` atende a desativação; a unicidade de
`price_history(offer_id, observed_at)` atende o histórico. Não há tabela
particionada ou predicado de partição nesse fluxo, nem índice adicional
necessário.

## Verificações observadas

- `pnpm vitest run lib/ml/offer-url.test.ts lib/ml/offer-url.property.test.ts lib/ml/ingest.test.ts app/api/cron/ml-ingest/route.test.ts` — 81 testes, verde.
- `pnpm test:db` — incluindo o SQL reforçado de S08, verde.
- `pnpm lint` — verde.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `git diff --check` — verde.

Cobertura e build completos já estavam verdes no handoff do coder e não foram
repetidos, pois a etapa alterou somente refatoração, testes, SQL de teste e
documentação. Mutação e E2E ficam para o gatekeeper/root.

## Limite conhecido

`NextResponse.redirect` normaliza alguns caracteres válidos de URL no header
`Location` (apóstrofo cru e Unicode); o resolvedor ML54-02 preserva a string
importada. O comportamento de saída foi isolado para ML54-03 pelo root e não
foi alterado nesta tarefa.

## Próximo passo

Pronto para `/gate ML54-02`.
