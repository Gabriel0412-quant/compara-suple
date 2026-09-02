/**
 * Classificação do identificador de catálogo.
 *
 * O Mercado Livre tem dois tipos, atendidos por endpoints distintos:
 *
 * - **Catalog product** (`MLB` + dígitos) — `/products/{id}` e
 *   `/products/{id}/items`. É o que a ingestão sabe coletar.
 * - **User product** (`MLBU` + dígitos) — vinculado a um vendedor, atendido por
 *   `/user-products`, com regras próprias de acesso e de descoberta de anúncios.
 *
 * A validação anterior era `/^MLB(U)?[A-Z0-9]+$/i`, que aceita os dois e trata
 * como iguais. Um `MLBU` entrava na lista curada e ia direto para `/products`,
 * onde falhava — e a falha chegava ao relatório como `product_error` genérico,
 * a mesma marca de um catálogo fora do ar ou de uma indisponibilidade do
 * Mercado Livre. Foi o que aconteceu com `MLBU3907661448`: a coleta relatava
 * 15 de 16 sem dizer que o item restante nunca teve chance.
 *
 * Distinguir aqui não faz a coleta de user products funcionar — isso depende do
 * endpoint `/user-products`, ainda não implementado. Faz a recusa ser explícita
 * e nomeada, em vez de silenciosa e confundida com erro de rede.
 */

export type TipoDeCatalogo =
  /** `/products/{id}` — o caminho que a ingestão implementa. */
  | 'catalog_product'
  /** `/user-products` — reconhecido, ainda não coletado. */
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
export type MotivoNaoColetado = 'user_product_nao_suportado' | 'id_invalido'

export function motivoDeRecusa(tipo: TipoDeCatalogo): MotivoNaoColetado | null {
  if (tipo === 'user_product') return 'user_product_nao_suportado'
  if (tipo === 'desconhecido') return 'id_invalido'
  return null
}
