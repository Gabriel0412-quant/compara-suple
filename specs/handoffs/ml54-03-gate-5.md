# Gate review — ML54-03 (ciclo 5)

## Veredito: APPROVED (production-ready — assumo a responsabilidade)

Gates: check **ok** · mutação **0 sobreviventes** nos módulos e intervalos alterados · integração DB **ok** · integração HTTP **ok** · contrato **10/10 coberto**.

Assumo a responsabilidade de que a implementação está pronta para produção dentro do escopo técnico da ML54-03. A aprovação alimenta a etapa E2E bloqueante, que permanece sob responsabilidade do root e não foi executada neste gate conforme solicitado.

## Defects → coder

Nenhum defeito bloqueante restante.

## Revisão de risco de produção

- A RPC valida o lote integralmente, bloqueia cada oferta, condiciona a escrita à identidade esperada e restringe execução à `service_role`, com `SECURITY DEFINER` e `search_path` explícito.
- Simulação e execução real usam o mesmo caminho e os testes SQL verificam estado persistido, rollback, contadores, idempotência e concorrência.
- A preparação de rollback deriva o fallback somente da identidade persistida e não chama cliente ML nem rede externa.
- `/go/[offerId]` preserva o `Location` persistido e continua redirecionando quando as duas gravações de tracking retornam ou lançam erro; logs não incluem URL, `review_ref`, token, segredo ou erro bruto.
- Home, lista, produto e comparador possuem um único caminho de compra por `/go`. O S09 exige exatamente duas escritas, uma em `click_event` e uma em `ui_event`.
- `OffersSection` conserva o código legado e altera apenas o tipo/default da superfície e a interpolação de `de`, reduzindo o escopo de regressão da refatoração anterior.
- CA13 e CA14 permanecem corretamente declarados como verificações operacionais pendentes; os documentos não alegam atribuição, conversão ou comissão observada.
- Não há leitura nova de tabela particionada, mudança de paginação distribuída entre camadas, segredo exposto, `TODO` ou `FIXME` no caminho entregue.

## Evidência

- `pnpm lint` — passou.
- `pnpm exec tsc --noEmit --incremental false` — passou.
- `pnpm test` — 48 arquivos, 527 testes aprovados.
- `pnpm test:property` — 1 arquivo, 2 propriedades aprovadas.
- `pnpm build` — compilação e geração das rotas concluídas.
- `pnpm test:db` — passou, incluindo os cinco cenários SQL da ML54-03 e as suítes de fallback/simulação.
- `git diff --check 8bba7ee28c22214b691a7ffe692993e3aa795b66` — passou.
- `MUTATION_BASE=8bba7ee28c22214b691a7ffe692993e3aa795b66 pnpm test:mutation` — 653 mutantes: 652 mortos, 1 timeout, 0 sobreviventes, 0 sem cobertura e mutation score coberto de 100%.
- O timeout é `BlockStatement` em `lib/ml/affiliate-links-cli.ts:180-191`. Remover o corpo de `for (let from = 0; ; from += 500)` elimina a única condição de retorno e produz deterministicamente um laço infinito; não representa sobrevivente funcional.
- Logs: `/tmp/compara-suple-ml54-logs/gate-ml54-03-cycle5-check.log` e `/tmp/compara-suple-ml54-logs/gate-ml54-03-cycle5-mutation.log`.
- JSON inspecionado: `/tmp/compara-suple-ml54-logs/gate-ml54-03-cycle5-mutation.json`.

## Defeitos dos ciclos anteriores

- D1, cobertura de desconto da home: **fechado**. Os testes cobrem desconto presente, ausente, nulo, `undefined`, igualdade e preço original inferior.
- D2, mutantes da refatoração ampla de `OffersSection`: **fechado**. O componente voltou ao baseline e as quatro linhas alteradas estão cobertas e mutation-hardened.
- D3, caminhos sem cobertura em `OffersSection`: **fechado** pela restauração do código legado; nenhum mutante do escopo atual ficou sem cobertura.
- Exigência do S09 de exatamente duas escritas: **fechada** com `expect(written).toHaveLength(2)` e asserts individuais de `click_event` e `ui_event`.

## Contrato de cenários

Os dez cenários possuem teste com o nome contratado. S01–S05 passaram contra PostgreSQL real; S06, S07 e S12 passaram nas suítes unitárias; S08 passou na integração HTTP com falhas retornadas e lançadas; S09 foi revisado no arquivo E2E e será executado uma única vez pelo root na etapa seguinte.
