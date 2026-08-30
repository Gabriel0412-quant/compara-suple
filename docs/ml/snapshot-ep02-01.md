# Mercado Livre — snapshot de ofertas

## Objetivo

Antes de qualquer persistência, a coleta transforma as páginas de ofertas de um catálogo em um snapshot completo e validado. Isso impede que uma resposta parcial seja interpretada como o estado atual do catálogo.

## Contrato

O coletor parte de `offset=0`, solicita páginas de até 100 registros e segue `paging.total`, `paging.offset` e `paging.limit`. Ele aceita no máximo 10.000 registros por catálogo. A resposta só é bem-sucedida quando todas as páginas informadas pelo total chegam completas e coerentes.

Os estados do snapshot são:

- `success`: todas as páginas chegaram e os registros foram avaliados.
- `success_empty`: a API respondeu validamente com `total=0` e nenhuma oferta.
- `upstream_error`: timeout ou erro de transporte/HTTP durante a coleta; não há snapshot parcial para persistir.
- `snapshot_invalid`: a paginação é inconsistente, excede o limite ou contém duplicatas conflitantes; não há snapshot parcial para persistir.

## Validação de oferta

Um `item_id` utilizável é brasileiro, no formato `MLB` seguido de ao menos seis dígitos. Para a oferta ser válida também são exigidos `seller_id` inteiro positivo, preço numérico finito acima de zero, `currency_id=BRL` e `condition=new`.

Quando o identificador é válido, mas algum dado comercial é inválido, o snapshot mantém o identificador, a posição global e o motivo. A reconciliação da subissue seguinte poderá indisponibilizar a oferta correspondente. Identificadores inválidos são apenas rejeitados.

Duplicatas do mesmo `item_id` com os mesmos campos comerciais são consolidadas. Uma diferença em vendedor, preço, moeda ou condição torna o snapshot inteiro inválido.

## Observabilidade

O resultado e o log por catálogo contêm apenas identificador do catálogo, estado, total recebido, páginas buscadas e contadores de rejeição por motivo. Não incluem token, cabeçalho, URL de afiliado nem payload bruto.
