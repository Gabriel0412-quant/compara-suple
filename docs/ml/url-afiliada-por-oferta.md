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

## O formato curado

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

`affiliate_urls` é um mapa **`item_id` → URL**. Nunca uma URL para o catálogo:
o campo antigo `affiliate_url` é ignorado e contado em
`ml_affiliate_url_compartilhada_ignorada`.

Deixar `affiliate_urls` vazio é o caso normal. O link construído já carrega a
tag de afiliado; a URL curada só existe para casos em que o portal de Afiliados
gerou um link específico para um anúncio.

## Como uma URL curada é aceita

`resolveOfferUrl` (`lib/ml/offer-url.ts`) só usa a URL curada se ela **provar**
que aponta para aquela oferta. Qualquer recusa cai no fallback:

| Motivo | Quando |
| --- | --- |
| `manual` | aceita: https, domínio do ML e `wid` igual ao `external_id` |
| `fallback_sem_manual` | não há URL curada para o `item_id` |
| `fallback_url_invalida` | não é uma URL absoluta |
| `fallback_protocolo` | não é https |
| `fallback_dominio` | fora de `mercadolivre.com.br`, `mercadolibre.com.br`, `mercadolibre.com` |
| `fallback_wid` | sem `wid`, ou com o `wid` de outra oferta |

O `wid` é o ponto central: sem ele a URL vale para o catálogo inteiro e não
distingue o vendedor. É por isso que os links `/social/...` do portal, que não
têm `wid`, são recusados.

## Fallback

`buildMlCatalogLink(catalogId, itemId, tag)` monta:

```
https://www.mercadolivre.com.br/p/{catalogId}?affiliate={tag}&wid={itemId}
https://www.mercadolivre.com.br/up/{catalogId}?affiliate={tag}&wid={itemId}   (user products, MLBU*)
```

## `ML_AFFILIATE_TAG` é obrigatória na prática

Sem a env, `buildMlCatalogLink` omite o parâmetro `affiliate`. O link continua
funcionando e o usuário compra — **a comissão é que não acontece**. Em 31/08/2026
os links construídos em produção estavam assim, sem `affiliate=`.

Como é uma falha silenciosa, ela é contada e registrada:

- `ml_affiliate_tag_ausente` — um aviso por execução.
- `urls.sem_tag_de_afiliado` — no retorno do cron, por catálogo e agregado.

Não bloqueia a ingestão: preço desatualizado é pior que clique não atribuído.

## Observabilidade

Por catálogo, em `ml_url_afiliada`, e no retorno de `/api/cron/ml-ingest` em
`urls`. **Só contadores** — a URL afiliada completa carrega o token de rastreio
e nunca entra em log.
