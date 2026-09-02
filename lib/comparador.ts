/**
 * Regras da comparação: quem entra, e o que pode ser chamado de melhor.
 *
 * Ficam fora do componente porque são as duas decisões que erram silenciosamente
 * na tela — um produto repetido parece três produtos, e um destaque sem
 * comparação parece um veredito.
 */

/** Teto de itens comparados lado a lado. */
export const MAX_SLOTS = 3

/**
 * Lê os ids da URL: descarta lixo, remove repetição e corta no teto.
 *
 * A deduplicação é o ponto: `getProductsByIds` devolve um produto por id
 * pedido, para preservar a ordem da URL. Com `?ids=62,62,62` isso rendia três
 * colunas do mesmo produto e um cabeçalho anunciando "Comparação (3)" — o
 * comparador comparando um item consigo mesmo.
 */
export function parseIdsComparados(raw: string | string[] | undefined): number[] {
  const bruto = Array.isArray(raw) ? raw[0] : raw
  const vistos = new Set<number>()
  for (const parte of (bruto ?? '').split(',')) {
    const n = Number.parseInt(parte.trim(), 10)
    if (!Number.isSafeInteger(n) || n <= 0) continue
    vistos.add(n)
    if (vistos.size >= MAX_SLOTS) break
  }
  return [...vistos]
}

/** Monta a URL do comparador preservando seleção e item ativo. */
export function buildCompararUrl(ids: number[], selected?: number | null): string {
  const params = new URLSearchParams()
  if (ids.length > 0) params.set('ids', ids.join(','))
  if (selected && ids.includes(selected)) params.set('selected', String(selected))
  const qs = params.toString()
  return qs ? `/comparar?${qs}` : '/comparar'
}

/** Por que um critério não tem destaque. */
export type MotivoSemDestaque =
  /** Menos de dois itens informam o dado: não houve comparação. */
  | 'sem-comparacao'
  /** Todos empataram: apontar um vencedor seria arbitrário. */
  | 'empate'

export type Destaque = {
  /** Índices vencedores. Vazio quando `motivo` explica a ausência. */
  indices: number[]
  motivo: MotivoSemDestaque | null
}

/**
 * Decide quem se destaca num critério.
 *
 * Duas situações em que a resposta certa é não destacar ninguém:
 *
 * - **Sem comparação.** Se só um item informa o dado, ele "vence" por ser o
 *   único a ter o número. Coroar isso transforma ausência de dado em mérito.
 * - **Empate geral.** Se todos têm o mesmo valor, destacar todos é ruído e
 *   destacar um é arbitrário.
 *
 * Item sem o dado nunca vence nem perde: fica fora da conta, e não é tratado
 * como zero nem como o pior valor.
 */
export function destacarMelhor(
  valores: ReadonlyArray<number | null | undefined>,
  modo: 'min' | 'max' = 'min',
): Destaque {
  const validos = valores
    .map((valor, indice) => ({ valor, indice }))
    .filter((v): v is { valor: number; indice: number } =>
      typeof v.valor === 'number' && Number.isFinite(v.valor))

  if (validos.length < 2) return { indices: [], motivo: 'sem-comparacao' }

  const alvo = modo === 'min'
    ? Math.min(...validos.map(v => v.valor))
    : Math.max(...validos.map(v => v.valor))

  const indices = validos.filter(v => v.valor === alvo).map(v => v.indice)
  if (indices.length === validos.length) return { indices: [], motivo: 'empate' }

  return { indices, motivo: null }
}

/**
 * Separa o que dá para comparar do que não dá.
 *
 * Produto sem nenhuma oferta comprável ocupava um dos três slots e rendia uma
 * coluna inteira de "não informado", com um botão "Escolher" que levava a uma
 * lista de lojas vazia. Era invisível enquanto a reconciliação nunca tinha
 * rodado — sem oferta marcada como indisponível, todo produto tinha o que
 * mostrar. A coleta de 01/09 tirou 250 ofertas do ar e criou a condição.
 *
 * O critério é o mesmo que `/produtos`, `/categoria` e `/ofertas` já aplicam:
 * sem oferta comprável, o produto não entra na listagem.
 */
export function separarComparaveis<T>(
  itens: readonly T[],
  temOfertaComprável: (item: T) => boolean,
): { comparaveis: T[]; descartados: number } {
  const comparaveis = itens.filter(temOfertaComprável)
  return { comparaveis, descartados: itens.length - comparaveis.length }
}
