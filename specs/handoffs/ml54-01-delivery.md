# ML54-01 — entrega integrada

Branch: `fix/ml54-01-affiliate-fallback`.
Base: `6b986d73987c4fbf935e1bfc3bcaeccefd44295b`.

Os checkpoints de tarefas e cenários foram aprovados pelo usuário. A implementação seguiu
coder → refactorer → gatekeeper; o primeiro gate pediu seis reforços de teste, todos fechados
no segundo ciclo. O segundo gate aprovou os 11 cenários.

## Verificação final

- Lint, tipos, 374 testes Vitest e build: passaram.
- Propriedade com 200 gerações e suítes PostgreSQL: passaram.
- Mutação escopada: 81 mortos, zero sobreviventes, zero sem cobertura.
- Playwright: 98 testes passaram em 35,9 segundos, uma execução integrada sem retry.
- `git diff --check`: passou.

O E2E usou Chromium e o stub Supabase nas portas isoladas 3311/55311. O banco de testes foi
um PostgreSQL 15 separado, sem usar dados ou credenciais de produção. Log final de navegador:
`/tmp/compara-suple-ml54-logs/e2e-final.log`.

## Resultado e limites

Não há atribuição inferida por tag nem publicação de URLs manuais legadas. Cada oferta usa
fallback com o próprio anúncio e retorna classificação e contadores explícitos. A ingestão
continua preservando preço, disponibilidade e identidade; não houve migration.

O código passa a produzir os novos destinos quando a ingestão executar. Esta entrega não fez
deploy, coleta, backfill ou rollback em produção, e não comprovou comissão no painel oficial.
ML54-02 e ML54-03 continuam dependentes de evidência do mecanismo/conta oficial e operação.

As alterações preexistentes em `/app/compara-suple` foram preservadas. Este commit pertence
à worktree isolada `/tmp/compara-suple-ml54-01`; não houve push ou abertura de PR.
