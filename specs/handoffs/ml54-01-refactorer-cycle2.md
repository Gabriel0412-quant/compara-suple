# ML54-01 — handoff refactorer, ciclo 2

## Resultado

As correções D1–D6 são testes independentes da implementação e preservam o
contrato. Não houve alteração de produção, migration ou SQL de produção neste
ciclo; as métricas de cobertura e complexidade do estágio 4 anterior continuam
válidas.

## Revisão das correções

- D1: a tabela inclui cada domínio raiz permitido, de modo que a comparação
  exata do host é exercitada, e testa `manualByItemId` com valor vazio como
  ausência. A tabela de URLs rejeitadas continua cobrindo protocolo, domínio e
  `wid` ambíguo separadamente.
- D2: S11 compara as três chamadas completas de `ml_url_fallback` e o aviso
  `ml_url_fallback_ativo`, além de garantir que a URL manual e a tag não saem
  nos logs ou resultado. Não depende de substring para validar o payload.
- D3: S06 verifica a equação por catálogo e no agregado, inicialização em zero
  e uma execução nova composta por catálogo vazio, falha upstream e user
  product vazio, sem contribuição aos contadores.
- D4: S10 compara o retorno JSON completo para GET e POST; os caminhos 401,
  503 e 500 também verificam o content type JSON.
- D5: S11 usa IDs distintos para store, brand, product e variant. Confere a
  RPC pelo payload e a primeira oferta pelo identificador, preço, ranking,
  vendedor e fallback esperado.
- D6: após a execução real, S09 lê a oferta pela chave composta
  `(store_id, external_id)`, compara o estado comercial completo, e forma o
  histórico por essa mesma identidade. A simulação ainda compara o estado
  anterior integralmente antes da execução real.

A propriedade S05 segue útil e não é tautológica: gera IDs com prefixos `MLB`
e `MLBU`, incluindo caracteres Unicode reservados, e verifica rota, encoding,
unicidade de `wid` e ausência de `affiliate` a partir da URL parseada.

## PostgreSQL

O SQL de teste mantém transação `begin/rollback`. A checagem da simulação usa
o snapshot anterior; a checagem real usa `(store_id, external_id)`, confirma
o vínculo de clique com a oferta encontrada e agrega o histórico por essa
chave. Não há query de produção, predicado, partição ou índice novo a revisar.

## Verificações observadas

- `pnpm vitest run lib/ml/offer-url.test.ts lib/ml/ingest.test.ts app/api/cron/ml-ingest/route.test.ts` — 48 testes, verde.
- `pnpm test:property` — 1 propriedade, verde.
- `pnpm test:db` — incluindo S08 e S09, verde.
- `pnpm lint` — verde.
- `git diff --check` — verde.

## Próximo passo

Pronto para `/gate ML54-01` (ciclo 2). O gatekeeper deve rodar a mutação
escopada e decidir os sobreviventes restantes.
