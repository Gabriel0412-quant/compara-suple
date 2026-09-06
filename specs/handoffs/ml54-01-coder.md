# ML54-01 — handoff coder

## Resultado

O fallback do Mercado Livre não usa mais `ML_AFFILIATE_TAG`, não adiciona
`affiliate`, nem expõe `tracked` ou `sem_tag_de_afiliado`. URLs manuais legadas
aceitáveis são classificadas como `fallback_unverified` e não são publicadas;
entradas rejeitadas recebem motivo finito e `wid` duplicado é recusado.

## Red → green

`pnpm vitest run lib/ml/offer-url.test.ts` falhou no baseline em 14 de 15
casos: o resultado ainda tinha `tracked`, faltavam as dimensões novas, os
contadores antigos permaneciam e `wid` duplicado era aceito. Após a mudança,
os cenários S01–S04 passam. `pnpm vitest run lib/ml/ingest.test.ts` também
falhou no baseline nos cenários S06 e S11 por manter os contadores e inserir
`affiliate`; agora passa. S08/S09 em SQL já passavam no baseline porque a
reconciliação existente já atualiza a URL e desfaz a simulação corretamente;
os novos asserts registram essa garantia incluindo vendedor, evento de clique e
`fetched_at` da simulação.

## Cenários do contrato

S01–S04: `lib/ml/offer-url.test.ts`.
S05: `lib/ml/offer-url.property.test.ts`.
S06, S07 e S11: `lib/ml/ingest.test.ts`.
S08 e S09: `supabase/tests/0011_ml_fallback_reconciliacao.test.sql`.
S10: `app/api/cron/ml-ingest/route.test.ts`.

## Arquivos alterados

- `.env.example`
- `app/api/cron/ml-ingest/route.test.ts`
- `docs/ml/rollout-reconciliacao.md`
- `docs/ml/url-afiliada-por-oferta.md`
- `lib/affiliate.ts`
- `lib/ml/ingest.test.ts`
- `lib/ml/ingest.ts`
- `lib/ml/offer-url.property.test.ts`
- `lib/ml/offer-url.test.ts`
- `lib/ml/offer-url.ts`
- `supabase/tests/0011_ml_fallback_reconciliacao.test.sql`

## Verificações observadas

- `pnpm test` — verde.
- `pnpm test:property` — verde.
- `pnpm test:db` — verde.
- `pnpm lint` — verde.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `pnpm build` — verde.

## Para refactorer

Não há defeito conhecido. Verificar a clareza dos limites de validação legada e
o escopo da mutação nos três módulos alterados.
