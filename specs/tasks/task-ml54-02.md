# ML54-02 — Importar links revisados por oferta

**Target:** backend (`data/`, `lib/ml/` e ingestão server-side)
**Status:** implementada e aprovada no gate 3; integrada nesta branch
**Hardened spec:** `specs/hardened/issue-54-atribuicao-afiliados-ml.md`
**Depends on:** ML54-01, concluída em `5a265a1`

## Context

A ML54-01 mantém todas as strings de `affiliate_urls` como legado não verificável. A continuação
usa o mesmo mapa por `external_id`, mas permite que um operador transforme uma entrada em objeto
revisado com `url`, `seller_id`, `reviewed_at` e `review_ref`. A ingestão já possui o
`offer.seller_id` validado no snapshot e já persiste `url` e `raw` no mesmo RPC.

Os 12 links sociais históricos de `159d5c8` existem somente no campo singular por catálogo, sem
item ou vendedor demonstrável. Eles não serão migrados automaticamente. Testes usam URLs e
metadados sintéticos; a curadoria real pode continuar vazia.

## Acceptance criteria

- **CA03:** `affiliate_urls[external_id]` aceita a string legada atual e o objeto revisado:
  `{ url, seller_id, reviewed_at, review_ref }`. Um objeto válido e com vendedor igual ao snapshot
  seleciona a string `url` original, `destination=affiliate_link`, `origin=reviewed_import`,
  `validation=reviewed` e motivo finito de sucesso.
- **CA03:** a URL selecionada é exatamente a string importada. Nenhum parâmetro, ordem,
  percent-encoding ou fragmento é alterado, e `raw.affiliate_link` não duplica a URL.
- **CA04:** a chave do mapa deve coincidir com `offer.item_id` e `seller_id` deve coincidir com
  `offer.seller_id`. Divergência, inteiro não positivo, objeto incompleto ou metadado ambíguo
  produz `rejected` e fallback somente para essa oferta.
- **CA04:** `wid` é opcional em uma URL social revisada; se existir, `searchParams.getAll('wid')`
  deve devolver exatamente um valor igual à chave `external_id`. `wid` divergente ou duplicado é
  rejeitado. A ausência de `wid` só é aceita porque o mapa por oferta e o seller revisado
  coincidem com o snapshot.
- **CA04:** o campo legado singular `affiliate_url` continua ignorado. Os links históricos por
  catálogo não podem ser copiados para todas as ofertas nem promovidos por título de commit.
- **CA04:** a mesma URL revisada associada a anúncios diferentes no mapa do catálogo é ambígua;
  os candidatos envolvidos são rejeitados e usam seus respectivos fallbacks.
- **CA06:** a URL revisada deve ser absoluta, HTTPS e ter autoridade textual exatamente
  `www.mercadolivre.com.br`. A implementação confere a autoridade na string original para rejeitar
  usuário/senha e qualquer porta explícita, inclusive `:443`, que `URL.port` normaliza.
- **CA06:** o pathname deve corresponder exatamente a `/social/<segmento-nao-vazio>`, com um único
  segmento e sem barra adicional. Segmento vazio, barra final/extra, host parecido, subdomínio
  adicional, outro país/host ou caminho não aprovado é rejeitado.
- **CA07:** a validação é somente local. Nenhum caminho de resolução chama `fetch`, segue redirect,
  resolve DNS, acessa `/go` ou grava `click_event`/`ui_event`; teste comprova zero chamadas de rede.
- **CA08:** `OfferUrlCounters` passa a contar `affiliate_reviewed` e os motivos finitos de fallback.
  Por catálogo e agregado, `ofertas_resolvidas = affiliate_reviewed + fallback`; mistura de
  revisadas, ausentes, strings legadas e objetos rejeitados fecha a equação sem dupla contagem.
- **CA12:** logs e retorno do cron não contêm URL, `review_ref` ou objeto importado. A URL permanece
  somente na curadoria autorizada, no payload/persistência e posteriormente no `Location` público.
- `reviewed_at` deve ser data civil válida no formato `YYYY-MM-DD`. `review_ref` deve ter 1–120
  caracteres no alfabeto `[A-Za-z0-9._:-]`; o conteúdo da referência, inclusive a ausência de
  segredo ou token, é responsabilidade da curadoria, pois o código valida somente formato e tamanho.
- Para cada oferta, a ingestão inclui em `raw.affiliate_link` apenas os campos finitos da resolução
  e os metadados não secretos aplicáveis: `origin`, `validation`, `destination`, `reason`,
  `seller_id`, `reviewed_at` e `review_ref`.
- Entrada inválida nunca aborta o catálogo, altera preço/ranking/disponibilidade ou interfere em
  outra oferta. String legada continua com o comportamento aprovado na ML54-01.
- O teste PostgreSQL existente prova que `reconciliar_catalogo` persiste URL revisada e
  `raw.affiliate_link` atomicamente e que `p_simular=true` desfaz ambos; não é necessária migration
  de schema nesta tarefa.

## Affected code

- `lib/ml/ingest.ts`: tipo cru compatível com string/objeto, carregamento da curadoria, passagem de
  `offer.seller_id`, metadados em `raw` e contadores.
- `lib/ml/offer-url.ts`: validação pura do objeto revisado e seleção sem alterar a URL.
- `lib/ml/catalog-id.test.ts`, `lib/ml/offer-url.test.ts`, `lib/ml/ingest.test.ts`: compatibilidade,
  identidade, segurança local, preservação e contadores.
- `lib/ml/offer-url.property.test.ts`: invariantes de isolamento A/B, preservação da URL e fallback
  para metadados inválidos.
- `app/api/cron/ml-ingest/route.test.ts`: shape público dos novos contadores, sem dados sensíveis.
- `supabase/tests/0007_simulacao.test.sql`: persistência atômica e rollback da simulação com
  `raw.affiliate_link` sintético.
- `data/items.json`: suporta o novo objeto, mas esta tarefa não exige cadastrar URL real.
- `docs/ml/url-afiliada-por-oferta.md`: procedimento de revisão e distinção entre revisão e
  atribuição observada.

Gates: lint, typecheck, Vitest, propriedade, mutação escopada com zero sobreviventes, PostgreSQL
isolado e build. Nenhum teste acessa Mercado Livre ou Supabase de produção.

## Out of scope

- Gerar links, consultar API, expandir redirects ou abrir links históricos.
- Associar automaticamente os links singulares por catálogo a ofertas.
- Backfill e rollback independente de coleta, tratados na ML54-03.
- Fazer deploy, cadastrar links reais ou declarar clique/comissão no painel.
- Interface administrativa ou armazenamento de evidência privada no banco público.

## Open questions

Nenhuma pergunta externa bloqueia a especificação ou implementação. Uma futura necessidade de
aceitar outro host/caminho deve entrar como mudança explícita com evidência e testes; não amplia a
allowlist desta tarefa.
