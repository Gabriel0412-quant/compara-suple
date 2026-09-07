# ML54-03 — Atualizar e reverter links persistidos com saída resiliente

**Target:** full-stack (Next.js server, Supabase, rota pública e Playwright)
**Status:** aprovada e entregue localmente; CA13–CA14 operacionais pendentes
**Hardened spec:** `specs/hardened/issue-54-atribuicao-afiliados-ml.md`
**Depends on:** ML54-02

## Context

A ingestão normal atualiza `offer.url`, mas depende de coletar o catálogo no Mercado Livre. Links
já persistidos precisam de aplicação e rollback que funcionem mesmo durante indisponibilidade
externa. O banco já guarda `external_id`, `source_catalog_id` e `raw.seller_id`; o menor desenho é
atualizar apenas `url` e `raw.affiliate_link` após conferir essa identidade.

`/go/[offerId]` já usa `offer.url`, porém hoje o insert de `click_event` pode retornar erro sem
lançar e os logs de tracking podem serializar erro bruto. A saída deve continuar em 302 em todos os
modos de falha do tracking, sem expor a URL nos logs.

## Acceptance criteria

- **CA09:** a operação de links recebe lote JSON, usa o mesmo update em modo real e simulado e, com
  `p_simular=true`, devolve contadores sem alterar `offer.url`, `raw.affiliate_link` ou
  `price_history`.
- **CA10:** nova função `public.aplicar_links_afiliados_ml(p_store_id bigint, p_catalog_id text,
  p_items jsonb, p_simular boolean default false)` é executável somente por `service_role`.
- **CA10:** cada item contém `external_id`, `seller_id`, `url` e `affiliate_link`. Antes de cada escrita,
  a função confere a oferta por loja, catálogo, external ID e `raw.seller_id`; ausência,
  duplicidade ou divergência aborta a transação do lote inteiro sem persistir alteração parcial.
- **CA10:** a função muda somente `offer.url` e a chave `offer.raw.affiliate_link`. Preserva
  `offer.id`, variante, loja, external ID, catálogo, preço, disponibilidade, `ml_rank`,
  `fetched_at`, demais chaves de `raw`, histórico e eventos.
- **CA10:** repetir aplicação ou rollback com o mesmo lote é idempotente. O retorno separa itens
  recebidos, alterados e já iguais e informa `simulado` sem incluir URLs ou metadados de revisão.
- **CA10:** rollback monta o fallback com `buildMlCatalogLink(source_catalog_id, external_id)` e
  grava estado `untracked_fallback`; não importa `lib/ml/client`, não chama rede e funciona sem uma
  nova coleta.
- **CA11:** um adaptador/CLI server-side usa `supabaseAdmin` para simular, aplicar ou reverter
  entradas selecionadas. Simulação é o padrão; mutação exige opção explícita e catálogo alvo. Não
  é criado endpoint público.
- **CA11:** `/go` trata tanto exceção quanto `{ error }` retornado por `click_event`; falhas de
  `ui_event` também não bloqueiam. Todos os casos devolvem 302 com `Location` idêntico a
  `offer.url`, incluindo ordem da query, encoding e fragmento.
- **CA11:** home, lista, produto e comparador continuam construindo links internos `/go`; o E2E
  cobre as quatro superfícies e o redirect final com fixture sintética revisada.
- **CA12:** erros de `click_event`, `ui_event`, aplicação e rollback geram evento/código finito e
  identificadores de oferta ou catálogo quando necessários, sem erro bruto, URL, `review_ref`,
  token ou segredo.
- **CA13 operacional:** a documentação fornece comandos de simulação/aplicação/rollback e consulta
  de inventário que conta ofertas ativas por destino/estado e exceção. Executar em ambiente real e
  anexar o relatório ocorre depois da entrega técnica e não bloqueia aprovação do código.
- **CA14 operacional:** a documentação fornece checklist para três produtos e três vendedores e
  para observar um clique permitido no painel após a cadência documentada. O resultado real fica
  explicitamente “pendente” até a operação; não é fabricado por CI nem chamado de comissão.
- Nenhuma operação reaproveita automaticamente os 12 links históricos por catálogo. Somente
  objetos revisados aprovados pela ML54-02 entram no lote de aplicação.

## Affected code

- Nova migration sequencial `supabase/migrations/0011_ml_affiliate_links.sql` com a função,
  validações, transação/savepoint e grants restritos.
- Novo teste `supabase/tests/0011_ml_affiliate_links.test.sql` para happy path, simulação,
  idempotência, identidade divergente, atomicidade, preservação e permissões.
- Novo módulo `lib/ml/affiliate-links.ts` para preparar lotes de aplicação/rollback sem rede e
  chamar o RPC; testes unitários/propriedade com fixtures sintéticas.
- Novo script `scripts/ml-affiliate-links.ts` e script de pacote correspondente, com simulação por
  padrão e alvo de catálogo obrigatório para mutação.
- `app/go/[offerId]/route.ts` e novo `app/go/[offerId]/route.test.ts` para erros retornados/lançados,
  logs sanitizados e preservação de `Location`.
- `lib/eventos.ts` e `lib/eventos.test.ts` para tratar erro retornado pelo Supabase e não serializar
  erro bruto.
- `e2e/stub-supabase.ts` e cenário Playwright focado na rota `/go`; reutilizar asserções existentes
  das quatro superfícies sem duplicá-las.
- `docs/ml/url-afiliada-por-oferta.md` e `docs/ml/rollout-reconciliacao.md` para operação e
  evidências CA13–CA14.

Gates: lint, typecheck, Vitest, propriedade, mutação escopada com zero sobreviventes, todas as
migrations e suítes SQL em PostgreSQL isolado, build e Playwright em portas exclusivas da worktree.

## Out of scope

- Executar aplicação/rollback em produção, fazer deploy ou abrir links reais durante o pipeline.
- Tornar CA13–CA14 falsamente verdes com fixture; são evidências operacionais posteriores.
- Armazenar URL afiliada em logs ou duplicá-la dentro de `raw.affiliate_link`.
- Criar interface administrativa, endpoint público, gerador/API ou monitor periódico.
- Alterar preço, ranking, disponibilidade, vendedor ou regras do snapshot.
- Declarar clique observado como conversão ou comissão.

## Open questions

Nenhuma pergunta externa bloqueia o contrato técnico. Antes da execução operacional, o responsável
deve escolher o ambiente autorizado, o catálogo alvo e o local do relatório sanitizado. Essa
escolha não muda os testes nem a implementação desta tarefa.
