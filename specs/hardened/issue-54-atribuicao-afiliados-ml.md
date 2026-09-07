# Issue #54 — atribuição confiável nos links do Mercado Livre

## Status da especificação

O defeito de falsa atribuição foi corrigido pela ML54-01 no commit `5a265a1`: tags arbitrárias e
strings manuais legadas não são publicadas como afiliadas, e cada oferta recebe um fallback sem
afiliação inventada.

As pendências usam a base existente. `data/items.json` continua sendo a curadoria; o mapa
`affiliate_urls` continua chaveado por `external_id`; o `seller_id` do snapshot confirma o vendedor;
`reconciliar_catalogo` continua persistindo `offer.url` e `offer.raw` no mesmo upsert; `/go` continua
redirecionando a URL persistida.

O mecanismo de desenvolvimento é uma importação manual revisada por oferta. Não há geração de URL,
API nova nem expansão HTTP. O código e os testes usam entradas sintéticas e podem ser concluídos sem
acesso à conta. Cobertura real e atribuição observada no painel são verificações operacionais
posteriores e não bloqueiam a entrega técnica.

## Evidência e limites conhecidos

O histórico do repositório contém 12 URLs sociais singulares no commit `159d5c8`, uma por catálogo.
Elas usam `https://www.mercadolivre.com.br/social/...`, mas não carregam `wid`, `item_id` ou vendedor
visíveis. Esses links não podem ser distribuídos automaticamente entre ofertas. Só podem voltar à
curadoria quando um operador escolher uma `external_id`, registrar o `seller_id` correspondente e
revisar a associação. O título de um commit histórico não vale como essa revisão.

Uma entrada revisada prova que o operador conferiu a associação usada pela aplicação. Ela não prova
que o painel registrou o clique, que houve conversão ou que haverá comissão.

## Vocabulário e estados

- **Oferta**: anúncio identificado por `external_id`, `seller_id`, `source_catalog_id` e loja.
- **Entrada legada**: string atual em `affiliate_urls`; permanece `legacy_manual` e nunca é publicada.
- **Importação revisada**: objeto da curadoria, chaveado por `external_id`, com URL integral,
  `seller_id`, data da revisão e referência opaca cujo conteúdo é responsabilidade da curadoria.
- **Link afiliado revisado**: URL de uma importação revisada que passa pela validação local e cujo
  `seller_id` coincide com a oferta do snapshot.
- **Fallback**: URL comprável construída de `catalogId` + `external_id`, sem afirmar afiliação.
- **Atribuição observada**: clique que aparece no painel da conta/etiqueta após a publicação.

O modelo de resolução estende o contrato entregue na ML54-01:

| Dimensão | Valores mínimos | Semântica |
| --- | --- | --- |
| origem | `none`, `legacy_manual`, `reviewed_import` | proveniência local |
| validação | `absent`, `unverified`, `rejected`, `reviewed` | resultado determinístico desta entrada |
| destino | `untracked_fallback`, `affiliate_link` | URL efetivamente selecionada |
| motivo | código finito | causa sanitizada, sem URL ou erro bruto |
| metadados | `seller_id`, `reviewed_at`, `review_ref` | auditoria mínima da revisão por oferta |

`reviewed_import` e `reviewed` não significam atribuição observada. `tracked` não volta ao contrato.

## Formato de curadoria

`affiliate_urls` aceita duas formas sob a chave `external_id`:

```jsonc
{
  "affiliate_urls": {
    "MLB123456789": "string-legada-nao-publicavel",
    "MLB987654321": {
      "url": "https://www.mercadolivre.com.br/social/exemplo?ref=valor-sintetico",
      "seller_id": 123456,
      "reviewed_at": "2026-09-06",
      "review_ref": "ml-affiliate-review-0001"
    }
  }
}
```

Regras do objeto revisado:

- a chave deve ser uma `external_id` válida e corresponder exatamente à oferta processada;
- `seller_id` deve ser inteiro positivo e igual ao `seller_id` do snapshot dessa oferta;
- `reviewed_at` usa `YYYY-MM-DD` e deve ser uma data civil válida;
- `review_ref` é identificador opaco, não vazio, limitado a 120 caracteres e formado por letras
  ASCII, números, `.`, `_`, `:` ou `-`; a curadoria responde pelo conteúdo, inclusive por não
  inserir URL, token, cookie, e-mail ou segredo, pois o código aplica somente formato e tamanho;
- `url` deve ser preservada como string original após a validação, sem reconstrução;
- strings legadas continuam compatíveis e `unverified`; o campo singular `affiliate_url` por
  catálogo continua ignorado.

A auditoria humana detalhada permanece fora do JSON público. O histórico Git identifica a mudança;
`review_ref` apenas correlaciona a entrada com uma evidência operacional guardada fora do catálogo.

## Validação local e seleção

- A importação revisada só é publicável se todos os metadados forem válidos e o vendedor coincidir.
- Uma URL revisada compartilhada entre anúncios diferentes no mapa do catálogo é ambígua;
  todas as entradas envolvidas usam fallback, sem escolher um anúncio arbitrariamente.
- A URL deve ser absoluta, HTTPS e ter autoridade textual exatamente
  `www.mercadolivre.com.br` com pathname `/social/<segmento-nao-vazio>`, ou `meli.la` com um
  único segmento não vazio. A conferência ocorre também sobre a string original, antes de confiar
  nos campos normalizados por `URL`, para rejeitar usuário/senha e qualquer porta explícita,
  inclusive `:443`.
- Ambos os formatos não aceitam barra adicional. `meli.la` é aceito somente como URL curta emitida
  pela Barra de afiliados para uma entrada revisada por oferta e vendedor; outros hosts ou caminhos
  permanecem rejeitados até uma mudança revisada de contrato.
- Query string, ordem de parâmetros, percent-encoding e fragmento não são alterados.
- Não se exige `wid` de uma URL social. Quando o parâmetro existir, deve haver exatamente um e seu
  valor deve ser igual à chave `external_id`; `wid` divergente ou duplicado rejeita a entrada. Sem
  `wid`, a identidade vem da chave `external_id`, do `seller_id` revisado e da comparação com o
  snapshot. Uma string social no nível do catálogo não satisfaz isso.
- Metadado inválido, vendedor divergente ou URL estruturalmente inválida seleciona o fallback da
  própria oferta e incrementa um motivo finito.
- A validação não usa `fetch`, não segue redirects, não resolve DNS, não abre `/go` e não grava
  `click_event` ou `ui_event`. Assim, timeout/429/5xx/SSRF não fazem parte deste mecanismo.
- Uma falha afeta somente a entrada correspondente; preço, ranking, disponibilidade e as outras
  ofertas continuam sendo processados.

## Persistência e reconciliação

- Para cada oferta, `raw.affiliate_link` guarda somente `origin`, `validation`, `destination`,
  `reason`, `seller_id`, `reviewed_at` e `review_ref` aplicáveis. Não duplica a URL e não guarda
  evidência privada.
- O `raw` já contém `seller_id` e `catalog_id`. A ingestão acrescenta `affiliate_link` antes de
  chamar `reconciliar_catalogo`; o upsert atual persiste `offer.url` e `offer.raw` atomicamente.
- Não é necessária uma tabela paralela nem migration de coluna para o estado da resolução.
- A simulação usa o mesmo payload e o savepoint atual: não altera `offer`, `price_history` ou
  `raw.affiliate_link`. Os upserts auxiliares existentes de brand/product/variant continuam
  documentados.
- Repetir a ingestão com o mesmo snapshot e curadoria é idempotente e preserva `offer.id`, `external_id`,
  relacionamentos e histórico.
- Atualização e rollback de links existentes não dependem de nova coleta. Uma função SQL restrita a
  `service_role` atualiza somente `offer.url` e `raw.affiliate_link`, depois de conferir loja,
  catálogo, `external_id` e `seller_id` armazenados.
- A função aceita `p_simular`; o modo simulado executa o mesmo update em savepoint e o desfaz. Lote
  com oferta ausente ou identidade divergente aborta a transação inteira, sem persistir alterações parciais.
- O rollback calcula o fallback com o builder existente a partir de `source_catalog_id` e
  `external_id`, grava estado `untracked_fallback` e não consulta o Mercado Livre.
- Aplicação e rollback preservam preço, disponibilidade, `ml_rank`, `fetched_at`, restante de
  `raw`, `price_history`, `click_event` e `ui_event`.

## Saída pública e observabilidade

- `/go/[offerId]` devolve 302 com `offer.url` sem reconstrução. A ordem da query, o encoding e o
  fragmento são preservados no `Location`.
- Erro retornado ou lançado por `click_event` e erro de `ui_event` não impedem o 302. Logs usam
  evento e código finitos; não serializam erro bruto nem a URL.
- Home, lista, produto e comparador continuam apontando para `/go`; não surge saída paralela.
- Por catálogo e agregado, `resolvidas = affiliate_reviewed + fallback`. Os motivos de fallback e
  rejeição permanecem mutuamente exclusivos. Catálogos não processados ficam separados.
- Logs e resposta do cron não incluem URL afiliada, `review_ref`, token ou segredo.

## Critérios de aceite e tarefas

| ID | Critério verificável | Tarefa |
| --- | --- | --- |
| CA01 | Tags ausentes, arbitrárias ou vazias resultam em fallback sem falsa atribuição e com `wid` da oferta. | ML54-01 concluída |
| CA02 | Strings manuais legadas continuam não verificadas, não publicadas e contabilizadas como fallback. | ML54-01 concluída |
| CA03 | Objeto revisado válido seleciona sua URL integral, com origem `reviewed_import`, validação `reviewed` e destino `affiliate_link`. | ML54-02 |
| CA04 | A URL de A nunca é usada por B; chave ou vendedor divergente e `wid` divergente/duplicado são rejeitados com fallback. Uma URL social sem `wid` só passa com mapa por oferta e seller revisado coincidentes. | ML54-02 |
| CA05 | Fallbacks MLB/MLBU usam `/p/` e `/up/` com `external_id` correto e sem afiliação inventada. | ML54-01 concluída |
| CA06 | URL revisada com HTTP, userinfo, qualquer porta explícita, host parecido/alternativo, segmento social vazio ou barra extra é rejeitada localmente; nenhuma rede é acessada. | ML54-02 |
| CA07 | A resolução direta não executa HTTP; teste comprova zero chamadas de rede. Estados de timeout, 429 e 5xx não são fabricados para um transporte inexistente. | ML54-02 |
| CA08 | Mistura de importações revisadas, ausentes, legadas e rejeitadas fecha contadores por catálogo e agregado; catálogos falhos ficam separados. | ML54-02 |
| CA09 | Simulação usa o payload real e não muda URL, `raw.affiliate_link` ou histórico. | ML54-03 |
| CA10 | Aplicação repetida preserva identidades; backfill e rollback mudam somente URL/estado. A preparação é offline e o adaptador acessa somente o banco, sem nova coleta ML. | ML54-03 |
| CA11 | Quatro superfícies usam `/go`; 302 preserva o link e tolera falhas retornadas ou lançadas pelos dois trackings. | ML54-03 |
| CA12 | A curadoria e o `Location` contêm a URL pública de divulgação como dado funcional; logs, cron e erros não repetem URL nem `review_ref` e nunca expõem segredo ou erro bruto. | ML54-02, ML54-03 |
| CA13 | Procedimento gera inventário datado de cobertura e exceções; a execução em ambiente real ocorre depois da entrega técnica. | ML54-03 operacional |
| CA14 | Procedimento confere três produtos/vendedores e um clique no painel após a janela documentada; resultado continua pendente até execução real. | ML54-03 operacional |

## Ordem e estado

| Tarefa | Estado | Dependência |
| --- | --- | --- |
| ML54-01 | concluída em `5a265a1` | nenhuma |
| ML54-02 | concluída em `8bba7ee` | ML54-01 concluída |
| ML54-03 | concluída localmente; gate e E2E aprovados | ML54-02 concluída |
| fechamento operacional CA13–CA14 | pendente após publicação/configuração | entrega técnica + ambiente autorizado |

A falta de URLs reais na curadoria não bloqueia os cenários nem o código: testes usam fixtures
sintéticas. Ela apenas mantém `affiliate_reviewed = 0` e todas as ofertas em fallback até a operação.

## Comportamento de erro

| Evento | Resultado |
| --- | --- |
| string legada | `unverified` + fallback |
| metadados ausentes/inválidos | `rejected` + motivo finito + fallback |
| vendedor diferente do snapshot | `rejected` + `fallback_seller` + fallback |
| URL inválida ou fora do formato local aprovado | `rejected` + motivo estrutural + fallback |
| oferta/identidade divergente no backfill | transação do lote abortada, sem alterações parciais persistidas |
| falha de banco no backfill | erro propagado, transação revertida |
| falha de tracking em `/go` | log sanitizado e 302 preservado |

## Gates adaptados ao repositório

- `corepack pnpm lint`;
- `corepack pnpm exec tsc --noEmit --incremental false`;
- `corepack pnpm test` e testes Vitest focados;
- `corepack pnpm test:property` para invariantes do resolvedor;
- `corepack pnpm test:mutation`, exigindo zero sobreviventes no escopo alterado;
- `corepack pnpm test:db` em PostgreSQL isolado quando houver SQL;
- `corepack pnpm build` com variáveis sintéticas de CI;
- `corepack pnpm test:e2e` em Chromium/stub e portas exclusivas da worktree.

Testes não abrem links reais. CA13–CA14 usam checklist operacional depois da entrega técnica e não
substituem os gates automatizados.

## Fora de escopo

- Gerar URLs, criar API ou usar endpoints privados do portal.
- Expandir links, resolver DNS ou validar atribuição por HTTP.
- Reaproveitar automaticamente os 12 links históricos de catálogo.
- Interface administrativa da #149, monitor/fila da #150 e importação de conversões/comissões.
- Escolher outro vendedor, alterar ranking/preço ou redesenhar ofertas.
- Fazer deploy, acessar produção, clicar links reais ou prometer comissão durante a implementação.

## Open questions

Nenhuma pergunta externa bloqueia ML54-02 ou a implementação técnica de ML54-03. Para o fechamento
operacional, ainda será necessário definir quem executa o inventário, qual ambiente recebe a
curadoria revisada e onde a evidência de CA13–CA14 será registrada. Essas decisões não alteram o
contrato de código acima.
