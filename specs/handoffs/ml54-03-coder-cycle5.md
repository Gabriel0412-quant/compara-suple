# ML54-03 — handoff coder, ciclo 5

## Resultado

Fechado o D4 do gate. `OffersSection` voltou à estrutura legada da base da
tarefa e conserva somente o prop `superficie`, com padrão `produto`, aplicado
à URL de compra. Os testes SSR cobrem os dois destinos. `FallingCard` agora
expressa preço original e selo de desconto por componentes que retornam nulo
para valores ausentes; os testes cobrem desconto presente, ausente, nulo e
`undefined` em runtime.

## Verificações observadas

- `pnpm vitest run app/page.test.tsx components/product/OffersSection.test.tsx` — 7 testes verdes.
- `pnpm exec tsc --noEmit --incremental false` — verde.
- `pnpm lint` e `git diff --check` — verdes.
- `MUTATION_BASE=8bba7ee28c22214b691a7ffe692993e3aa795b66 pnpm test:mutation` — 652 mortos, 0 sobreviventes, 0 sem cobertura e 1 timeout da paginação já aceito pelo gate.

## Próximo estágio

Executar `/refactor ml54-03`.
