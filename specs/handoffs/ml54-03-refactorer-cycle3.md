# ML54-03 — handoff refactorer ciclo 3

## Revisão dos CTAs públicos

A home deixou de envolver o card inteiro em um link de detalhe: o detalhe e o
CTA de compra agora são âncoras irmãs dentro do `article`, sem links aninhados.
O CTA usa `/go/<offer>?de=home&por=destaque`, abre em nova aba com `noopener`
e `noreferrer`, e recebeu nome acessível que identifica o produto e a nova aba.

`OffersSection` mantém `produto` como default e recebe `comparador` somente do
comparador. Assim, páginas de produto preservam o valor anterior e cada saída
da comparação passa `de=comparador`. O contrato de fonte verifica as três
ligações; a evidência S09 do root cobre o fluxo pelo navegador.

## Escopo de mutação

Importei `stryker.config.mjs` com
`MUTATION_BASE=8bba7ee28c22214b691a7ffe692993e3aa795b66`: os ranges calculados
incluem as linhas alteradas de `app/page.tsx`, `app/comparar/page.tsx` e
`components/product/OffersSection.tsx`. O escape de `[offerId]` gera o glob
`app/go/[[]offerId[]]/route.ts`, que seleciona a rota corretamente. Não há
exclusão de operador ou de linha nova.

## Verificações observadas

- `pnpm vitest run lib/categories.cards.test.ts app/go/[offerId]/route.test.ts` — 41 testes, verde.
- `pnpm lint` e `pnpm exec tsc --noEmit --incremental false` — verdes.
- `git diff --check` — verde.

Não executei E2E, mutação completa, SQL ou commit. O patch não toca consulta
ou migration; a revisão PostgreSQL anterior continua válida.

## Próximo passo

Pronto para `/gate ML54-03` ciclo 3.
