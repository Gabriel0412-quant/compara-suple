import { supabase } from './db'
import { compareOffers, type Offer } from './products'

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
  cheapestPrice: number
  cheapestOriginalPrice: number | null
  cheapestUrl: string
  servings: number | null
  sizeGrams: number | null
  cheapestPerDose: number | null
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
  const sortedOffers = [...allOffers].sort(compareOffers)
  const featured = sortedOffers[0]
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
    offerCount: allOffers.length,
    cheapestPrice: featured?.price ?? 0,
    cheapestOriginalPrice: featured?.raw?.original_price ?? null,
    cheapestUrl: featured?.url ?? '#',
    servings,
    sizeGrams,
    cheapestPerDose: servings && featured ? featured.price / servings : null,
  }
}

/** Lista produtos cujo nome contém alguma das keywords da categoria. */
export async function getProductsByCategory(
  category: Category,
): Promise<CategoryProduct[]> {
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

  const matching = data.filter(p => {
    const nameLower = p.name.toLowerCase()
    return category.keywords.some(kw => nameLower.includes(kw.toLowerCase()))
  })

  return matching
    .map(rowToCard)
    .filter(p => p.offerCount > 0)
    .sort((a, b) => a.cheapestPrice - b.cheapestPrice)
}

/** Lista produtos com pelo menos uma oferta em desconto (original_price > price). */
export async function getProductsOnSale(): Promise<CategoryProduct[]> {
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
    .map(rowToCard)
    .filter(p => {
      if (p.offerCount === 0) return false
      if (!p.cheapestOriginalPrice) return false
      return p.cheapestOriginalPrice > p.cheapestPrice
    })
    .sort((a, b) => {
      const dA = (a.cheapestOriginalPrice ?? a.cheapestPrice) - a.cheapestPrice
      const dB = (b.cheapestOriginalPrice ?? b.cheapestPrice) - b.cheapestPrice
      // sort by absolute discount, descending
      return dB - dA
    })
}
