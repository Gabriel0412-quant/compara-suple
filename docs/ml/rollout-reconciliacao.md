# Rollout da reconciliação

> EP02-07 (#8). Procedimento para a primeira ativação e para reverter.

A reconciliação (#4) é a primeira coisa no projeto que **desativa** dados em
produção. Antes dela, a ingestão só somava. Este documento existe porque a
primeira execução é irreversível na prática se ninguém tiver olhado antes.

## Estado no dia da ativação (31/08/2026)

```
ofertas no banco       1.204
available = true       1.204
available = false          0
coletadas em 31/08       965
paradas desde 24/05      239   ← o que a primeira reconciliação deve derrubar
```

## 1. Aplicar

No SQL Editor do Supabase, em ordem:

| Arquivo | O que faz |
| --- | --- |
| `supabase/migrations/0006_reconciliar_ofertas.sql` | coluna `source_catalog_id`, backfill e a função |
| `supabase/tests/0006_reconciliar_ofertas.test.sql` | espera `reconciliacao: todos os casos ok` |
| `supabase/migrations/0007_reconciliar_simulacao.sql` | adiciona `p_simular` |
| `supabase/tests/0007_simulacao.test.sql` | espera `simulacao: todos os casos ok` |

As migrations OAuth seguem em `0008_secure_ml_oauth_foundation.sql` e `0009_finalize_ml_oauth_security.sql`. A numeração é única e preserva a ordem entre reconciliação e segurança OAuth.

Os dois testes rodam dentro de `begin/rollback` e não deixam resíduo.
O job `Migrações e reconciliação` do CI também cria um PostgreSQL isolado,
aplica todas as migrations em ordem e executa esses dois arquivos em cada PR.

## 2. Simular antes de executar

```bash
curl -s -X POST "https://<host>/api/cron/ml-ingest?simular=1" \
  -H "Authorization: Bearer $CRON_SECRET" | python3 -m json.tool
```

A simulação **executa a reconciliação de verdade e desfaz o efeito** — não é um
caminho de código paralelo. Ela busca no Mercado Livre e escreve no banco como a
execução real; só o savepoint no fim é diferente. Por isso fica atrás da mesma
autorização.

O que ela não desfaz: os upserts de `brand`, `product` e `variant`, que
acontecem antes e são idempotentes. Nenhuma oferta e nenhum histórico é alterado.

Antes de rodar de verdade, confira no retorno:

- `offers_indisponibilizadas` — na primeira execução, esperado próximo de **239**.
  Muito acima disso significa que o snapshot veio incompleto e o catálogo inteiro
  vai cair.
- `offers_criadas` perto de zero — o catálogo é curado e estável.
- `urls.sem_tag_de_afiliado` — se for maior que zero, `ML_AFFILIATE_TAG` não está
  definida e os links sairão sem atribuição de comissão.
- `per_catalog[].status` — qualquer `snapshot_invalid` ou `upstream_error`
  significa que aquele catálogo **não foi tocado**, o que é o comportamento
  correto, mas os preços dele ficam do dia anterior.

## 3. Acompanhar duas coletas

A primeira coleta prova que desativa. A segunda prova que **não desativa demais** —
é ela que pega o erro de um snapshot instável derrubar ofertas boas e recriá-las.

Depois de cada uma:

```sql
select
  count(*)                                as ofertas,
  count(*) filter (where available)       as ativas,
  count(*) filter (where not available)   as inativas,
  max(fetched_at)                         as ultima_coleta
from offer;
```

Sinais de problema:

- `inativas` crescendo muito entre a primeira e a segunda coleta.
- Ofertas alternando entre ativa e inativa em dias seguidos — visível em
  `price_history`, e indica snapshot instável, não catálogo instável:

```sql
select offer_id, count(distinct available) as estados
  from price_history
 where observed_at >= current_date - 7
 group by offer_id
having count(distinct available) > 1;
```

### Evidência da ativação

As duas coletas completas exigidas foram acompanhadas:

| Execução | Catálogos | Snapshot | Resultado |
| --- | ---: | ---: | --- |
| 01/09/2026 | 15/15 | 961 ofertas | HTTP 200, zero catálogo com falha |
| 02/09/2026 | 15/15 | 964 ofertas | 13 criadas, 949 atualizadas, 2 reativadas, 12 indisponibilizadas e zero falha |

Após a segunda coleta, o banco continha 1.222 ofertas: 964 ativas e 258
inativas. `offer.fetched_at` avançou para `2026-09-02T00:50:41Z`. Nenhuma
oferta histórica foi apagada. A home, a listagem, o produto, o comparador e os
links públicos responderam com HTTP 200 sobre esse estado.

## 4. Reverter

A reconciliação não apaga nada: `available` é um estado e o `price_history`
guarda o valor anterior. Reverter é restaurar do histórico do dia anterior.

Para um catálogo:

```sql
update offer o
   set available = anterior.available
  from (
    select distinct on (ph.offer_id) ph.offer_id, ph.available
      from price_history ph
     where ph.observed_at < (now() at time zone 'America/Sao_Paulo')::date
     order by ph.offer_id, ph.observed_at desc
  ) anterior
 where anterior.offer_id = o.id
   and o.store_id = <store_id>
   and o.source_catalog_id = '<catalog_id>';
```

Para parar de reconciliar sem reverter o schema, basta desativar o cron: a
função fica no banco sem efeito, porque nada a chama.

Reverter a migration em si é `drop function public.reconciliar_catalogo(...)`.
**Não derrube `offer.source_catalog_id`** — a ingestão passa a gravá-la e o
backfill não é reconstituível sem `raw`.
