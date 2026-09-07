# ML54-03 — handoff refactorer ciclo 4

## Revisão e refatoração

`FallingCard` continua exportado para o contrato SSR. A apresentação do preço
e desconto foi extraída para helpers locais, mantendo CTA condicional, URL
`/go` exata, `noopener noreferrer sponsored` e o nome acessível.

Em `OffersSection`, a composição foi separada em cabeçalho, filtros, tabela,
linha, células e rodapé. A superfície permanece default `produto`; a célula
de compra recebe `comparador` apenas pela prop. A saída renderizada conserva a
classificação de menor preço, preço destacado e os dois destinos testados em
SSR.

## Complexidade e testes

- ESLint explícito com `complexity <= 6` em `app/page.tsx` e
  `components/product/OffersSection.tsx` — verde.
- `pnpm vitest run app/page.test.tsx components/product/OffersSection.test.tsx lib/categories.cards.test.ts` — 19 testes, verde.
- `pnpm lint`, `pnpm exec tsc --noEmit --incremental false` e
  `git diff --check` — verdes.

O coder observou antes desta refatoração a mutação completa 626 mortos, zero
sobreviventes e zero sem cobertura, com um timeout legítimo de paginação. O
gate deve repeti-la para cobrir os helpers extraídos. SQL, migration, E2E e
commit não foram executados neste ciclo; a revisão PostgreSQL anterior
permanece válida.

## Próximo passo

Pronto para `/gate ML54-03` ciclo 4.
