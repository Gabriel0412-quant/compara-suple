# ML54-02 — gate, ciclo 1

Parecer do gatekeeper transcrito pelo coordenador: **CHANGES REQUESTED**.
Base: `5a265a1d27d7e35e7aae290dff1129d0787c57b8`.

## Evidência

Lint, tipos, 406 testes, propriedades, build e PostgreSQL passaram.
S08 comprovou persistência, simulação sem alterações e atomicidade do erro.
Quatro dos dez cenários estavam plenamente cobertos: S01, S02, S08 e S10.
Mutação: 275 mortos, 32 sobreviventes e 3 sem cobertura: 310 resultados no
JSON, sendo 307 cobertos.
JSON preservado: `/tmp/compara-suple-ml54-logs/gate-ml54-02-cycle1-mutation.json`.

## Defects → coder

- **D1:** `lib/ml/offer-url.ts:136`: `/social/.`, `/social/..`, `/social/%2e`
  e `/social/%2e%2e` são aprovados, mas seu pathname normalizado fica fora do
  formato aprovado. Conferir também pathname canônico, sem reconstruir URL.
  Reforçar S03 com estado/motivo/fallback completos. Mutantes 79, 182, 183,
  187, 188, 194, 202, 207, 210 e sem cobertura 199, 204, 208: cobrir ou remover
  branches redundantes preservando comportamento; nunca excluir operadores.
- **D2:** `lib/ml/offer-url.ts:101`: fixar fronteiras runtime de null, tipos,
  data, referência, seller ausente e estado completo de rejeição. Mutantes
  117, 122, 123, 124, 151, 169, 172, 240, 268, 288 e 289 sobreviveram.
- **D3:** `lib/ml/ingest.ts:47`: testar mapa exato produzido pelo loader.
  Preservar string não vazia e objeto, inclusive incompleto para rejeição
  posterior; ignorar string vazia, null, número e boolean. Singular legado
  continua ignorado. Mutantes 9, 13, 14, 17, 19, 21, 22, 25 e 27 sobreviveram.
- **D4:** `lib/ml/ingest.ts:314`: comparar `raw.affiliate_link` exato no RPC
  para aprovadas e fallbacks, com ausência real de seller_id, reviewed_at e
  review_ref nos fallbacks. Mutantes 33, 37 e 41 sobreviveram.
- **D5:** `lib/ml/ingest.test.ts:336`: S05 deve misturar revisada, ausente,
  string legada válida e objeto rejeitado, comparar contadores/motivos exatos
  por catálogo e agregado e excluir vazios/falhados. S07 deve usar canários
  distintos para URL, referência, tag, token, segredo, objeto importado e
  erro externo bruto, além dos payloads e contadores completos.
- **D6:** alinhar nomes de S04/S06 ao contrato atual, incluindo
  `TestResolveOfferUrl_ShouldValidateReviewedMetadataByFormatOnly` e
  `TestResolveOfferUrl_ShouldValidateReviewedLinksWithoutAdditionalNetworkSideEffect`.
  S06 deve exercitar válidas e inválidas. No cron, GET e POST devem comparar
  o JSON completo com `{ ok: true, result }`, status e Content-Type; a ausência
  de URL/segredo sozinha deixava passar resposta sem contadores.
- **D7:** a especificação endurecida cita `fallback_seller_mismatch`; usar
  o identificador canônico `fallback_seller`.

CA13/CA14 e a correção de Location da ML54-03 não bloquearam este gate.
O gatekeeper não alterou código ou testes. O ciclo 2 foi encaminhado ao coder.
