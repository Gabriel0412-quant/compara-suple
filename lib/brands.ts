import { getAllProductCards, type CategoryProduct } from './categories'
import { normalizarTexto } from './busca'

/**
 * Read model das marcas acompanhadas.
 *
 * A faixa da home (#152) e o índice `/marcas` (#153) precisam da mesma
 * resposta: quais marcas o catálogo realmente cobre, com quanto de cada uma.
 * Fica num módulo próprio para as duas telas partirem da mesma agregação em
 * vez de cada uma somar do seu jeito.
 *
 * Nada aqui consulta o banco por conta própria: parte de `getAllProductCards()`,
 * que já é a query única do catálogo e já descarta produto sem oferta
 * comprável. Marca só existe se tiver o que vender.
 */

export type Marca = {
  nome: string
  /** Para a URL. Deriva do nome, sem acento. */
  slug: string
  /** Produtos publicáveis — os que têm ao menos uma oferta ativa. */
  produtos: number
  /** Ofertas ativas somadas dos produtos da marca. */
  ofertas: number
  /**
   * Índice na paleta da casa, estável entre renderizações e entre deploys.
   * Quem pinta é a tela; aqui só se decide qual tom cada marca recebe.
   */
  tom: number
}

/**
 * A paleta é nossa, e é por isso que ela é uma lista curta de tokens em vez de
 * uma cor por marca.
 *
 * A maquete 1b pinta cada cartão com a cor oficial da marca — o vermelho da
 * Max Titanium, o azul da Integralmédica. Reproduzir identidade visual de
 * terceiro num cartão que não é o logo insinua uma relação institucional que
 * não existe: não somos revendedores nem parceiros dessas marcas, só listamos
 * preço de anúncios. Então os cartões usam tons da própria casa, e a marca
 * aparece pelo nome.
 *
 * São nomes de token, não valores — o arquivo de cor continua sendo
 * `app/globals.css`, e `lib/tokens.test.ts` continua valendo.
 */
export const TONS_DE_MARCA = [
  'surface-dark',
  'brand-strong',
  'surface-darker',
  'brand-deep',
  'surface-dark-raised',
  'brand-ink',
] as const

export type TomDeMarca = (typeof TONS_DE_MARCA)[number]

/** O tom de uma marca, resolvido para o nome do token. */
export function tomDaMarca(marca: Pick<Marca, 'tom'>): TomDeMarca {
  return TONS_DE_MARCA[marca.tom]
}

export function slugDaMarca(nome: string): string {
  return normalizarTexto(nome)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Hash determinístico (FNV-1a de 32 bits) sobre o nome normalizado.
 *
 * Precisa ser estável entre processos e entre deploys: se o tom mudasse a cada
 * render, a faixa de marcas piscaria cores diferentes a cada visita. Por isso
 * não é índice de array nem `Math.random()` — é função do nome.
 *
 * Normalizado antes para "Integralmédica" e "integralmedica" caírem no mesmo
 * tom, já que são a mesma marca escrita de dois jeitos.
 */
function hashEstavel(nome: string): number {
  let h = 0x811c9dc5
  for (const char of normalizarTexto(nome)) {
    h ^= char.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * Ordena por cobertura, com desempate declarado.
 *
 * 1. Mais ofertas ativas primeiro — é o que a faixa promete mostrar.
 * 2. Empate: mais produtos, porque cobrir cinco produtos com dez ofertas diz
 *    mais sobre a marca do que um produto com dez.
 * 3. Empate ainda: nome em ordem alfabética pt-BR.
 *
 * O terceiro critério existe para a ordem não depender da ordem em que o banco
 * devolveu as linhas. Sem ele, duas marcas idênticas em número trocariam de
 * lugar entre um deploy e outro sem nada ter mudado.
 */
export function ordenarMarcas(marcas: Marca[]): Marca[] {
  return [...marcas].sort(
    (a, b) =>
      b.ofertas - a.ofertas ||
      b.produtos - a.produtos ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

/** Agrega cards de produto em marcas. Exportada para o teste não precisar de banco. */
export function agregarMarcas(cards: CategoryProduct[]): Marca[] {
  const porNome = new Map<string, Marca>()

  for (const card of cards) {
    const nome = card.brand?.trim()
    // Produto sem marca não vira uma marca "Sem marca": some da faixa. O
    // catálogo tem `brand_id` nulo em parte das linhas, e inventar um rótulo
    // para isso seria exibir uma categoria que não existe.
    if (!nome) continue
    // Card só chega aqui se tiver oferta comprável, mas a guarda é barata e
    // deixa a regra explícita em vez de herdada.
    if (card.offerCount <= 0) continue

    const chave = normalizarTexto(nome)
    const atual = porNome.get(chave)
    if (atual) {
      atual.produtos += 1
      atual.ofertas += card.offerCount
      continue
    }
    porNome.set(chave, {
      nome,
      slug: slugDaMarca(nome),
      produtos: 1,
      ofertas: card.offerCount,
      tom: hashEstavel(nome) % TONS_DE_MARCA.length,
    })
  }

  return ordenarMarcas([...porNome.values()])
}

/** Todas as marcas do catálogo, para o índice `/marcas`. */
export async function listarMarcas(): Promise<Marca[]> {
  return agregarMarcas(await getAllProductCards())
}

/**
 * As marcas da faixa da home.
 *
 * O corte é por cobertura, não alfabético — e a tela precisa dizer isso ao
 * leitor, senão o recorte parece arbitrário.
 */
export async function marcasEmDestaque(limite = 5): Promise<Marca[]> {
  return (await listarMarcas()).slice(0, limite)
}
