# ML54-03 — handoff coder

A implementação está completa na base existente, após o endurecimento delimitado do parser e do
runner. Os relatórios iniciais de preflight eram incompletos e não representavam aprovação.

- RPC 0011 aplica/simula o lote atomicamente, confere identidade, trava linhas em ordem estável,
  preserva os dados comerciais e restringe execução a service_role. Tipos inválidos geram erro
  finito. O root completou a prova SQL e a disputa real entre conexões descritas em
  `ml54-03-root-validation.md`.
- O CLI resolve a loja pelo slug, pagina ofertas por loja/catálogo, aceita somente identidades
  válidas e objetos revisados. Rollback reutiliza o fallback existente sem coletar no ML.
  Simulação é padrão nos dois modos; `--apply` é necessário para escrever.
- Parser canônico rejeita argumentos ambíguos, duplicados ou sem alvo. Configuração, leitura,
  escrita e contadores malformados produzem falha sanitizada.
- `/go` preserva Location literal e tolera erro retornado/lançado no tracking. URLs revisadas com
  caracteres crus incompatíveis com a saída literal são recusadas na resolução local.
- S09 foi autorado nas quatro superfícies com destino sintético interceptado. O root executará
  Playwright uma vez sobre o conjunto após o gate.
- CA13 e CA14 têm procedimentos, inventário e checklist rastreável. Resultado operacional permanece
  pendente; nenhum link real foi cadastrado ou acessado.

Verificações: 517 testes, lint, tipos e todas as suítes SQL verdes. Parser isolado: 103 mutantes
mortos, zero sobreviventes/sem cobertura. Runner isolado: 166 mortos e um timeout, zero
sobreviventes/sem cobertura. Relatórios do parser em
`/tmp/compara-suple-ml54-logs/affiliate-links.mutation.log` e do runner em
`/tmp/runner-ml54-mutation/mutation.json`. A mutação conjunta passou: 577 mortos, um timeout, zero sobreviventes e sem cobertura. Está registrada no log
`/tmp/compara-suple-ml54-logs/coder-ml54-03-final-mutation.log` e no JSON de mesmo prefixo, conferidos pelo root.

O escopo inclui integralmente os módulos runtime novos, os resolvedores já endurecidos e todas as
linhas alteradas de ingestão, rota e eventos contra a base da tarefa. Condições legadas não
alteradas de rota/eventos não foram adicionadas ao escopo; não há exclusão de alterações novas.
Os colchetes do caminho da rota são escapados no glob para garantir que ela seja instrumentada.

Próxima etapa: refactorer, seguido do gatekeeper independente. Base de mutação da tarefa:
`8bba7ee28c22214b691a7ffe692993e3aa795b66`. Sem commit nesta etapa.
