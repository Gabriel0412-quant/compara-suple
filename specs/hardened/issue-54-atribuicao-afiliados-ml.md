# Issue #54 — atribuição confiável nos links do Mercado Livre

## Status da especificação

O defeito local está confirmado: o código atual trata qualquer valor de
`ML_AFFILIATE_TAG` e qualquer URL manual HTTPS com `wid` correspondente como prova de
afiliação. Essa classificação não é sustentada por evidência oficial.

A correção tem dois resultados separáveis:

1. impedir imediatamente que um fallback ou dado legado seja declarado afiliado;
2. publicar links oficiais e demonstrar atribuição na conta correta.

O primeiro resultado está pronto para implementação. O segundo depende dos insumos externos
listados em **Open questions**. A issue só pode ser encerrada como “atribuição restaurada” quando
os dois resultados estiverem concluídos.

## Escopo e vocabulário

- **Oferta**: anúncio do Mercado Livre identificado por `offer.external_id`, associado a
  `store`, `variant` e `source_catalog_id`.
- **Candidato oficial**: URL emitida por um mecanismo oficial e cuja proveniência pode ser
  demonstrada. Uma URL digitada em `data/items.json`, um domínio com aparência válida e a
  presença de `affiliate=` não constituem essa prova.
- **Link oficial validado**: candidato oficial preservado byte a byte cuja associação à conta
  esperada e à mesma oferta foi validada pelo procedimento aprovado.
- **Fallback**: URL comprável construída somente de `catalogId` e `external_id`; conserva o
  anúncio, mas não declara atribuição.
- **Atribuição observada**: clique que aparece nas métricas oficiais da conta/etiqueta dentro da
  janela documentada pelo programa. É evidência operacional e não muda retrospectivamente o
  estado de outras URLs.

Para cada oferta resolvida, o domínio deve representar separadamente:

| Dimensão | Valores mínimos | Semântica |
| --- | --- | --- |
| origem | `official_generated`, `official_imported`, `none` | proveniência do candidato |
| validação | `validated`, `unverified`, `rejected`, `temporarily_unavailable`, `absent` | resultado da validação desta oferta |
| destino | `official_affiliate`, `untracked_fallback` | URL efetivamente publicada |
| motivo | código finito e sanitizado | causa do estado, sem URL nem mensagem externa bruta |
| evidência do candidato | referência privada, data e versão do procedimento | obrigatória para validado; pode registrar tentativa rejeitada/temporária sem promover o fallback |

`tracked` é removido do contrato interno atual, pois seus únicos consumidores locais são o
resolvedor, a ingestão e seus testes. Consumidores futuros devem usar as dimensões acima. A
classificação de destino nunca significa clique, conversão ou comissão.

## Fluxo afetado

```text
data/items.json ou fonte oficial aprovada
              ↓
      resolução e validação
              ↓
  link oficial validado ── ou ── fallback por oferta
              ↓
       ingestão/reconciliação
              ↓
 offer.url + estado/evidência duráveis
              ↓
        GET /go/[offerId]
              ↓
 Location 302 + tracking interno não bloqueante
```

O código atual relevante está em `lib/affiliate.ts`, `lib/ml/offer-url.ts`,
`lib/ml/ingest.ts`, `app/api/cron/ml-ingest/route.ts`, `app/go/[offerId]/route.ts` e
`supabase/migrations/0007_reconciliar_simulacao.sql`. Os consumidores públicos dos links ficam
nas páginas/componentes de home, lista, produto e comparador e nos testes Playwright em `e2e/`.

## Regras funcionais endurecidas

### Fallback e falsa confiança

- Tag ausente, arbitrária ou composta apenas por espaços nunca valida afiliação e nunca adiciona
  um parâmetro de afiliação inventado ao fallback.
- URL manual/legada sem proveniência oficial registrada permanece `unverified`, mesmo quando usa
  HTTPS, host do Mercado Livre e `wid` correto.
- O fallback de catálogo MLB é
  `https://www.mercadolivre.com.br/p/{catalogId}?wid={externalId}`; o de user product MLBU usa
  `/up/`. `catalogId` e `externalId` são codificados como dados e o `wid` é único.
- A falta ou recusa de afiliação não muda preço, ranking, disponibilidade, variante, catálogo ou
  vendedor e não interrompe as demais ofertas.
- `sem_tag_de_afiliado` é descontinuado ou explicitamente marcado como contador legado. Zero
  nesse campo não representa sucesso de afiliação.

### Candidato oficial e integridade

- Só a fonte aprovada após resposta às perguntas externas pode produzir origem
  `official_generated` ou `official_imported`.
- O link oficial selecionado é persistido e redirecionado sem acrescentar, remover, reordenar ou
  reconstruir parâmetros, codificação ou fragmento.
- O vínculo deve demonstrar a mesma `external_id` e evidência suficiente de que o anúncio pertence
  ao vendedor da oferta. Se o mecanismo não permitir demonstrar ambos, o candidato não pode ser
  validado. Um link de catálogo, uma chave duplicada/ambígua ou um `wid` divergente é `rejected` e
  seleciona o fallback da oferta.
- A allowlist de hosts e formatos será derivada de documentação e exemplos oficiais aprovados;
  não se aceita automaticamente qualquer subdomínio de um sufixo conhecido.
- Todo candidato, com ou sem expansão de redirects, deve usar HTTPS, porta padrão, não conter
  usuário/senha e pertencer à allowlist exata aprovada.
- Se o mecanismo aprovado não exigir resolução HTTP, a implementação não deve introduzi-la.
- Se exigir resolução HTTP, cada próximo destino deve ser validado antes da requisição, com no
  máximo cinco redirecionamentos e dez segundos no total. Usuário/senha na URL, porta não
  aprovada, destinos locais/privados/reservados após resolução DNS, host fora da allowlist, loop e
  sexto redirecionamento são `rejected`. Timeout, 429, 5xx e bloqueio inconclusivo são
  `temporarily_unavailable`. Todos selecionam fallback.
- A validação externa nunca roda na requisição pública `/go`, não envia cookies ou credenciais de
  administração, não chama `/go` e não cria `click_event` ou `ui_event`.

### Persistência, simulação e recuperação

- `offer.url` continua sendo a fonte usada por `/go` para o destino publicado.
- Origem, validação, motivo e referência da evidência do candidato devem sobreviver a outra execução e estar
  associados inequivocamente à oferta. O desenho físico só será fechado após conhecer o formato e
  a fonte oficial; não se exige antecipadamente uma tabela, coluna ou migração específica.
- Um fallback não recebe evidência de afiliação validada. Quando houver candidato rejeitado ou
  temporariamente indisponível, sua tentativa pode conservar uma referência privada auditável,
  separada da classificação do destino.
- Se o schema atual não representar esses fatos sem ambiguidade, a tarefa de persistência inclui
  migration forward-only e teste SQL. Registros existentes começam como `unverified`; a presença
  de `affiliate=` nunca promove legado.
- A simulação usa o mesmo payload da execução real e não altera `offer`, `price_history` nem o
  estado publicado/evidência de links. Efeitos idempotentes já existentes sobre
  `brand`/`product`/`variant` devem continuar documentados.
- Reprocessar o mesmo lote preserva `offer.id`, `external_id`, relacionamentos e não duplica
  evidência. Uma atualização válida muda o destino e o estado da oferta existente.
- O rollback de dados restaura fallback a partir da identidade persistida, sem consultar o
  Mercado Livre, e preserva preço, disponibilidade, ranking, histórico e eventos.
- Rejeitar ou perder temporariamente um novo candidato não remove uma URL de compra funcional.

### Saída pública, contadores e segurança

- `/go/[offerId]` devolve 302 com a `offer.url` selecionada sem remontá-la. Falha em
  `click_event` ou `ui_event` não bloqueia o redirecionamento.
- Home, listagem, produto e comparador continuam usando `/go`; não surge caminho externo paralelo.
- Por catálogo e no agregado, `resolvidas = oficiais_validados + fallbacks`. Fallbacks são
  separados em `absent`, `unverified`, `rejected` e `temporarily_unavailable`. Catálogos não
  processados ficam fora de `resolvidas` e aparecem por status.
- Contadores não recebem nomes que prometam clique ou comissão. A evidência do painel é registrada
  separadamente.
- Logs, retorno do cron, erros e artefatos não contêm URL afiliada completa, token, segredo ou
  mensagem externa bruta. O header `Location` pode conter apenas o link público de divulgação
  selecionado; nunca credencial administrativa.

## Comportamento de erro

| Evento | Estado | Destino | Efeito no lote |
| --- | --- | --- | --- |
| sem candidato oficial | `absent` | fallback | continua |
| manual/legado sem prova | `unverified` | fallback | continua |
| formato, host ou vínculo inválido | `rejected` | fallback | continua e conta motivo sanitizado |
| timeout, 429, 5xx ou bloqueio inconclusivo | `temporarily_unavailable` | fallback | continua e conta motivo sanitizado |
| falha de persistência de um catálogo | status de catálogo já existente | destino anterior funcional | isola conforme contrato atual |
| falha de conexão/configuração estrutural | erro do job já existente | nenhum sucesso inventado | propaga conforme contrato atual |
| falha de tracking em `/go` | não altera validação | URL persistida | responde 302 |

Não há novo endpoint público nem novo formato de credencial definido por esta especificação.

## Critérios de aceite

| ID | Critério verificável | Tarefa |
| --- | --- | --- |
| CA01 | Dada tag ausente, arbitrária ou em branco, ao resolver uma oferta, então o resultado é fallback sem afiliação declarada e com o `wid` da oferta. | ML54-01 |
| CA02 | Dada URL manual HTTPS com `wid` correto e sem evidência oficial, ao resolver, então ela fica `unverified`, não é publicada e conta como fallback. | ML54-01 |
| CA03 | Dado candidato emitido/importado pelo mecanismo aprovado e evidência válida, ao resolver, então ele é selecionado sem qualquer alteração e associado à oferta comprovada. | ML54-02 |
| CA04 | Dadas ofertas A e B do mesmo catálogo, a URL de A nunca é publicada para B; vínculo inexato, catálogo genérico e identificador duplicado/ambíguo são recusados. | ML54-02 |
| CA05 | Dados catálogo MLB e user product MLBU, seus fallbacks usam `/p/` e `/up/`, respectivamente, com `external_id` correto e sem parâmetro de afiliação inventado. | ML54-01 |
| CA06 | Todo candidato com protocolo/porta/credencial/host proibido ou vínculo insuficiente é recusado. Quando houver resolução HTTP, IP privado ou reservado, redirect proibido, loop e sexto redirect também são recusados antes de acessar o destino proibido, com fallback e sem vazamento. Sem resolução HTTP, somente a parte de cadeia/DNS fica não aplicável e nenhum cliente HTTP é criado. | ML54-02 |
| CA07 | Quando houver resolução HTTP, timeout total, 429, 5xx e bloqueio inconclusivo produzem `temporarily_unavailable`, fallback e continuidade do catálogo. Sem resolução HTTP, aplica-se a mesma condição de não aplicabilidade de CA06. | ML54-02 |
| CA08 | Dada mistura de oficiais validados, ausentes, não verificados, rejeitados e temporários, os contadores fecham por catálogo e agregado; catálogos não processados aparecem separados. | ML54-01, ML54-02, ML54-03 |
| CA09 | Dada uma simulação, o payload é o mesmo da execução real e `offer`, `price_history` e estado/evidência publicada permanecem inalterados; efeitos auxiliares existentes são documentados. | ML54-01 (persistência de fallback e simulação); ML54-03 (contrato completo) |
| CA10 | Dada atualização ou repetição do lote, IDs e vínculos são preservados e evidência não duplica; dado rollback, as ofertas afetadas voltam ao fallback sem consulta externa. | ML54-01 (persistência de fallback e simulação); ML54-03 (contrato completo) |
| CA11 | Dado clique nas quatro superfícies públicas, a navegação passa por `/go`; a resposta 302 preserva o destino escolhido e continua mesmo se o tracking interno falhar; validação/prévia não gera eventos. | ML54-03 |
| CA12 | Dados logs, cron, erros e fixtures, nenhum expõe URL/token/segredo real; `Location` contém somente o link público selecionado. | ML54-01, ML54-02, ML54-03 |
| CA13 | Um inventário datado cobre todas as ofertas ativas elegíveis e registra exceções por motivo; cobertura parcial mantém a restauração integral pendente. | ML54-03 |
| CA14 | Em amostra de pelo menos três produtos e três vendedores distintos, a identidade é preservada e ao menos um clique permitido aparece na conta/etiqueta e janela oficiais registradas. | ML54-03 |

## Dependências e ordem

| Tarefa | Estado no Checkpoint 1 | Dependências |
| --- | --- | --- |
| ML54-01 | pronta | nenhuma; entrega a correção local de falsa confiança |
| ML54-02 | bloqueada para cenário/implementação | respostas 1–4 de **Open questions** e fixture oficial sanitizada |
| ML54-03 | bloqueada | ML54-02 aprovada, acesso ao banco/ambiente e à conta de afiliados para CA13–CA14 |

ML54-01 pode ser entregue sem afirmar que a monetização foi restaurada. ML54-02 e ML54-03 não
podem inferir API, template de URL, host, credencial, prazo de métricas ou elegibilidade.

## Gates adaptados ao repositório

Este repositório é Next.js/TypeScript + Supabase, não Go/FIDC. Para cada tarefa aplicável:

- `corepack pnpm lint`;
- `corepack pnpm exec tsc --noEmit --incremental false`;
- `corepack pnpm test` com Vitest e transporte/fixtures sintéticos;
- `corepack pnpm build` com credenciais falsas de CI;
- migrations e todos os arquivos `supabase/tests/*.sql` em PostgreSQL isolado quando houver SQL;
- `corepack pnpm test:e2e` com Playwright/stub para fluxos públicos, em portas exclusivas da
  worktree e sem reutilizar servidor alheio;
- conferência operacional de CA13–CA14 fora da CI, sem compra artificial.

O repositório não possui hoje Stryker nem fast-check. Antes de aprovar nos estágios de
refatoração/gate, a lane deve instalar/configurar essas ferramentas ou definir um gate TypeScript
equivalente explicitamente aprovado. Enquanto isso não ocorrer, mutação/propriedade estão
bloqueadas; sua ausência não pode ser registrada como passe. `scripts/pipeline-sandbox.sh` é específico do
stack Go/Goose/River/Redis de `/app` e não deve provisionar este projeto; a continuação usa
worktree dedicada e serviços/portas isolados.

## Fora de escopo

- Interface administrativa da #149 e monitoração/fila da #150.
- Importação de conversões ou comissões das issues #80, #102 e #103.
- Escolha automática de outro vendedor, alteração de ranking ou redesign de ofertas.
- Scraping ou automação do portal de afiliados.
- Descoberta de um template por tentativa, configuração de API não documentada ou criação de
  credencial fictícia.
- Compra artificial, garantia de comissão ou equiparação de clique, conversão e comissão.
- Alteração das regras de snapshot/reconciliação do EP02 além do estado do link selecionado.

## Open questions

As perguntas abaixo bloqueiam ML54-02 e ML54-03, mas não ML54-01:

1. Qual link sanitizado foi produzido pelo mecanismo oficial para uma oferta controlada, em qual
   data e com qual referência privada à conta/etiqueta?
2. Quais hosts, formatos e redirecionamentos esse mecanismo realmente usa, e qual informação
   oficial permite provar anúncio e vendedor sem alterar o link?
3. A conta possui API oficial documentada e autorizada para geração/consulta? Se não, qual será o
   procedimento repetível de importação por `item_id`?
4. Qual é a janela oficial para uma métrica de clique aparecer e qual conferência é permitida sem
   violar as regras do programa?
5. Quais canais/ofertas do inventário atual são elegíveis e qual decisão de produto vale se a
   cobertura oficial for parcial?
