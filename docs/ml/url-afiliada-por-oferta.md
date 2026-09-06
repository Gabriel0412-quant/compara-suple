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

Deixar `affiliate_urls` vazio é o caso normal. Nesta etapa, toda URL manual é
legada e sem proveniência oficial demonstrada; ela não é publicada. O fallback
é construído por oferta para preservar a navegação de compra sem declarar
atribuição.

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

O `wid` é o ponto central: sem ele a URL vale para o catálogo inteiro e não
distingue o vendedor. É por isso que os links `/social/...` do portal, que não
têm `wid`, são recusados.

## Fallback

`buildMlCatalogLink(catalogId, itemId)` monta:

```
https://www.mercadolivre.com.br/p/{catalogId}?wid={itemId}
https://www.mercadolivre.com.br/up/{catalogId}?wid={itemId}   (user products, MLBU*)
```

## Estado do fallback

`ML_AFFILIATE_TAG` não é usado para construir o fallback. Preencher uma
variável local não demonstra atribuição nem restaura comissão. O cron registra
`ml_url_fallback_ativo` em toda execução e expõe contadores finitos em `urls`:
`fallback`, `fallback_absent`, `fallback_unverified`,
`fallback_url_invalida`, `fallback_protocolo`, `fallback_dominio` e
`fallback_wid`.

## Observabilidade

Por catálogo, em `ml_url_fallback`, e no retorno de `/api/cron/ml-ingest` em
`urls`. Só contadores e motivos sanitizados entram em log; nenhuma URL manual
completa entra no retorno ou nos logs.
