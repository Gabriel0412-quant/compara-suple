# ML54-03 — verificações complementares

O root completou os cenários SQL S01–S05 e os testes HTTP S08 sobre o código do coder.

- S01 exercita payloads inválidos, campos ausentes/nulos/escalares, tipos e overflow de seller,
  duplicidade, catálogo/loja/vendedor divergentes e lote com primeira alteração seguida de falha.
  As chamadas reais com `service_role`, `anon` e `authenticated` verificam as permissões da migration.
- S02–S04 comparam todas as colunas da oferta, exceto os dois destinos de escrita autorizados,
  e o conteúdo integral de histórico/eventos. A simulação usa contadores iguais aos da aplicação;
  reaplicação, rollback repetido e lote misto distinguem itens alterados de iguais.
- S05 abre duas conexões no PostgreSQL isolado, mantém uma alteração de identidade sem commit,
  observa a chamada de aplicação bloqueada, confirma a mudança concorrente e exige rejeição sem
  sobrescrita. Repete o caso para rollback. `dblink` existe apenas na transação do teste; as
  conexões e os registros temporários são limpos também no caminho de erro.
- S08 usa `Response` real, apóstrofo, percent-encoding e fragmento. Confere inserts e mensagens
  exatos para erro retornado, exceção e falha somente de UI, além de ausência de log no sucesso.
- S09 foi autorado em Playwright nas quatro superfícies, com fixture revisada sintética,
  interceptação da navegação externa e contagem de uma leitura, um clique e um evento de saída.
  A execução integrada pertence ao fechamento do pipeline.

Todas as migrations foram aplicadas desde um banco vazio. A versão final da migration 0011 e
todas as suítes SQL passaram tanto nesse banco quanto no banco de desenvolvimento isolado.
As duas novas suítes HTTP/eventos somam 29 testes verdes nesta verificação intermediária.

Logs locais: `/tmp/compara-suple-ml54-logs/fresh-bootstrap-ml54-03.log`,
`fresh-migration-final-03.log`, `fresh-sql-ml54-03.log`, `sql-complete-root-03.log` e
`route-tests-root-03.log`, todos no mesmo diretório. O gate final deve verificar o estado posterior
ao endurecimento do CLI e à refatoração. Não houve operação em produção nem acesso a links reais.
