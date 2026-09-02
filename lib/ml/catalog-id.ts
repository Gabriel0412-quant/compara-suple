/**
 * Classificação do identificador de catálogo.
 *
 * O Mercado Livre tem dois tipos, atendidos por endpoints distintos:
 *
 * - **Catalog product** (`MLB` + dígitos) — `/products/{id}` e
 *   `/products/{id}/items`. É o que a ingestão sabe coletar.
 * - **User product** (`MLBU` + dígitos) — `/user-products/{id}` e busca dos
 *   anúncios do vendedor por `user_product_id`.
 *
 * A validação anterior era `/^MLB(U)?[A-Z0-9]+$/i`, que aceita os dois e trata
 * como iguais. Um `MLBU` entrava na lista curada e ia direto para `/products`,
 * onde falhava — e a falha chegava ao relatório como `product_error` genérico,
 * a mesma marca de um catálogo fora do ar ou de uma indisponibilidade do
 * Mercado Livre. Foi o que aconteceu com `MLBU3907661448`: a coleta relatava
 * 15 de 16 sem dizer que o item restante nunca teve chance.
 *
 * A distinção escolhe o fluxo correto sem mandar um MLBU para `/products`.
 */

export type TipoDeCatalogo =
  /** `/products/{id}` — o caminho que a ingestão implementa. */
  | 'catalog_product'
  /** `/user-products/{id}` — coletado pelo fluxo próprio do vendedor. */
  | 'user_product'
  /** Não é identificador de catálogo do Mercado Livre. */
  | 'desconhecido'

const CATALOG_PRODUCT = /^MLB\d+$/i
const USER_PRODUCT = /^MLBU\d+$/i

export function classificarIdCatalogo(id: unknown): TipoDeCatalogo {
  if (typeof id !== 'string') return 'desconhecido'
  const limpo = id.trim()
  // A ordem importa: "MLBU123" também casaria com um padrão MLB permissivo.
  if (USER_PRODUCT.test(limpo)) return 'user_product'
  if (CATALOG_PRODUCT.test(limpo)) return 'catalog_product'
  return 'desconhecido'
}

/** Motivo pelo qual um item curado não chegou a ser coletado. */
export type MotivoNaoColetado = 'id_invalido'

export function motivoDeRecusa(tipo: TipoDeCatalogo): MotivoNaoColetado | null {
  if (tipo === 'desconhecido') return 'id_invalido'
  return null
}
