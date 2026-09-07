# URL afiliada por oferta

> Entregue em EP02-04 (#5).

## O problema

Cada oferta é o anúncio de **um vendedor** dentro de um catálogo do Mercado Livre.
Um catálogo popular tem centenas de vendedores com preços diferentes — o
`MLB6204289` tinha 370.

O `data/items.json` guardava um `affiliate_url` por **catálogo**, e o ingest
aplicava essa mesma URL a todas as ofertas dele. Medido em 31/08/2026:

```
961 de 1.000 ofertas tinham um link que não identificava o anúncio
```

Efeito prático: o comparador anunciava "menor preço R$ 35,91" e o botão levava
para outro vendedor. As 39 ofertas corretas eram justamente as dos 3 catálogos
**sem** URL curada, que já caíam no link construído por oferta.

## Formato legado armazenado

```jsonc
{
  "items": [
    {
      "catalog_id": "MLB19049048",
      "nota": "Whey Protein Concentrado 1kg Growth - Milkshake de Chocolate",
      "affiliate_urls": {
        "MLB5872093596": "https://www.mercadolivre.com.br/p/MLB19049048?affiliate=...&wid=MLB5872093596"
      }
    }
  ]
}
```

O valor `affiliate=...` é apenas um exemplo de entrada legada: nesta etapa ele
não comprova atribuição e não é publicado.

`affiliate_urls` é um mapa **`item_id` → URL**. Nunca uma URL para o catálogo:
o campo antigo `affiliate_url` é ignorado e contado em
`ml_affiliate_url_compartilhada_ignorada`.

Deixar `affiliate_urls` vazio é o caso normal. Nesta etapa, toda **string**
manual é legada e sem proveniência oficial demonstrada; ela não é publicada. O
fallback é construído por oferta para preservar a navegação de compra sem
declarar atribuição. O objeto revisado por anúncio é tratado separadamente.

## Classificação de uma URL legada

`resolveOfferUrl` (`lib/ml/offer-url.ts`) valida a estrutura da URL legada para
classificar o fallback. Uma URL HTTPS do host aceito com `wid` correto é
`fallback_unverified`, pois não há evidência oficial; ela também não é
publicada. Qualquer recusa estrutural cai no fallback:

| Motivo | Quando |
| --- | --- |
| `fallback_absent` | não há URL manual para o `item_id` |
| `fallback_unverified` | URL manual sintaticamente aceitável, sem proveniência oficial |
| `fallback_url_invalida` | não é uma URL absoluta |
| `fallback_protocolo` | não é https |
| `fallback_dominio` | fora de `mercadolivre.com.br`, `mercadolibre.com.br`, `mercadolibre.com` |
| `fallback_wid` | sem `wid`, com `wid` de outra oferta ou `wid` duplicado |

Para strings legadas, o `wid` é o ponto central: sem ele a URL vale para o
catálogo inteiro e não distingue o vendedor. Por isso links sociais legados,
que não têm `wid`, são recusados. Um objeto revisado tem regras próprias de
identidade e pode usar uma URL social sem `wid`.

## Importação revisada por anúncio

Uma entrada revisada usa o mesmo mapa por `item_id`, com objeto completo:

```json
{
  "MLB5872093596": {
    "url": "https://www.mercadolivre.com.br/social/exemplo",
    "seller_id": 123,
    "reviewed_at": "2026-09-05",
    "review_ref": "ML54.02:exemplo"
  }
}
```

Ela só é selecionada quando o `seller_id` coincide com o snapshot da oferta, a
data civil e a referência opaca são válidas e a URL original usa HTTPS com a
autoridade textual `www.mercadolivre.com.br` e o caminho
`/social/<segmento>`, ou a URL curta oficial `https://meli.la/<segmento>`. Porta explícita,
credencial, host ou caminho diferente,
e `wid` duplicado ou divergente são recusados. A ausência de `wid` é aceita
apenas porque o mapa e o vendedor revisado identificam a oferta.

O valor de `url` é persistido sem reconstrução. A revisão é uma checagem local
de formato e identidade; ela não prova clique, conversão ou atribuição no
painel. A mesma URL revisada não pode ser usada por dois anúncios no catálogo.
Os logs e o retorno do cron expõem contadores, nunca a URL ou `review_ref`.

## Verificação operacional pendente (CA14)

Em ambiente autorizado, o responsável deve registrar uma amostra de três produtos de três
vendedores distintos antes de aplicar somente as entradas revisadas. O registro sanitizado contém
produto, vendedor, catálogo e estado da revisão, sem URL ou `review_ref`:

| Produto | Vendedor | Catálogo | Revisão | Resultado no painel |
| --- | --- | --- | --- | --- |
| 1 | distinto | identificado | revisada | pendente |
| 2 | distinto | identificado | revisada | pendente |
| 3 | distinto | identificado | revisada | pendente |

Depois de confirmar os três destinos, é permitido **um único clique** controlado. A página de
métricas informa atualização a cada **3 horas**, conforme a
[evidência da ML54-02](evidencias-afiliacao-ml54-02.md); essa cadência deve ser revalidada no
painel no dia da operação. O relatório registra data, ambiente, catálogo, a janela observada e o
resultado sanitizado. Em 2026-09-06 o resultado continua pendente: testes automatizados não
demonstram atribuição, conversão ou comissão.

## Fallback

`buildMlCatalogLink(catalogId, itemId)` monta:

```
https://www.mercadolivre.com.br/p/{catalogId}?wid={itemId}
https://www.mercadolivre.com.br/up/{catalogId}?wid={itemId}   (user products, MLBU*)
```

## Estado do fallback

`ML_AFFILIATE_TAG` não é usado para construir o fallback. Preencher uma
variável local não demonstra atribuição nem restaura comissão. O cron registra
`ml_url_fallback_ativo` quando o lote contém fallback e expõe em `urls` todos
os contadores finitos: `affiliate_reviewed`, `reviewed_import`, `fallback`,
`fallback_absent`, `fallback_unverified`, `fallback_url_invalida`,
`fallback_protocolo`, `fallback_dominio`, `fallback_wid`,
`fallback_reviewed_metadata`, `fallback_seller` e `fallback_duplicate`.
Em cada catálogo e no agregado, `ofertas_resolvidas = affiliate_reviewed +
fallback`; `reviewed_import` é o motivo de sucesso que acompanha cada entrada
contada em `affiliate_reviewed`.

## Observabilidade

Por catálogo, em `ml_url_fallback`, e no retorno de `/api/cron/ml-ingest` em
`urls`. Só contadores e motivos sanitizados entram em log; nenhuma URL manual
completa entra no retorno ou nos logs.
