import { slugDaMarca } from './brands'
import { normalizarTexto } from './busca'
import {
  categoriaDoProduto,
  getCategoryBySlug,
  type CategoryProduct,
} from './categories'
import { SABORES, familiaDoSabor, saborPorValor } from './sabores'

/**
 * O estado de filtro da página de busca, e as regras que operam sobre ele.
 *
 * Mora na URL, e isso não é detalhe de implementação: é o que faz o cartão da
 * Growth na home e o chip de Pré-treino caírem nesta página já filtrados. Um
 * filtro guardado em estado de componente não pode ser linkado, compartilhado,
 * nem indexado — e os três usos existem.
 *
 * Tudo aqui é puro e recebe a lista pronta. Quem lê o banco é
 * `getAllProductCards()`, uma vez, e o resto é função sobre array — que é o
 * que permite testar as regras sem subir Postgres.
 */

export type Ordem = 'relevancia' | 'dose' | 'preco'

export const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'relevancia', rotulo: 'Relevância' },
  /*
    "Menor R$/dose" antes de "menor preço" de propósito.

    A tese do produto é custo por dose, não preço de etiqueta — a embalagem
    mais barata costuma ser a menor. A ordem desta lista é a ordem em que as
    opções aparecem, então ela declara o que o site acha que importa.
  */
  { valor: 'dose', rotulo: 'Menor R$/dose' },
  { valor: 'preco', rotulo: 'Menor preço' },
]

export type Filtros = {
  termo: string
  /** Slug da categoria, ou `null`. */
  categoria: string | null
  /** Slug da marca, ou `null`. */
  marca: string | null
  /** Valor da família de sabor (`lib/sabores.ts`), ou `null`. */
  sabor: string | null
  soPromocao: boolean
  /** Teto de preço da oferta destacada, em reais. */
  precoMax: number | null
  /** Teto de R$/dose. Produto sem dose informada não passa quando ativo. */
  dosePrecoMax: number | null
  ordem: Ordem
}

export const FILTROS_VAZIOS: Filtros = {
  termo: '',
  categoria: null,
  marca: null,
  sabor: null,
  soPromocao: false,
  precoMax: null,
  dosePrecoMax: null,
  ordem: 'relevancia',
}

type Params = Record<string, string | string[] | undefined>

/** Primeiro valor de um parâmetro que o Next pode entregar repetido. */
function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? ''
}

function numeroPositivo(valor: string): number | null {
  // `Number('')` é 0, e um teto de zero esconderia o catálogo inteiro em
  // silêncio. Vazio, negativo, zero e texto caem todos no mesmo `null`.
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Lê os filtros da URL.
 *
 * Valor desconhecido vira ausência, não resultado vazio: `?categoria=inventada`
 * mostra o catálogo inteiro em vez de uma página sem nada. Um link velho ou um
 * slug renomeado não deve produzir uma tela que parece um bug.
 */
export function parseFiltros(params: Params): Filtros {
  const categoria = primeiro(params.categoria)
  const marca = primeiro(params.marca)
  const sabor = primeiro(params.sabor)
  const ordem = primeiro(params.ordem) as Ordem

  return {
    termo: primeiro(params.q),
    categoria: getCategoryBySlug(categoria) ? categoria : null,
    marca: marca === '' ? null : slugDaMarca(marca),
    // Mesma regra da categoria: família desconhecida vira ausência, não
    // resultado vazio.
    sabor: saborPorValor(sabor) ? sabor : null,
    // Só `1` liga. Assim `?promocao=0` e `?promocao=` desligam, em vez de
    // ligarem por serem "presentes".
    soPromocao: primeiro(params.promocao) === '1',
    precoMax: numeroPositivo(primeiro(params.preco_max)),
    dosePrecoMax: numeroPositivo(primeiro(params.dose_max)),
    ordem: ORDENS.some(o => o.valor === ordem) ? ordem : 'relevancia',
  }
}

/**
 * Escreve os filtros de volta na query.
 *
 * Omite o que está no padrão, para a URL não encher de `?promocao=0&ordem=
 * relevancia`. Uma URL curta é a que a pessoa compartilha e a que aparece
 * inteira na barra.
 */
export function serializarFiltros(filtros: Filtros): string {
  const p = new URLSearchParams()
  if (filtros.termo) p.set('q', filtros.termo)
  if (filtros.categoria) p.set('categoria', filtros.categoria)
  if (filtros.marca) p.set('marca', filtros.marca)
  if (filtros.sabor) p.set('sabor', filtros.sabor)
  if (filtros.soPromocao) p.set('promocao', '1')
  if (filtros.precoMax !== null) p.set('preco_max', String(filtros.precoMax))
  if (filtros.dosePrecoMax !== null) p.set('dose_max', String(filtros.dosePrecoMax))
  if (filtros.ordem !== 'relevancia') p.set('ordem', filtros.ordem)
  const query = p.toString()
  return query === '' ? '/produtos' : `/produtos?${query}`
}

/** O produto está em promoção quando o preço anunciado sustenta o desconto. */
export function temPromocao(produto: CategoryProduct): boolean {
  const anterior = produto.featuredOriginalPrice
  /*
    A guarda de `null` fica fora da mutação, e é o único ponto do módulo que
    fica.

    Trocá-la por `true` não muda resultado nenhum: `null > preço` é `false`
    para todo preço positivo, porque `null` vira 0 na comparação. Ela existe
    para o TypeScript e para quem lê, não para o comportamento — e não há
    fixture honesto que a mate, porque exigiria preço negativo.
  */
  // Stryker disable next-line ConditionalExpression
  return anterior !== null && anterior > produto.featuredPrice
}

/** O slug da marca do produto, ou `null` para produto sem marca. */
export function slugDoProduto(produto: CategoryProduct): string | null {
  const nome = produto.brand?.trim()
  return nome ? slugDaMarca(nome) : null
}

/**
 * Cada filtro é uma função à parte, e é isso que faz a contagem de facetas
 * funcionar: para contar quantos produtos uma categoria teria, aplicam-se
 * todos os filtros menos o de categoria.
 */
const REGRAS = {
  termo: (p: CategoryProduct, f: Filtros) =>
    f.termo === '' ||
    [p.name, p.brand].some(
      campo => campo && normalizarTexto(campo).includes(normalizarTexto(f.termo)),
    ),
  categoria: (p: CategoryProduct, f: Filtros) =>
    f.categoria === null || categoriaDoProduto(p.name)?.slug === f.categoria,
  marca: (p: CategoryProduct, f: Filtros) =>
    f.marca === null || slugDoProduto(p) === f.marca,
  /*
    O sabor casa por família, não por string.

    "Milkshake de chocolate" entra no filtro de Chocolate, e "Natural" e
    "Neutro" entram em "Sem sabor". Produto cujo sabor não cai em família
    nenhuma some quando alguém filtra — mesmo tratamento da dose ausente: não
    dá para afirmar que é chocolate quem o catálogo não diz que é.
  */
  sabor: (p: CategoryProduct, f: Filtros) =>
    f.sabor === null || familiaDoSabor(p.flavor)?.valor === f.sabor,
  promocao: (p: CategoryProduct, f: Filtros) => !f.soPromocao || temPromocao(p),
  preco: (p: CategoryProduct, f: Filtros) =>
    f.precoMax === null || p.featuredPrice <= f.precoMax,
  /*
    Dose ausente não passa quando o teto está ligado.

    É a decisão contrária à do preço, e de propósito: quem pede "até R$ 3 por
    dose" está comparando por dose, e um produto sem dose informada não pode
    ser afirmado como dentro do teto. Some, e o texto da tela diz quantos
    sumiram — dado ausente é informação, não motivo para incluir na dúvida.
  */
  dose: (p: CategoryProduct, f: Filtros) =>
    f.dosePrecoMax === null ||
    (p.featuredPerDose !== null && p.featuredPerDose <= f.dosePrecoMax),
} as const

export type Regra = keyof typeof REGRAS

/** Aplica todas as regras, ou todas menos uma — o que a faceta precisa. */
export function aplicarFiltros(
  produtos: CategoryProduct[],
  filtros: Filtros,
  exceto?: Regra,
): CategoryProduct[] {
  const regras = (Object.keys(REGRAS) as Regra[]).filter(r => r !== exceto)
  return produtos.filter(p => regras.every(r => REGRAS[r](p, filtros)))
}

export function ordenar(produtos: CategoryProduct[], ordem: Ordem): CategoryProduct[] {
  const lista = [...produtos]
  if (ordem === 'preco') {
    return lista.sort((a, b) => a.featuredPrice - b.featuredPrice || a.name.localeCompare(b.name, 'pt-BR'))
  }
  if (ordem === 'dose') {
    /*
      Produto sem dose informada vai para o fim, não para o começo.

      `null` comparado com número em JavaScript vira 0, e sem este tratamento
      quem não tem dose apareceria como o mais barato por dose do catálogo —
      exatamente a afirmação que o site recusa fazer.
    */
    return lista.sort((a, b) => {
      const da = a.featuredPerDose, db = b.featuredPerDose
      if (da === null && db === null) return a.name.localeCompare(b.name, 'pt-BR')
      if (da === null) return 1
      if (db === null) return -1
      return da - db || a.name.localeCompare(b.name, 'pt-BR')
    })
  }
  // Relevância é a ordem que o catálogo já traz, de `getAllProductCards()`.
  return lista
}

export type Faceta = { valor: string; rotulo: string; n: number }

/**
 * Quantos produtos cada categoria teria, com os outros filtros valendo.
 *
 * A contagem ignora o próprio filtro de categoria: com "Whey Protein" marcado,
 * "Creatina" precisa mostrar quantos produtos apareceriam ao trocar, não zero.
 * Contar com o próprio filtro aplicado é o erro clássico de faceta, e ele se
 * manifesta como uma lista onde só a opção marcada tem número.
 */
export function facetasDeCategoria(
  produtos: CategoryProduct[],
  filtros: Filtros,
): Faceta[] {
  const base = aplicarFiltros(produtos, filtros, 'categoria')
  const contagem = new Map<string, Faceta>()
  for (const p of base) {
    const categoria = categoriaDoProduto(p.name)
    if (!categoria) continue
    const atual = contagem.get(categoria.slug)
    if (atual) atual.n += 1
    else contagem.set(categoria.slug, { valor: categoria.slug, rotulo: categoria.name, n: 1 })
  }
  return [...contagem.values()].sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}

/**
 * Mesma regra das outras facetas, para sabor.
 *
 * A ordem aqui é a de `SABORES` e não a da contagem: sabor é uma lista curta e
 * estável, e alguém que já sabe onde "Chocolate" fica não deve perdê-lo de
 * lugar porque a coleta mudou o número. Categoria e marca ordenam por
 * contagem porque são listas que crescem.
 */
export function facetasDeSabor(produtos: CategoryProduct[], filtros: Filtros): Faceta[] {
  const base = aplicarFiltros(produtos, filtros, 'sabor')
  const contagem = new Map<string, number>()
  for (const p of base) {
    const familia = familiaDoSabor(p.flavor)
    if (!familia) continue
    contagem.set(familia.valor, (contagem.get(familia.valor) ?? 0) + 1)
  }
  return SABORES.filter(s => contagem.has(s.valor)).map(s => ({
    valor: s.valor,
    rotulo: s.rotulo,
    n: contagem.get(s.valor)!,
  }))
}

/** Mesma regra da categoria, para marca. */
export function facetasDeMarca(produtos: CategoryProduct[], filtros: Filtros): Faceta[] {
  const base = aplicarFiltros(produtos, filtros, 'marca')
  const contagem = new Map<string, Faceta>()
  for (const p of base) {
    const slug = slugDoProduto(p)
    if (!slug) continue
    const atual = contagem.get(slug)
    if (atual) atual.n += 1
    else contagem.set(slug, { valor: slug, rotulo: p.brand!.trim(), n: 1 })
  }
  return [...contagem.values()].sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}

export type ChipDeFiltro = { rotulo: string; href: string }

/**
 * Os filtros ativos, cada um com o link que o remove.
 *
 * O `href` sai de `serializarFiltros` sobre o estado sem aquele filtro, e não
 * de manipulação de string: assim o chip nunca perde os outros filtros junto,
 * que é o que acontece quando alguém monta a URL na mão.
 */
export function chipsDeFiltro(filtros: Filtros, marcas: Faceta[]): ChipDeFiltro[] {
  const sem = (mudanca: Partial<Filtros>) => serializarFiltros({ ...filtros, ...mudanca })
  const chips: ChipDeFiltro[] = []

  if (filtros.termo) chips.push({ rotulo: `"${filtros.termo}"`, href: sem({ termo: '' }) })
  if (filtros.categoria) {
    const categoria = getCategoryBySlug(filtros.categoria)
    chips.push({ rotulo: categoria?.name ?? filtros.categoria, href: sem({ categoria: null }) })
  }
  if (filtros.marca) {
    // O rótulo vem da faceta, que carrega o nome como o banco o escreve —
    // "Integralmédica", não "integralmedica" do slug.
    const marca = marcas.find(m => m.valor === filtros.marca)
    chips.push({ rotulo: marca?.rotulo ?? filtros.marca, href: sem({ marca: null }) })
  }
  if (filtros.sabor) {
    chips.push({ rotulo: saborPorValor(filtros.sabor)?.rotulo ?? filtros.sabor, href: sem({ sabor: null }) })
  }
  if (filtros.soPromocao) chips.push({ rotulo: 'Só em promoção', href: sem({ soPromocao: false }) })
  if (filtros.precoMax !== null) {
    chips.push({ rotulo: `Até R$ ${filtros.precoMax}`, href: sem({ precoMax: null }) })
  }
  if (filtros.dosePrecoMax !== null) {
    chips.push({ rotulo: `Até R$ ${filtros.dosePrecoMax}/dose`, href: sem({ dosePrecoMax: null }) })
  }
  return chips
}

/**
 * `true` quando nenhum filtro está ativo. A ordenação não conta como filtro:
 * ela muda a ordem do mesmo conjunto, não o conjunto.
 */
export function semFiltro(filtros: Filtros): boolean {
  return (
    filtros.termo === '' &&
    filtros.categoria === null &&
    filtros.marca === null &&
    filtros.sabor === null &&
    !filtros.soPromocao &&
    filtros.precoMax === null &&
    filtros.dosePrecoMax === null
  )
}
