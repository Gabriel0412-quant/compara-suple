# ML54-02 — handoff coder

## Resultado

`affiliate_urls` agora aceita a string legada ou o objeto revisado por anúncio.
O objeto revisado seleciona somente sua URL social original quando o vendedor do
snapshot, os metadados e a allowlist local conferem. Rejeições preservam a
origem `reviewed_import`, usam fallback próprio e não interrompem o catálogo.

`raw.affiliate_link` guarda apenas estado e metadados finitos, sem duplicar a
URL. Os contadores separam `affiliate_reviewed` de `fallback`. O aviso agregado
de fallback ocorre somente quando há fallback no lote.

## Red → green

Antes da implementação, S01–S04 e S06 falharam em `offer-url.test.ts`: objetos
revisados eram tratados como URL inválida, strings legadas eram a única forma
reconhecida e URLs sociais válidas nunca eram selecionadas. A suíte passou após
a validação local e a seleção byte a byte. O SQL S08 passou na base porque a
RPC já persiste `url` e `raw` atomicamente; os asserts novos registram URL e
`affiliate_link` reais, rollback da simulação e ausência de mudança após erro
real de argumento da RPC.

## Cenários atendidos

- S01–S04, S06: `lib/ml/offer-url.test.ts`.
- S05, S07: `lib/ml/ingest.test.ts`.
- S08: `supabase/tests/0007_simulacao.test.sql`.
- S09: `app/api/cron/ml-ingest/route.test.ts`.
- S10: `lib/ml/offer-url.property.test.ts`.

## Arquivos alterados

- `lib/ml/offer-url.ts`
- `lib/ml/ingest.ts`
- `lib/ml/offer-url.test.ts`
- `lib/ml/offer-url.property.test.ts`
- `lib/ml/ingest.test.ts`
- `app/api/cron/ml-ingest/route.test.ts`
- `supabase/tests/0007_simulacao.test.sql`
- `docs/ml/url-afiliada-por-oferta.md`

## Verificações observadas

- `pnpm test` — verde.
- `pnpm test:property` — verde.
- `pnpm test:db` — verde.
- `pnpm lint` — verde.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `pnpm build` — verde.
- `git diff --check` — verde.

Não rodei mutação; fica para o gate. Não há defeito conhecido para o refactorer.
