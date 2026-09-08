import {
  compararPorPrecoDestacado,
  getAllProductCards,
  getCategoryBySlug,
  produtoCasaCategoria,
  type Category,
  type CategoryProduct,
} from './categories'

/**
 * Read model das prateleiras da home.
 *
 * A maquete 1b tem um bloco por categoria abaixo da faixa de marcas, com
 * quatro produtos e navegação lateral. Aqui se decide *quais* quatro e em que
 * ordem; a renderização é o #155.
 *
 * Como o read model das marcas (#151), não abre query própria: parte de
 * `getAllProductCards()`, que já é a query única do catálogo e já descarta
 * produto sem oferta comprável.
 */

/**
 * As três categorias da home, na ordem da maquete.
 *
 * Lista fixa e não derivada do catálogo, de propósito: a home escolhe o que
 * destacar, e essa escolha é editorial. Derivar "as três maiores" faria a
 * home mudar de assunto sozinha quando o catálogo crescesse.
 */
export const CATEGORIAS_DA_HOME = ['whey-protein', 'creatina', 'pre-treino'] as const

/** Quantos produtos cada prateleira mostra. Quatro é o que a maquete comporta. */
export const PRODUTOS_POR_PRATELEIRA = 4

export type Prateleira = {
  categoria: Category
  /** Até `PRODUTOS_POR_PRATELEIRA`. Pode ter menos, e pode estar vazia. */
  produtos: CategoryProduct[]
  /** Produtos publicáveis da categoria, não só os exibidos. */
  totalProdutos: number
  /** Ofertas ativas somadas de todos os produtos publicáveis da categoria. */
  totalOfertas: number
}

/**
 * A ordem da prateleira é a da página de categoria, de propósito.
 *
 * `compararPorPrecoDestacado` mora em `lib/categories.ts` e é usado pelas
 * duas: a prateleira é uma prévia daquela página, e ordenar diferente faria
 * "Ver todos" mostrar outros quatro produtos primeiro.
 */
export { compararPorPrecoDestacado }

/**
 * Monta as prateleiras a partir de cards já filtrados.
 *
 * Exportada e pura para o teste não precisar de banco — mesma divisão do
 * `agregarMarcas` no #151.
 */
export function montarPrateleiras(
  cards: CategoryProduct[],
  slugs: readonly string[] = CATEGORIAS_DA_HOME,
  limite = PRODUTOS_POR_PRATELEIRA,
): Prateleira[] {
  const prateleiras: Prateleira[] = []

  for (const slug of slugs) {
    const categoria = getCategoryBySlug(slug)
    /*
      Slug inexistente é erro de programação, não estado do catálogo: alguém
      renomeou uma categoria e esqueceu esta lista. Estourar aqui é melhor que
      a home perder uma prateleira em silêncio.
    */
    if (!categoria) throw new Error(`CATEGORIAS_DA_HOME cita "${slug}", que não existe`)

    const daCategoria = cards.filter(card => produtoCasaCategoria(card.name, categoria))

    prateleiras.push({
      categoria,
      produtos: [...daCategoria].sort(compararPorPrecoDestacado).slice(0, limite),
      totalProdutos: daCategoria.length,
      totalOfertas: daCategoria.reduce((soma, card) => soma + card.offerCount, 0),
    })
  }

  /*
    Categoria sem nenhum produto publicável sai da lista.

    Não é o mesmo que "menos de quatro": com um, dois ou três produtos a
    prateleira existe e mostra o que tem — cabe ao #155 não abrir lacuna no
    grid. Com zero não há prateleira, porque um cabeçalho de categoria com
    nada embaixo é uma seção que promete e não entrega.
  */
  return prateleiras.filter(p => p.produtos.length > 0)
}

/*
  Fora da mutação de propósito.

  É a única linha deste módulo que toca o banco, e o teste unitário não a
  cobre — por isso `montarPrateleiras` é puro e exportado. O Stryker a marca
  como sem cobertura, e cobri-la exigiria mockar `getAllProductCards`, o que
  testaria o mock e não a regra. Quem prova que esta chamada funciona é o e2e
  do #155, contra o app servido.
*/
// Stryker disable all
/**
 * Fundo alternado entre prateleiras.
 *
 * A maquete separa os blocos por categoria trocando o fundo, sem linha
 * divisória. A regra mora aqui, e não inline no JSX da home, por um motivo
 * concreto: escrita lá, ela ficava fora de qualquer teste — o Stryker
 * apontou sete mutantes sem cobertura sobre essa única expressão, incluindo
 * um que devolve `undefined` no lugar de cada prateleira.
 *
 * As classes são literais para o Tailwind conseguir vê-las na varredura.
 */
export function fundoDaPrateleira(indice: number): string {
  return indice % 2 === 0 ? 'bg-surface-muted' : 'bg-surface'
}

export async function prateleirasDaHome(): Promise<Prateleira[]> {
  return montarPrateleiras(await getAllProductCards())
}
// Stryker restore all
