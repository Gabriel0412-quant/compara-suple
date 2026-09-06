# ML54-02 — gate, ciclo 2

Parecer do gatekeeper transcrito pelo coordenador: **CHANGES REQUESTED**.

## Evidência

- 116 testes focados, lint, tipos e PostgreSQL passaram.
- Mutação após a refatoração: 316 mortos, zero sobreviventes e zero sem cobertura.
  `lib/affiliate.ts`: 8; `lib/ml/ingest.ts`: 52; `lib/ml/offer-url.ts`: 256.
- JSON: `/tmp/compara-suple-ml54-logs/gate-ml54-02-cycle2-mutation.json`.
- Oito dos dez cenários plenamente cobertos. S05 e S07 ainda incompletos.
- D1–D4, D6 e D7 fechados. Aggregate completo não repetido diante das lacunas.

## Defects → coder

**D5 — S05:** `lib/ml/ingest.test.ts:347-388`. O teste nomeado pelo contrato
fecha apenas a soma de revisadas/fallbacks, totais e alguns metadados. Comparar
contadores e motivos exatos por catálogo e agregado, ausência de campos legados
e exclusão explícita de catálogos vazios/falhados dentro de
`TestRunCuratedIngest_ShouldCloseReviewedAndFallbackCountersPerCatalog`.
Não basta haver essas asserções em outro teste.

**D5 — S07:** `lib/ml/ingest.test.ts:403-423`. `erro-externo-canary` aparece
somente no expect negativo. Injetar o canário em erro mockado que atravesse
o caminho real e afirmar o código finito resultante e ausência do texto em
logs/resposta. Exercitar resposta cron ou vincular essa parte explicitamente
a S09; não manter uma asserção negativa sem entrada correspondente.

**D8:** `specs/tasks/task-ml54-02.md:51-52` e especificação endurecida dizem
que review_ref não pode conter segredo/token sem distinguir responsabilidade.
S04 valida somente formato e aceita token-review-1. Reescrever a restrição de
conteúdo como obrigação da curadoria, não como detecção automática pelo código.

Não há alteração de produção necessária para esses defeitos. O gatekeeper
não alterou arquivos. Encaminhado ao coder para o ciclo 3.
