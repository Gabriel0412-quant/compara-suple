# ML54-03 — handoff refactorer ciclo 2

## Revisão D1

A correção representa a semântica real do parser: flags ausentes não carregam
um valor booleano artificial e flags presentes só podem ser `true`. O estado
inicial vazio preserva a simulação padrão por `!state.apply`; a rejeição de
duplicidade permanece em `setUniqueCliFlag`. O teste adicionado para a ordem
`--rollback --apply --catalog` prova que as flags independem da posição.

Não fiz alteração adicional de runtime. O parser continua com
`complexity <= 6`; a divisão anterior permanece coesa e sem duplicação.

## Verificações observadas

- `pnpm vitest run lib/ml/affiliate-links.test.ts lib/ml/affiliate-links.property.test.ts lib/ml/affiliate-links-cli.test.ts lib/ml/affiliate-links-cli-default.test.ts` — 73 testes, verde.
- `pnpm lint` e `pnpm exec tsc --noEmit --incremental false` — verdes.
- ESLint explícito com `complexity <= 6` em `lib/ml/affiliate-links.ts` e `git diff --check` — verdes.
- Evidência do coder: mutação isolada do parser com 104 mortos, zero sobreviventes e zero sem cobertura.

SQL e migrações não foram tocados neste ciclo; a revisão PostgreSQL do
handoff anterior permanece válida. Não executei E2E, mutação nem commit.

## Próximo passo

Pronto para `/gate ML54-03`.
