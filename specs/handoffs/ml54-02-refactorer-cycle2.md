# ML54-02 — handoff refactorer, ciclo 2

## Resultado

As correções D1–D7 preservam o contrato e zeram a mutação escopada. A revisão
não encontrou assert tautológico, guarda redundante ou alteração de SQL de
produção. A única refatoração desta etapa dividiu a validação de URL social em
helpers de segmento, decoding, estrutura e `wid`; todos preservam o protocolo
`OfferUrlReason | null` e o comportamento fail-closed.

## Contrato revisado

- D1: o caminho social é validado na string original, rejeita dot-segments
  decodificados e escapes inválidos, sem normalizar a URL aprovada.
- D2: os casos de tipo runtime, `null`, seller ausente, data e referência
  inválidos retornam fallback completo. O round-trip ISO já rejeita dados não
  textuais porque a comparação final é estrita.
- D3/D4: o loader preserva somente string não vazia ou objeto para validação
  posterior; o payload RPC compara `raw.affiliate_link` com `toStrictEqual`
  tanto para aprovação quanto para fallbacks sem metadados opcionais.
- D5/D6: contadores, canários de sanitização, GET/POST e respostas JSON têm
  payloads completos. As duas propriedades continuam verificando identidade,
  URL exata e fallback isolado.
- D7: o identificador usado é o canônico `fallback_seller`.

## SQL e complexidade

S08 continua simulando e executando o mesmo payload, comparando snapshot de
oferta/histórico, contadores e rollback de lote com preço inválido. A RPC de
produção, seus índices e migrations não foram alterados.

`lib/ml/offer-url.ts` passa `complexity <= 6` após a decomposição. Os alertas
legados de `ingest.ts` permanecem os mesmos já registrados na revisão anterior.

## Verificações observadas

- `pnpm vitest run lib/ml/offer-url.test.ts lib/ml/offer-url.property.test.ts lib/ml/catalog-id.test.ts lib/ml/ingest.test.ts app/api/cron/ml-ingest/route.test.ts` — 116 testes, verde.
- `pnpm lint` — verde.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- lint forçado `complexity <= 6` em `lib/ml/offer-url.ts` — verde.
- `pnpm test:db` — verde antes desta refatoração pura; o handoff do coder confirma o mesmo estado final.
- Mutação do coder, conferida pelo root: 310 mortos, 0 sobreviventes, 0 sem cobertura.

Não rodei mutação, E2E ou build novamente. A configuração e os operadores do
Stryker permaneceram intactos.

## Próximo passo

Pronto para `/gate ML54-02` (ciclo 2).
