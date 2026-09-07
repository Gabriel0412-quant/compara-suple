# Validação da ML54-01

O pipeline desta tarefa usa Next.js/TypeScript, Vitest, PostgreSQL e Playwright. Os scripts Go,
Goose, River e Redis do projeto FIDC não se aplicam a este repositório.

## Comandos

```sh
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm test
pnpm test:property
pnpm test:db
pnpm build
pnpm test:mutation
pnpm test:e2e
```

`pnpm test:db` usa as variáveis `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` e `PGDATABASE` do
libpq. O banco deve ser descartável, terminar em `_test` ou começar com `test_` e ter as
migrations de `supabase/migrations/` aplicadas. Os papéis `anon`, `authenticated` e
`service_role` devem existir, como no job `database` de `.github/workflows/ci.yml`.
Os arquivos SQL de teste isolam suas fixtures com transações e rollback.

Os testes de navegador usam o stub Supabase. `E2E_APP_PORT` e `E2E_STUB_PORT` permitem usar
portas exclusivas por worktree; os valores padrão continuam 3210 e 54321. Use `CI=true` para
não reutilizar um servidor já iniciado. O build usa somente as chaves sintéticas da CI.

## Propriedades e mutação

O contrato `specs/scenarios/ml54-01.md` define a propriedade de preservação de identidade e os
casos enumerados. O gerador usa fast-check com Unicode válido, incluindo caracteres reservados,
sem tratar essas entradas sintéticas como novos identificadores aceitos pelo negócio.

Stryker executa o Vitest e produz os relatórios em `coverage/mutation/`. O gate exige inspeção
do JSON para cada sobrevivente e caso sem cobertura; sucesso do processo isoladamente não
substitui essa revisão. Mutação não acessa o Mercado Livre nem o banco real e não usa a conta
oficial de afiliados.

O escopo inclui os módulos completos `lib/affiliate.ts` e `lib/ml/offer-url.ts`, mais todas as
linhas adicionadas/alteradas de `lib/ml/ingest.ts` em relação a `origin/main`. O diff inclui
mudanças commitadas e locais. `MUTATION_BASE` permite fixar outro commit-base explicitamente;
na ML54-01, a base é `6b986d73987c4fbf935e1bfc3bcaeccefd44295b`. O limite de aprovação é 100%
nesse escopo. Não há exclusão de operadores.

A execução diagnóstica inicial dos três módulos inteiros encontrou 382 mutantes: 207 mortos,
124 sobreviventes e 51 sem cobertura. Os resultados de linhas legadas da ingestão são dívida
anterior e não ampliam o escopo desta correção. Todos os sobreviventes do resolvedor completo
e dos trechos de ingestão alterados precisam ser eliminados para aprovar a tarefa.

Referências das ferramentas: [Stryker com Vitest](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)
e [configuração do Stryker](https://stryker-mutator.io/docs/stryker-js/configuration/).
