# ML54-01 — gatekeeper, ciclo 1

Veredito: CHANGES REQUESTED. Gate agregado verde: lint, tipos, 372 testes em 40 arquivos,
build e PostgreSQL. A mutação escopada encontrou 81 mutantes: 71 mortos, 10 sobreviventes,
nenhum sem cobertura. S06, S09, S10 e S11 precisam de asserções adicionais.

## Defeitos para o coder

- D1 — `lib/ml/offer-url.ts:23,39,64`: cobrir todos os três domínios aceitos, inclusive
  hosts raiz, e entrada manual `''` como `none/absent/fallback_absent`. Sobreviveram a remoção
  de dois domínios da allowlist, da comparação de host exato e duas mutações de string vazia.
- D2 — `lib/ml/ingest.ts:432,502`: afirmar nomes e payloads exatos de
  `ml_url_fallback` e `ml_url_fallback_ativo`, com catálogo, todos os contadores e destino.
  Cinco sobreviventes removem nome/conteúdo. Manter ausência de URL, tag e segredo nas saídas.
- D3 — S06: provar equação de todos os motivos por catálogo e agregado, inicialização zerada e
  casos de catálogo vazio/falhado sem contribuição ao total.
- D4 — S10: GET e POST devem afirmar `result.urls` exato. Afirmar Content-Type JSON também nos
  testes existentes de 401, configuração 503, autenticação ML 503 e falha total 500.
- D5 — S11: trocar IDs `1` compartilhados nas fixtures por IDs distintos e não default para
  store, brand, product e variant; afirmar `p_store_id`, `p_variant_id`, `p_catalog_id`,
  identidade, preço, ranking e vendedor da RPC.
- D6 — S09: depois da execução real, procurar a oferta por `store_id + external_id` e comparar
  estado comercial completo e histórico valor a valor. Remover a asserção tautológica por ID.

## Escopo e evidências

O diagnóstico completo inicial teve 382 mutantes, 207 mortos, 124 sobreviventes e 51 sem
cobertura. Os 114 sobreviventes restantes e os 51 sem cobertura são de linhas legadas da
ingestão, fora da alteração. O gate inclui os módulos completos de builder/resolvedor e todas
as linhas de ingestão alteradas contra a base `6b986d7`; não há exclusão de operadores.

Relatórios locais: `/tmp/compara-suple-ml54-logs/gate-check.log`,
`/tmp/compara-suple-ml54-logs/gate-mutation-scoped.log` e
`/tmp/compara-suple-ml54-logs/mutation-full-modules.json`.

O gate não encontrou vazamento de URLs/tags/segredos, migração necessária ou regressão de
complexidade. O ciclo seguinte exige coder → refactorer → gatekeeper novamente.
