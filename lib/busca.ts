/**
 * Busca textual do catálogo.
 *
 * O filtro roda em memória, sobre a lista já carregada, e não no Postgres.
 * Dois motivos: o catálogo é curado e pequeno (dezenas de produtos), e o
 * `ilike` do Postgres não ignora acento sem a extensão `unaccent` — o que
 * faria "proteina" não encontrar "Proteína". Normalizar aqui resolve isso sem
 * depender de extensão no banco.
 *
 * Quando o EP11 trouxer o motor de descoberta com ranking e autocomplete, é
 * esta camada que ele substitui. Até lá, o contrato é o mínimo honesto: o que
 * o visitante digita filtra o que ele vê.
 */

/** Acima disso o termo é ruído — protege a URL e o custo do filtro. */
const MAX_TERMO = 100

/**
 * Remove acento, baixa a caixa e colapsa espaços, para que a comparação não
 * dependa de como o visitante digitou.
 *
 *   normalizarTexto('  Proteína   ISO ') === 'proteina iso'
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Lê o termo do `searchParams`. O Next entrega `string | string[] | undefined`
 * — repetir `?q=a&q=b` na URL vira array —, então normalizamos para uma string
 * só e cortamos no limite. Devolve o texto como o visitante digitou, porque é
 * ele que volta para o campo; a normalização acontece só na comparação.
 */
export function parseTermoBusca(valor: string | string[] | undefined): string {
  const bruto = Array.isArray(valor) ? valor[0] : valor
  if (typeof bruto !== 'string') return ''
  return bruto.trim().slice(0, MAX_TERMO)
}

/**
 * Casa quando *todas* as palavras do termo aparecem em algum dos campos.
 *
 * Exigir todas (e não qualquer uma) é o que faz "whey growth" achar o whey da
 * Growth em vez de devolver todo whey e toda Growth do catálogo.
 */
export function casaComTermo(
  campos: ReadonlyArray<string | null | undefined>,
  termo: string,
): boolean {
  const alvo = normalizarTexto(campos.filter(Boolean).join(' '))
  const palavras = normalizarTexto(termo).split(' ').filter(Boolean)
  if (palavras.length === 0) return true
  return palavras.every(palavra => alvo.includes(palavra))
}

/**
 * Filtra a lista pelo termo. Termo vazio devolve a lista intacta — a página de
 * catálogo sem `?q=` continua sendo o catálogo inteiro.
 */
export function filtrarPorTermo<T>(
  itens: readonly T[],
  termo: string,
  camposDe: (item: T) => ReadonlyArray<string | null | undefined>,
): T[] {
  if (normalizarTexto(termo) === '') return [...itens]
  return itens.filter(item => casaComTermo(camposDe(item), termo))
}
