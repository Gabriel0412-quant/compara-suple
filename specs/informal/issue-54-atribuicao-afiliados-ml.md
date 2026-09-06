# Issue #54 — Restaurar atribuição de afiliado nos links do Mercado Livre

> Tipo: Bug · Área: Monetização · Prioridade: P1 — Alta · Horizonte: Agora
> Especificação revisada em 05/09/2026. Implementação ainda pendente.

## Veredito e evidências

**O bug de classificação é real e reproduzível. A perda efetiva de comissão e a configuração atual de produção não foram comprovadas nesta revisão.**

Base remota conferida: `main` em `6b986d73987c4fbf935e1bfc3bcaeccefd44295b`. Reprodução local em `2768e452029fa75c0fdc08b3ec35af72afed1fa4`; os arquivos de resolução, ingestão, redirecionamento e dados citados abaixo são idênticos entre esses commits.

| Entrada no resolvedor atual | Resultado observado | Problema |
| --- | --- | --- |
| Sem URL manual e tag vazia | `tracked=false`; destino conserva `wid` | Compra preservada, sem comprovação de atribuição |
| Tag arbitrária | `tracked=true`; adiciona `affiliate=` | Presença de texto tratada como prova |
| Tag contendo apenas espaço | `tracked=true` | Configuração sem conteúdo útil também é aceita |
| URL manual HTTPS do ML com `wid` correto, sem qualquer afiliação | `reason=manual`, `tracked=true` | Validação de destino confundida com validação de afiliação |

Os 28 testes existentes de `offer-url` e `ingest` passaram. Eles preservam as regras atuais e não demonstram atribuição oficial. A reprodução adicional acima executou o resolvedor real, sem acessar o ML ou gravar no banco.

O `data/items.json` da `main` contém **16 catálogos, todos com `affiliate_urls` vazio**. O relato original de 02/09/2026 registrava 15 catálogos, 965 URLs em simulação, 964 ofertas ativas e ausência de `ML_AFFILIATE_TAG` na Vercel. Esses números permanecem como histórico relatado, não como medição atual reexecutada. Não houve consulta ao banco de produção, às variáveis da Vercel ou ao painel de afiliados nesta revisão.

A documentação oficial consultada orienta gerar links pela Central/Gerador ou Barra de Afiliados. Não foi encontrada, nas fontes consultadas, documentação que legitime sintetizar `?affiliate=<texto>`. Isso **não prova que inexista API oficial**; sua disponibilidade para esta conta precisa ser confirmada. [Geração oficial de links](https://www.mercadolivre.com.br/l/afiliados-gere-seus-links).

## Problema e objetivo

A aplicação pode declarar rastreamento sem evidência e esconder a falta de cobertura nos contadores. O objetivo é publicar links de origem oficial vinculados à conta correta e ao mesmo anúncio da oferta, preservando um destino comprável quando isso não for possível. O fechamento exige evidência no painel oficial, sem prometer comissão por qualquer clique ou compra.

O título “restaurar” expressa o resultado desejado; esta revisão não encontrou comprovação de que a atribuição tenha funcionado anteriormente.

## Vocabulário e invariantes

- **Identidade da oferta:** loja + `external_id` (`item_id` do ML), catálogo e vendedor associados. `wid` é um indício de seleção do anúncio, não prova de afiliação nem garantia isolada do destino final.
- **Link oficial validado:** origem no mecanismo oficial, associação à conta esperada e vínculo com a oferta sustentados por evidência registrada. Formato visual ou domínio isoladamente não bastam.
- **Atribuição observada:** registro de clique nas métricas oficiais, com período, conta/etiqueta e amostra identificados. É uma evidência operacional separada da validação de cada URL.
- **Fallback:** URL de compra para a mesma oferta, cuja atribuição não é comprovada; nunca aparece como link oficial validado.
- **Etiqueta:** agrupamento de links para métricas na Central; não deve ser confundida com credencial nem com o parâmetro local `affiliate`. [Etiquetas e métricas](https://www.mercadolivre.com.br/l/organize-seus-links).

Um clique em `click_event`, um HTTP 302 e um `wid` correto não comprovam atribuição pelo Mercado Livre. Um clique observado também não comprova comissão, nem valida todos os links do catálogo.

## Decisão externa necessária

Antes de implementar a geração/importação oficial, registrar:

1. Um link produzido pelo mecanismo oficial para uma oferta controlada, sua origem, data e referência privada à evidência da conta; publicar apenas estrutura sanitizada.
2. Domínios, formatos e redirecionamentos efetivamente usados, incluindo links curtos se presentes, e como verificar anúncio/vendedor sem editar o link emitido.
3. Existência e acesso a API oficial documentada para a conta. Se indisponível, adotar importação curada por `item_id`, com procedimento repetível; não inferir um template a partir de um único link nem automatizar o portal por scraping.
4. Janela de atualização das métricas informada pelo programa ou suporte e forma permitida de conferir a amostra. Não inventar prazo de atribuição.
5. Elegibilidade do canal e das ofertas segundo o programa. Páginas não permitidas não viram links válidos por possuírem `wid`. [Páginas permitidas e restrições](https://www.mercadolivre.com.br/l/afiliados-gerar-link).

Sem essa evidência, é possível corrigir a falsa classificação e manter fallbacks, mas não declarar a monetização restaurada. Não exigir configurar uma API inexistente nem `ML_AFFILIATE_TAG` arbitrária para encerrar a tarefa.

## Contrato de implementação

### 1. Resolução e confiança

Separar origem do candidato, validação e destino efetivamente escolhido. Contrato mínimo, com nomes de código ajustáveis no PR:

| Campo | Valores/semântica |
| --- | --- |
| Origem | `official_generated`, `official_imported`, `none` |
| Validação | `validated`, `unverified`, `rejected`, `temporarily_unavailable`, `absent` |
| Destino escolhido | `official_affiliate` ou `untracked_fallback` |
| Motivo | Código finito, sem URL ou mensagem externa bruta |
| Evidência | Referência privada, data da validação e versão do mecanismo/formato |

`official_generated` e `official_imported` descrevem a proveniência, não garantem aprovação. URL manual comum, dado legado sem evidência e tag arbitrária permanecem não verificados. Candidato inválido e fallback selecionado são fatos distintos: não usar `invalid_affiliate` como se fosse o destino de compra.

Remover `tracked` ou descontinuá-lo explicitamente. Se mantido por compatibilidade, `true` significa exclusivamente que o destino é um link oficial validado; nunca “clique atribuído” ou “comissão garantida”. Nenhum estado é promovido por variável preenchida, formato parecido ou métrica agregada de outro link.

### 2. Oferta, fallback e integridade do link

- Publicar link oficial somente quando a evidência sustentar o mesmo anúncio/vendedor representado. Link que chega apenas ao catálogo ou ao vendedor vencedor do catálogo usa fallback da oferta; um aviso visual não autoriza trocar o vendedor silenciosamente.
- Preservar integralmente a URL oficial emitida, inclusive parâmetros, codificação e fragmento. Não acrescentar `wid`/`affiliate`, substituir pelo destino expandido ou reconstruir link assinado sem suporte oficial comprovado.
- Manter fallback por `catalogId` + `external_id`, com `/p/` para catálogo MLB e `/up/` para MLBU, sem parâmetros de afiliação inventados.
- Falha de afiliação não altera preço, ranking, disponibilidade ou identidade, nem aborta o processamento dos demais itens. Não afrouxar regras existentes de snapshot e reconciliação.

### 3. Validação controlada

- HTTPS; sem usuário/senha embutidos; porta padrão; hosts expressamente permitidos pelo formato aprovado. Não permitir qualquer subdomínio por conveniência. Rejeitar host parecido, identificador divergente e `wid` duplicado/ambíguo.
- Quando houver resolução HTTP: máximo de 5 redirecionamentos e 10 segundos totais por candidato; validar cada próximo destino antes da requisição. Bloquear endereços locais/privados/reservados, inclusive após DNS, para impedir acesso à rede interna. Credenciais e cookies de administração não acompanham a navegação.
- Loop, destino proibido ou vínculo divergente rejeitam o candidato; timeout, 429, 5xx ou bloqueio de acesso sem evidência conclusiva são falhas temporárias e nunca validações bem-sucedidas. Usar fallback e motivo correspondente nesta execução.
- Não fazer validação externa na requisição pública `/go`. Importação/validação não acessa `/go`, não grava `click_event`/`ui_event` e não publica links.
- Expandir um link pode afetar métricas do provedor. Usar mecanismo de validação sem clique documentado quando disponível; se indisponível, limitar a conferência controlada e registrar essa limitação. Não prometer ausência de cliques no painel ao efetuar requisições HTTP de teste.

### 4. Persistência, saída pública e recuperação

- `offer.url` é persistida na ingestão e usada diretamente por `/go/[offerId]`; alterar uma variável ou fazer deploy não corrige URLs existentes.
- A coleta/backfill deve atualizar ofertas existentes preservando `offer.id`, `external_id` e relacionamentos com eventos/histórico. Repetir o mesmo lote não cria ofertas, links ou registros de evidência duplicados.
- Guardar origem/validação/evidência em armazenamento durável associado à oferta. O PR define schema, migração compatível e fonte única para futuros consumidores. Classificar registros legados como não verificados até validação real; não confiar retrospectivamente em `affiliate=`.
- `/go` entrega HTTP 302 com o destino selecionado, preservado, e mantém o tracking interno. Falha no registro de eventos não impede a saída. Rejeição de um novo candidato não remove uma URL de compra funcional.
- Rollback inclui restaurar destinos fallback **no banco** para as ofertas afetadas, além do código/configuração. Deve funcionar mesmo se a API do ML estiver indisponível, com identidade previamente persistida. Não depender somente de nova coleta ou de remoção da variável.

### 5. Contadores, segurança e documentação

Por catálogo e execução, informar ofertas resolvidas, destinos oficiais validados, fallbacks e motivos; separar tentativas rejeitadas de falhas temporárias. Para cada catálogo: `resolvidas = oficiais_validados + fallbacks`. Agregado é a soma dos catálogos; candidatos inválidos não entram novamente nesse total. Informar catálogos não processados separadamente.

Não chamar esse contador de “URLs com atribuição verificada”. A evidência do painel é registrada separadamente. Descontinuar `sem_tag_de_afiliado` ou documentá-lo como legado; seu valor zero não serve como sucesso. Fallbacks geram aviso operacional agregado, com identificadores de oferta e motivos, sem URLs completas.

Logs, erros serializados, respostas de diagnóstico/cron, artefatos públicos e evidências da issue não expõem URLs completas de afiliação, tokens ou credenciais reais. Testes usam valores sintéticos. A URL pública de divulgação precisa chegar ao navegador pelo `Location`; essa exposição funcional não viola o requisito. Segredos de autenticação nunca entram nela.

Atualizar `.env.example`, `docs/ml/url-afiliada-por-oferta.md` e `docs/ml/rollout-reconciliacao.md`, removendo a alegação de que preencher `ML_AFFILIATE_TAG` basta. Só cadastrar configurações exigidas pelo mecanismo validado; Preview/CI usam fixtures ou conta de teste autorizada, sem cliques automáticos na conta de produção.

## Critérios de aceite e testes obrigatórios

| ID | Nível | Cenário e resultado verificável |
| --- | --- | --- |
| CA01 | Unidade | Tag ausente, arbitrária ou só espaços: fallback; nenhuma falsa validação; `wid` da oferta preservado |
| CA02 | Unidade | URL manual HTTPS com `wid` correto, sem evidência oficial: não verificada; não reduz contador de fallbacks |
| CA03 | Unidade | Link oficial gerado/importado com evidência válida: selecionado sem alteração; vínculo com anúncio demonstrado |
| CA04 | Unidade/integração | A e B no mesmo catálogo: link de A nunca publicado para B; catálogo sem vínculo exato e `wid` duplicado são recusados |
| CA05 | Unidade | Catálogo MLB e user product MLBU: fallback usa respectivamente `/p/` e `/up/`, com `external_id` correto |
| CA06 | Segurança/integração | HTTP, domínio hostil/parecido, credencial embutida, IP privado, redirect externo, loop e sexto redirect: rejeição sem acesso ao destino proibido, sem vazamento e com fallback |
| CA07 | Integração | Timeout total de 10 s, 429, 5xx ou bloqueio inconclusivo: falha temporária, sem declarar validação e sem abortar catálogo |
| CA08 | Integração | Mistura de oficiais, ausentes, não verificados, rejeitados e temporários: contadores fecham por catálogo e no agregado; falhas de catálogo ficam explícitas |
| CA09 | Banco | Simulação não altera `offer`, `price_history` nem estado publicado de links; documenta efeitos auxiliares existentes em brand/product/variant e auditoria |
| CA10 | Banco | Atualização e repetição de lote em ofertas existentes preservam IDs e vínculos; rollback restaura URL fallback persistida sem consultar ML |
| CA11 | Rota/E2E | Home, listagem, produto e comparador levam a `/go`; resposta 302 preserva URL escolhida; falha na gravação do clique não bloqueia saída; prévia/validação não cria eventos |
| CA12 | Segurança | Logs, cron e erros não contêm token/URL real; `Location` contém apenas o link de divulgação, nunca segredo administrativo |
| CA13 | Operação | Inventário atual de ofertas ativas, elegibilidade e exceções identificadas por motivo; todas as elegíveis têm link validado, ou há decisão explícita de cobertura parcial — nesse caso a restauração integral permanece pendente |
| CA14 | Operação | Amostra de pelo menos 3 produtos e 3 vendedores distintos conserva identidade; ao menos um clique permitido aparece nas métricas oficiais no período/etiqueta registrados, respeitando a janela informada pelo programa |

Testes automáticos usam transporte simulado e fixtures sanitizadas, sem abrir links reais de afiliado. Conferência no painel é aceite operacional, não teste de CI. Não fazer compra artificial; cliques, conversões e comissões são métricas distintas.

## Sequência de entrega e Definition of Done

1. Registrar decisão externa e fixtures sanitizadas. Se faltar acesso à conta, manter esse bloqueio explícito, sem travar a correção independente de falsa classificação.
2. Implementar contrato, migração quando necessária e testes; atualizar documentação.
3. Obter inventário novo com timestamp/commit. Usar os catálogos atuais, sem fixar 15, 16, 964 ou 965 como meta permanente. Explicar diferenças entre simulação e banco.
4. Executar simulação, conferir contadores e nenhuma mutação das ofertas/histórico/links publicados.
5. Publicar código/configuração e atualizar URLs existentes. Conferir cobertura do estoque ativo, incluindo ofertas de catálogos que falharam na coleta; não contar apenas os sucessos do job.
6. Demonstrar rollback dos dados, sem perder preço, disponibilidade ou vínculos. Conferir a amostra e anexar evidência sanitizada do painel, data, janela observada e limitações.

- [ ] CA01–CA14 atendidos, exceções operacionais explícitas e bloqueios externos resolvidos para o fechamento integral.
- [ ] `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, job `database` e E2E aplicáveis verdes.
- [ ] Código/testes/documentação mergeados e migrações/configuração aplicadas nos ambientes apropriados.
- [ ] Relatório de cobertura antes/depois e rollback registrados sem dados sensíveis.
- [ ] Atribuição observada no painel oficial; não encerrar só porque os testes passam ou o contador legado zerou.

## Limites e relação com outras issues

Este ticket entrega a resolução confiável, importação mínima reproduzível se necessária, persistência, correção dos registros existentes e comprovação operacional. A interface de administração pertence à #149 (EP16-04A); a monitoração periódica e fila de pendências pertencem à #150 (EP16-04B). Ambas consomem este contrato; não criar dependência circular exigindo o backoffice para corrigir #54. Importação/reconciliação de conversões e comissões pertence ao EP19 (#80, #102, #103).

Preservar as garantias de identidade, disponibilidade e reconciliação do EP02. Não incluir escolha de outro vendedor nem redesenho da oferta neste bug.

## Referências de código

Permalinks na base remota verificada:

- [lib/affiliate.ts:24](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/lib/affiliate.ts#L24) — constrói `affiliate` a partir de qualquer texto; helper legado em L42 tem a mesma premissa.
- [lib/ml/offer-url.ts:62](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/lib/ml/offer-url.ts#L62) — só protocolo, domínio e `wid`; L91 e L98 produzem falsa confiança.
- [lib/ml/offer-url.test.ts:26](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/lib/ml/offer-url.test.ts#L26) — testes aceitam a premissa atual.
- [lib/ml/ingest.ts:402](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/lib/ml/ingest.ts#L402) — resolvedor, contador e URL persistida; L506 alerta pela variável; L545 agrega contadores.
- [app/go/[offerId]/route.ts:64](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/app/go/%5BofferId%5D/route.ts#L64) — lê URL persistida; L102 redireciona com 302.
- [supabase/migrations/0007_reconciliar_simulacao.sql:77](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/supabase/migrations/0007_reconciliar_simulacao.sql#L77) — atualização de URL em oferta existente.
- [data/items.json:1](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/data/items.json#L1) — 16 mapas vazios na revisão.
- [.env.example:14](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/.env.example#L14) e [documentação atual:42](https://github.com/Gabriel0412-quant/compara-suple/blob/6b986d73987c4fbf935e1bfc3bcaeccefd44295b/docs/ml/url-afiliada-por-oferta.md#L42) — configuração e garantia de afiliação a corrigir.
