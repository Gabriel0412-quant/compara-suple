import { supabase } from './db'
import { featuredOffer, lowestPriceOffer, type Offer } from './products'

/**
 * Categorias suportadas — slug → metadata + keywords pra matching.
 *
 * Não usamos a tabela `category` do schema ainda (sempre null no DB).
 * Em vez disso, derivamos categoria DO NOME do produto via keyword match.
 *
 * Futuro: adicionar coluna `product.tags jsonb` populada pelo ingest e usar
 * `IS_VEGAN`, `SUPPLEMENT_CLASS` etc. dos atributos do ML pra filtragem precisa.
 */

export type Category = {
  slug: string
  name: string
  shortName: string
  description: string
  emoji: string
  /** lowercase keywords matched against product.name */
  keywords: string[]
}

export const CATEGORIES: Record<string, Category> = {
  'whey-protein': {
    slug: 'whey-protein',
    name: 'Whey Protein',
    shortName: 'Whey',
    description:
      'Proteínas isoladas, concentradas, hidrolisadas e veganas — a categoria-âncora pra ganho de massa e definição.',
    emoji: '🥛',
    keywords: ['whey', 'blend vegan'],
  },
  'creatina': {
    slug: 'creatina',
    name: 'Creatina',
    shortName: 'Creatina',
    description:
      'Creatina monohidratada e variações — força, performance e ganho de volume celular.',
    emoji: '💪',
    keywords: ['creatina'],
  },
  'pre-treino': {
    slug: 'pre-treino',
    name: 'Pré-treino',
    shortName: 'Pré-treino',
    description:
      'Energia, foco e bomba muscular pra treinos intensos — cafeína, beta-alanina, citrulina.',
    emoji: '⚡',
    keywords: ['pre-treino', 'pre treino', 'pre workout', 'preworkout', 'pré treino', 'pré-treino'],
  },
  'beta-alanina': {
    slug: 'beta-alanina',
    name: 'Beta-Alanina',
    shortName: 'Beta-Alanina',
    description:
      'Aminoácido não-essencial que aumenta carnosina muscular — combate fadiga em séries longas.',
    emoji: '🔋',
    keywords: ['beta alanina', 'beta-alanina'],
  },
  'bcaa': {
    slug: 'bcaa',
    name: 'BCAA',
    shortName: 'BCAA',
    description:
      'Aminoácidos essenciais de cadeia ramificada (leucina, isoleucina, valina) — recuperação muscular.',
    emoji: '🦾',
    keywords: ['bcaa'],
  },
  'vitaminas': {
    slug: 'vitaminas',
    name: 'Vitaminas e Multivitamínicos',
    shortName: 'Vitaminas',
    description:
      'Suporte diário de micronutrientes essenciais pro bem-estar geral e saúde.',
    emoji: '💊',
    keywords: ['vitamina', 'multivit', 'centrum', 'animal pak'],
  },
  'vegano': {
    slug: 'vegano',
    name: 'Suplementos Veganos',
    shortName: 'Vegano',
    description:
      'Sem origem animal — proteínas vegetais, multivitamínicos veganos e suplementação plant-based.',
    emoji: '🌱',
    keywords: ['vegan'],
  },
  'hipercalorico': {
    slug: 'hipercalorico',
    name: 'Hipercalórico',
    shortName: 'Hipercalórico',
    description:
      'Calorias densas pra ganho de massa em quem tem dificuldade de comer o suficiente.',
    emoji: '🍫',
    keywords: ['hipercal', 'massa 7000', 'mass gainer'],
  },
  'termogenicos': {
    slug: 'termogenicos',
    name: 'Termogênicos',
    shortName: 'Termogênico',
    description:
      'Suporte à queima de gordura — cafeína, capsaicina, L-carnitina e estimulantes.',
    emoji: '🔥',
    keywords: ['termog', 'thermo', 'lipo'],
  },
  'omega-3': {
    slug: 'omega-3',
    name: 'Ômega 3',
    shortName: 'Ômega 3',
    description:
      'Ácidos graxos essenciais EPA e DHA — saúde cardiovascular, cerebral e anti-inflamatória.',
    emoji: '🐟',
    keywords: ['omega 3', 'omega-3', 'ômega 3'],
  },
}

export function getCategoryBySlug(slug: string): Category | null {
  return CATEGORIES[slug] ?? null
}

export function listCategories(): Category[] {
  return Object.values(CATEGORIES)
}

// ---------- Product fetch para card de categoria ----------

export type CategoryProduct = {
  id: number
  slug: string
  name: string
  brand: string | null
  thumbnail: string | null
  offerCount: number
  /** Oferta que o ML destaca: o preço grande do card e o destino do CTA. */
  featuredPrice: number
  featuredOriginalPrice: number | null
  /**
   * Menor preço entre as ofertas disponíveis. Pode ser MENOR que featuredPrice
   * — em 7 de 13 variantes ele é. Só este número sustenta as palavras
   * "menor preço" e "a partir de".
   */
  lowestPrice: number | null
  lowestOfferId: number | null
  /** Oferta destacada, para o link /go de tracking. */
  featuredOfferId: number | null
  servings: number | null
  sizeGrams: number | null
  featuredPerDose: number | null
}

type RawVariant = {
  id: number
  flavor: string | null
  size_grams: number | null
  servings: number | null
  offers: Offer[] | null
}

type RawProduct = {
  id: number
  slug: string
  name: string
  brand: { name: string } | { name: string }[] | null
  variants: RawVariant[] | null
}

function rowToCard(p: RawProduct): CategoryProduct {
  const allOffers = (p.variants ?? []).flatMap(v => v.offers ?? [])
  // Mesma lógica do PDP: respeitar ordem do ML (ml_rank), fallback oficial → preço.
  // Sem isto, card mostrava o seller mais barato (que ML não destaca), causando
  // dissonância entre preço listado e preço cobrado no clique.
  // Mesma regra de flattenOffers: indisponível não conta em lugar nenhum.
  const ofertasVivas = allOffers.filter(o => o.available)
  const featured = featuredOffer(ofertasVivas)
  const lowest = lowestPriceOffer(ofertasVivas)
  const primaryVariant = p.variants?.[0]
  const servings = primaryVariant?.servings ?? null
  const sizeGrams = primaryVariant?.size_grams ?? null
  const brand = Array.isArray(p.brand) ? p.brand[0] : p.brand

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: brand?.name ?? null,
    thumbnail: featured?.raw?.thumbnail ?? null,
    offerCount: ofertasVivas.length,
    featuredPrice: featured?.price ?? 0,
    featuredOriginalPrice: featured?.raw?.original_price ?? null,
    featuredOfferId: featured?.id ?? null,
    lowestPrice: lowest?.price ?? null,
    lowestOfferId: lowest?.id ?? null,
    servings,
    sizeGrams,
    featuredPerDose: servings && featured ? featured.price / servings : null,
  }
}

/**
 * Query única do catálogo com ofertas aninhadas.
 *
 * As três listagens — categoria, ofertas e o catálogo inteiro — partem das
 * mesmas linhas e só diferem no filtro que aplicam depois. Manter a `select`
 * escrita uma vez é o que garante que um campo novo chegue às três juntas.
 */
async function fetchProductRows(): Promise<RawProduct[]> {
  const { data, error } = await supabase
    .from('product')
    .select(`
      id, slug, name,
      brand:brand_id ( name ),
      variants:variant ( id, flavor, size_grams, servings,
        offers:offer ( id, external_id, url, price, available, fetched_at, ml_rank, raw )
      )
    `)
    .returns<RawProduct[]>()

  if (error || !data) return []
  return data
}

/**
 * Catálogo inteiro como cards, na mesma forma que categoria e ofertas usam.
 * Produto sem nenhuma oferta comprável fica de fora: um card sem preço e sem
 * destino não ajuda a decidir nada.
 */
export async function getAllProductCards(): Promise<CategoryProduct[]> {
  return (await fetchProductRows())
    .map(rowToCard)
    .filter(p => p.offerCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** Um produto pertence à categoria quando o nome contém alguma keyword dela. */
export function produtoCasaCategoria(nome: string, categoria: Category): boolean {
  const nomeLower = nome.toLowerCase()
  return categoria.keywords.some(kw => nomeLower.includes(kw.toLowerCase()))
}

/**
 * A categoria a que um produto pertence, ou null quando nenhuma casa.
 *
 * Existe para a página de produto conseguir montar a trilha
 * início → categoria → produto. Sem ela, o Google chega ao produto sem nada
 * dizendo onde ele fica na hierarquia, e o visitante não tem como subir um
 * nível.
 *
 * Um produto pode casar com mais de uma categoria — "Whey Protein Isolado"
 * casa com whey; um pré-treino com beta-alanina na fórmula casaria com os
 * dois. Devolvemos a primeira da ordem declarada em CATEGORIES, que é a mais
 * específica primeiro, para que a trilha seja estável entre renderizações.
 */
export function categoriaDoProduto(nome: string): Category | null {
  return listCategories().find(c => produtoCasaCategoria(nome, c)) ?? null
}

/**
 * Categorias que hoje têm ao menos um produto comprável, com a contagem.
 *
 * A home montava seus atalhos a partir de uma lista de rótulos, convertendo
 * texto em slug com uma cadeia de `.replace()`. Adivinhar o slug funcionava por
 * acaso em quatro dos cinco casos e mandava "Whey Isolado" para
 * `/categoria/whey-isolado`, que é 404. Derivar da fonte de verdade elimina a
 * classe inteira do erro, e a contagem evita oferecer atalho para categoria
 * vazia.
 */
export async function listCategoriesWithProducts(): Promise<
  Array<Category & { productCount: number }>
> {
  const rows = await fetchProductRows()
  const compraveis = rows
    .map(rowToCard)
    .filter(p => p.offerCount > 0)

  return listCategories()
    .map(categoria => ({
      ...categoria,
      productCount: compraveis.filter(p => produtoCasaCategoria(p.name, categoria)).length,
    }))
    .filter(c => c.productCount > 0)
}

/** Lista produtos cujo nome contém alguma das keywords da categoria. */
export async function getProductsByCategory(
  category: Category,
): Promise<CategoryProduct[]> {
  const data = await fetchProductRows()

  const matching = data.filter(p => produtoCasaCategoria(p.name, category))

  return matching
    .map(rowToCard)
    .filter(p => p.offerCount > 0)
    .sort((a, b) => a.featuredPrice - b.featuredPrice)
}

/** Lista produtos com pelo menos uma oferta em desconto (original_price > price). */
export async function getProductsOnSale(): Promise<CategoryProduct[]> {
  const data = await fetchProductRows()

  return data
    .map(rowToCard)
    .filter(p => {
      if (p.offerCount === 0) return false
      if (!p.featuredOriginalPrice) return false
      return p.featuredOriginalPrice > p.featuredPrice
    })
    .sort((a, b) => {
      const dA = (a.featuredOriginalPrice ?? a.featuredPrice) - a.featuredPrice
      const dB = (b.featuredOriginalPrice ?? b.featuredPrice) - b.featuredPrice
      // sort by absolute discount, descending
      return dB - dA
    })
}
