# ML54-03 — handoff refactorer ciclo 5

## Decisão de escopo

Revisei contra `8bba7ee28c22214b691a7ffe692993e3aa795b66`. `OffersSection` foi
restaurado ao baseline deliberadamente: a única diferença ML54-03 são as
quatro linhas que adicionam `superficie`, seu default `produto`, seu tipo e a
interpolação no `href` de saída. Não reextraí a tabela nem alterei sua
complexidade legada.

Os SSRs confirmam o contrato: sem prop, os dois links usam `de=produto`; com
`superficie="comparador"`, ambos usam `de=comparador`, mantendo
`menor_preco` e `destaque` conforme a oferta. O CTA da home continua separado
do link de detalhe, com URL rastreada e nome acessível.

## Verificações observadas

- `pnpm vitest run app/page.test.tsx components/product/OffersSection.test.tsx lib/categories.cards.test.ts app/go/[offerId]/route.test.ts` — 48 testes, verde.
- `pnpm lint`, `pnpm exec tsc --noEmit --incremental false` e `git diff --check` — verdes.
- Prettier não está configurado no projeto; lint e diff cobrem a formatação aplicável.

Não alterei SQL, migration, E2E, mutação ou commit. A complexidade de
`OffersSection` é baseline legado fora das quatro linhas ML03 e não integra
esta decisão de refatoração.

## Próximo passo

Pronto para `/gate ML54-03` ciclo 5.
