# Liveness, readiness e preços defasados

O endpoint `GET /api/health` é a probe de liveness. Ele confirma apenas que a aplicação Next.js responde e não consulta banco, catálogo ou provedores externos.

O endpoint público `GET /api/readiness` consulta a oferta disponível mais antiga. Usar a mais antiga, em vez da mais recente, impede que a atualização isolada de uma oferta esconda um catálogo parcialmente desatualizado.

Os estados retornados não incluem SQL, segredos, hosts ou identificadores internos:

| Estado | Condição | HTTP |
| --- | --- | --- |
| `healthy` | Há ofertas disponíveis e a mais antiga foi atualizada há no máximo 30 horas. | 200 |
| `degraded` | Não há ofertas disponíveis ou o catálogo está entre 30 e 72 horas sem atualização completa. | 200 |
| `unavailable` | O banco falha, excede o timeout, a data é inválida ou o catálogo excede 72 horas. | 503 |

`READINESS_DEGRADED_AFTER_HOURS`, `READINESS_UNAVAILABLE_AFTER_HOURS` e `READINESS_TIMEOUT_MS` podem ser ajustados por ambiente. O valor indisponível precisa sempre ser maior que o valor degradado; valores inválidos usam os defaults seguros.

As páginas públicas usam o mesmo limite de degradação para avisar que o preço pode estar desatualizado, mas permanecem navegáveis. A readiness não aciona ingestão, retries ou replay: essas responsabilidades permanecem no EP03.
