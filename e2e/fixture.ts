/**
 * Catálogo determinístico para os testes de ponta a ponta.
 *
 * Cada produto existe para exercitar um caso: preço com desconto, produto sem
 * oferta comprável, empate de preço, ausência de imagem. Mexer nos números aqui
 * quebra asserções de propósito — os testes afirmam contagens exatas, que é o
 * que os torna capazes de pegar regressão.
 */

type Oferta = {
  id: number
  external_id: string
  url: string
  price: number
  available: boolean
  fetched_at: string
  ml_rank: number | null
  raw: Record<string, unknown> | null
}

const AGORA = new Date().toISOString()

export function reviewedAffiliateUrl(id: number): string {
  return `https://www.mercadolivre.com.br/social/ml54-fixture?wid=MLB${id}&ref=synthetic%2F${id}#reviewed`
}

function oferta(
  id: number,
  price: number,
  available = true,
  extra: Partial<Oferta> = {},
): Oferta {
  return {
    id,
    external_id: `MLB${id}`,
    url: reviewedAffiliateUrl(id),
    price,
    available,
    fetched_at: AGORA,
    ml_rank: 1,
    ...extra,
    raw: extra.raw === null ? null : {
      thumbnail: `https://exemplo.test/${id}.jpg`,
      ...extra.raw,
      seller_id: id + 9000,
      affiliate_link: {
        destination: 'affiliate_link',
        origin: 'reviewed_import',
        validation: 'reviewed',
        reason: 'reviewed_import',
        seller_id: id + 9000,
        reviewed_at: '2026-09-06',
        review_ref: `synthetic-${id}`,
      },
    },
  }
}

type Variante = {
  id: number
  flavor: string | null
  size_grams: number | null
  servings: number | null
  offer: Oferta[]
  offers: Oferta[]
}

function variante(
  id: number,
  ofertas: Oferta[],
  { flavor = null as string | null, size_grams = 1000 as number | null, servings = 30 as number | null } = {},
): Variante {
  return { id, flavor, size_grams, servings, offer: ofertas, offers: ofertas }
}

/**
 * O stub devolve as chaves nos dois nomes — `variant`/`variants` e
 * `offer`/`offers` — porque cada consulta do app usa um alias diferente no
 * `select`, e o cliente só lê a chave que pediu. Duplicar é mais simples e mais
 * robusto do que interpretar o alias.
 */
export const PRODUTOS = [
  {
    id: 1,
    slug: 'whey-concentrado-growth',
    name: 'Whey Protein Concentrado 1kg Growth Supplements',
    created_at: '2026-01-01T00:00:00+00:00',
    brand: { name: 'Growth Supplements', slug: 'growth' },
    variant: [variante(11, [
      oferta(101, 89.9, true, { ml_rank: 1, raw: { thumbnail: 'https://exemplo.test/101.jpg', original_price: 119.9 } }),
      oferta(102, 84.5, true, { ml_rank: 2 }),
      oferta(103, 79.9, false),
    ], { flavor: 'Baunilha' })],
  },
  {
    id: 2,
    slug: 'creatina-integralmedica',
    name: 'Creatina Monohidratada 300g Integralmédica',
    created_at: '2026-01-02T00:00:00+00:00',
    brand: { name: 'Integralmédica', slug: 'integralmedica' },
    variant: [variante(21, [oferta(201, 129.9)], { size_grams: 300, servings: 100 })],
  },
  {
    id: 3,
    slug: 'whey-isolado-max',
    name: 'Whey Protein Isolado 900g Max Titanium',
    created_at: '2026-01-03T00:00:00+00:00',
    brand: { name: 'Max Titanium', slug: 'max-titanium' },
    variant: [variante(31, [oferta(301, 149.9)], { size_grams: 900, servings: 30, flavor: 'Chocolate' })],
  },
  {
    // Sem nenhuma oferta disponível: não pode aparecer em listagem nem ocupar
    // slot no comparador.
    id: 4,
    slug: 'blend-vegan-fora-do-ar',
    name: 'Blend Vegan Proteína Vegana 1kg Growth Supplements',
    created_at: '2026-01-04T00:00:00+00:00',
    brand: { name: 'Growth Supplements', slug: 'growth' },
    variant: [variante(41, [oferta(401, 99.9, false), oferta(402, 95, false)])],
  },
  {
    // Sem imagem e sem doses: exercita o fallback e o "não informado".
    id: 5,
    slug: 'pre-treino-sem-dados',
    name: 'Pré-treino Insanity 300g Black Skull',
    created_at: '2026-01-05T00:00:00+00:00',
    brand: { name: 'Black Skull', slug: 'black-skull' },
    variant: [variante(51, [oferta(501, 110, true, { raw: null })], { size_grams: null, servings: null })],
  },
  {
    /*
      Terceiro whey comprável, para a categoria ter trio.

      O bloco comparador da home (#157) só existe com três produtos elegíveis
      na mesma categoria, e até aqui a fixture tinha dois. Sem este, o bloco
      não renderizava e o e2e não conseguia distinguir "não há trio" de "o
      bloco quebrou" — os dois davam ausência.

      Peso e preço escolhidos para os três R$/kg saírem distintos, e assim
      haver um vencedor legítimo: 89,90/kg (id 1), 166,56/kg (id 3) e
      222,11/kg (este). Empate e vencedor solitário são exercitados no
      unitário, onde o catálogo é montado por caso.
    */
    id: 6,
    slug: 'whey-concentrado-dux',
    name: 'Whey Protein Concentrado 900g Dux Nutrition',
    created_at: '2026-01-06T00:00:00+00:00',
    brand: { name: 'Dux Nutrition', slug: 'dux-nutrition' },
    /*
      Segundo desconto da fixture, e o motivo dele é a ordem da prateleira.

      Até o #226 só o produto 1 tinha `original_price`, então "Maiores
      descontos" exibia um card só — e uma fileira de um elemento está
      ordenada por qualquer critério. O teste passava sem testar.

      Os números são escolhidos para os dois critérios DISCORDAREM:

        produto 1   89,90 de 119,90   R$ 30,00   -25%
        produto 6  199,90 de 249,90   R$ 50,00   -20%

      Por reais: 6 antes de 1. Por percentual: 1 antes de 6. Se a ordenação
      trocar de coluna, a fileira inverte e o teste acusa.
    */
    variant: [variante(61, [
      oferta(601, 199.9, true, { raw: { thumbnail: 'https://exemplo.test/601.jpg', original_price: 249.9 } }),
    ], { size_grams: 900, servings: 30 })],
  },
  {
    /*
      Produto sem marca.

      O catálogo real tem `brand_id` nulo em parte das linhas, e o card
      renderiza o rótulo de marca condicionalmente — mas nenhum produto desta
      fixture exercitava o ramo. Isso escondeu uma trava: com todos os cards
      tendo marca, as alturas naturais coincidiam, e remover o `h-full` do
      card (que é o que garante altura igual dentro do slot esticado) passava
      pelos testes. Descoberto na verificação de mutação do #198.

      Sem marca o card é uma linha mais curto, o que torna o `h-full`
      necessário de fato — e a trava, capaz de pegar a regressão.
    */
    id: 7,
    slug: 'whey-sem-marca',
    name: 'Whey Protein Concentrado 1kg sem marca cadastrada',
    created_at: '2026-01-07T00:00:00+00:00',
    brand: null,
    variant: [variante(71, [oferta(701, 175.5)], { size_grams: 1000, servings: 30 })],
  },
] as const

/** Toda oferta do catálogo, achatada — o que a tabela `offer` devolveria. */
export const OFERTAS = PRODUTOS.flatMap(p => p.variant.flatMap(v => v.offer))

export const TOTAIS = {
  produtos: PRODUTOS.length,
  ofertas: OFERTAS.length,
  ofertasDisponiveis: OFERTAS.filter(o => o.available).length,
  /** Produtos com ao menos uma oferta comprável — o que as listagens mostram. */
  produtosCompraveis: PRODUTOS.filter(p =>
    p.variant.some(v => v.offer.some(o => o.available)),
  ).length,
  ultimaColeta: AGORA,
}
