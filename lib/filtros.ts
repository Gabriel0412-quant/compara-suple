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

/** Onde a busca livre mora. */
export const ROTA_DA_BUSCA = '/produtos'

/** Prefixo da versão indexável da mesma tela, com uma categoria fixa. */
export const ROTA_DA_CATEGORIA = '/categoria/'

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
  /*
    Categoria, marca e sabor são listas, não valores.

    A primeira versão aceitava um de cada, e isso não é um filtro: é uma
    escolha. Quem compara whey quase sempre quer duas ou três marcas lado a
    lado — "Growth ou Max Titanium", não "Growth, e se não, recomeço". Lista
    vazia quer dizer "todas", que é o mesmo que não filtrar.
  */
  /** Slugs de categoria. Vazio quer dizer todas. */
  categorias: string[]
  /** Slugs de marca. Vazio quer dizer todas. */
  marcas: string[]
  /** Valores de família de sabor (`lib/sabores.ts`). Vazio quer dizer todos. */
  sabores: string[]
  soPromocao: boolean
  /** Teto de preço da oferta destacada, em reais. */
  precoMax: number | null
  /** Teto de R$/dose. Produto sem dose informada não passa quando ativo. */
  dosePrecoMax: number | null
  ordem: Ordem
}

export const FILTROS_VAZIOS: Filtros = {
  termo: '',
  categorias: [],
  marcas: [],
  sabores: [],
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

/** Separador da lista na URL. */
const SEPARADOR = ','

/**
 * Todos os valores de um filtro de lista, limpos e sem repetição.
 *
 * A lista vai numa chave só, separada por vírgula: `?marca=growth,max`.
 *
 * A forma canônica seria repetir a chave — `?marca=growth&marca=max` — e foi
 * assim na primeira versão. Ela quebra: com a chave repetida, o roteador do
 * Next troca a URL e **não** re-renderiza a página. Medido — o chip continuava
 * na tela dez segundos depois do clique, e só a recarga corrigia. A requisição
 * RSC saía e a resposta não era aplicada.
 *
 * A vírgula é segura como separador porque todo valor daqui é slug: `slugDaMarca`
 * só deixa passar `a-z`, `0-9` e hífen, e os slugs de categoria e de família de
 * sabor são escritos à mão no código. Nenhum deles pode conter vírgula.
 *
 * Aceita a forma repetida na leitura de propósito: link velho continua
 * funcionando, e é barato.
 *
 * Só apara e tira repetição. Não descarta o vazio porque não precisa: quem
 * chama já valida — categoria contra a lista fechada, sabor contra as
 * famílias, marca contra o resultado do slug. Um `filter` aqui seria linha
 * morta, e a mutação a apontaria como tal.
 *
 * O `trim` é que faz trabalho: sem ele, `growth, growth` viraria duas entradas
 * — `growth` e ` growth` —, o `Set` não as juntaria, e a tela mostraria dois
 * chips idênticos onde remover um deixa o outro.
 */
function todos(valor: string | string[] | undefined): string[] {
  const lista = Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]
  const partes = lista.flatMap(v => v.split(SEPARADOR))
  return [...new Set(partes.map(v => v.trim()))]
}

/**
 * Liga ou desliga um valor numa lista de filtro.
 *
 * É o que o clique numa faceta faz: marcada, desmarca; desmarcada, acrescenta.
 * A ordem de quem fica é preservada, para a URL não embaralhar a cada clique.
 */
export function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor]
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
  const ordem = primeiro(params.ordem) as Ordem

  return {
    termo: primeiro(params.q),
    categorias: todos(params.categoria).filter(c => getCategoryBySlug(c)),
    /*
      A marca não é validada, e a categoria é. A assimetria é deliberada.

      Categoria é lista fechada e estática: um slug fora dela é link velho ou
      erro de digitação, e ignorá-lo devolve o catálogo em vez de uma tela
      vazia que parece bug.

      Marca vem do catálogo e muda a cada coleta. Não há lista para validar
      contra — e, mais importante, "marca sem nenhum produto" é uma resposta
      verdadeira: a marca existia e saiu do ar, ou combina com outro filtro que
      a zera. Ignorar o filtro nesse caso mostraria o catálogo inteiro para
      quem pediu uma marca, o que é pior que mostrar zero com o chip na tela
      dizendo o que foi pedido.
    */
    marcas: todos(params.marca).map(slugDaMarca).filter(m => m !== ''),
    // Mesma regra da categoria: família desconhecida vira ausência, não
    // resultado vazio.
    sabores: todos(params.sabor).filter(s => saborPorValor(s)),
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
export function serializarFiltros(filtros: Filtros, base = ROTA_DA_BUSCA): string {
  const p = new URLSearchParams()
  if (filtros.termo) p.set('q', filtros.termo)
  /*
    Em `/categoria/<slug>` a categoria está no caminho, não na query.

    Repeti-la daria `/categoria/whey-protein?categoria=whey-protein`, que é a
    mesma página com duas URLs — e duas URLs para a mesma coisa é exatamente o
    que aquela rota existe para evitar, já que ela é a versão indexável desta
    tela.
  */
  /*
    Na rota de categoria, a categoria única está no caminho.

    Só a única: com duas marcadas, o caminho não consegue representar as duas,
    e a página deixa de ser aquela categoria. Aí ela volta para a query — e
    quem monta a base já mandou a rota de busca junto.
  */
  const categoriaNoCaminho = base.startsWith(ROTA_DA_CATEGORIA) && filtros.categorias.length === 1
  if (!categoriaNoCaminho && filtros.categorias.length > 0) {
    p.set('categoria', filtros.categorias.join(SEPARADOR))
  }
  if (filtros.marcas.length > 0) p.set('marca', filtros.marcas.join(SEPARADOR))
  if (filtros.sabores.length > 0) p.set('sabor', filtros.sabores.join(SEPARADOR))
  if (filtros.soPromocao) p.set('promocao', '1')
  if (filtros.precoMax !== null) p.set('preco_max', String(filtros.precoMax))
  if (filtros.dosePrecoMax !== null) p.set('dose_max', String(filtros.dosePrecoMax))
  if (filtros.ordem !== 'relevancia') p.set('ordem', filtros.ordem)
  const query = p.toString()
  return query === '' ? base : `${base}?${query}`
}

/**
 * O link da busca já filtrada por uma marca.
 *
 * Existe para ninguém montar `/produtos?marca=...` à mão. A URL é contrato
 * entre quem escreve e `parseFiltros`, que lê — e um segundo lugar montando a
 * string é um segundo lugar para o nome do parâmetro divergir. É também o que
 * mantém o link coberto: a faixa da home e o índice `/marcas` são componentes
 * que a mutação não alcança, e o serializador é.
 */
export function buscaPorMarca(slug: string): string {
  return serializarFiltros({ ...FILTROS_VAZIOS, marcas: [slug] })
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
  /*
    Lista vazia não filtra, e várias marcadas somam.

    Dentro de um grupo a relação é "ou": Growth **ou** Max Titanium. Entre
    grupos continua sendo "e": Growth ou Max, **e** chocolate. É o que a pessoa
    espera de uma lista de caixas marcáveis, e o contrário — "e" dentro do
    grupo — devolveria zero sempre, porque nenhum produto é de duas marcas.
  */
  categoria: (p: CategoryProduct, f: Filtros) => {
    if (f.categorias.length === 0) return true
    const slug = categoriaDoProduto(p.name)?.slug
    return slug !== undefined && f.categorias.includes(slug)
  },
  marca: (p: CategoryProduct, f: Filtros) => {
    if (f.marcas.length === 0) return true
    const slug = slugDoProduto(p)
    return slug !== null && f.marcas.includes(slug)
  },
  /*
    O sabor casa por família, não por string.

    "Milkshake de chocolate" entra no filtro de Chocolate, e "Natural" e
    "Neutro" entram em "Sem sabor". Produto cujo sabor não cai em família
    nenhuma some quando alguém filtra — mesmo tratamento da dose ausente: não
    dá para afirmar que é chocolate quem o catálogo não diz que é.
  */
  sabor: (p: CategoryProduct, f: Filtros) => {
    if (f.sabores.length === 0) return true
    const familia = familiaDoSabor(p.flavor)?.valor
    return familia !== undefined && f.sabores.includes(familia)
  },
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

  /*
    Um chip por valor escolhido, e cada × tira só aquele.

    Com multisseleção, um chip por grupo — "Marca (2)" — obrigaria a abrir o
    painel para desmarcar uma das duas. O chip existe justamente para quem não
    está com o painel à vista.
  */
  for (const c of filtros.categorias) {
    chips.push({
      rotulo: getCategoryBySlug(c)?.name ?? c,
      href: sem({ categorias: filtros.categorias.filter(v => v !== c) }),
    })
  }
  for (const m of filtros.marcas) {
    // O rótulo vem da faceta, que carrega o nome como o banco o escreve —
    // "Integralmédica", não "integralmedica" do slug.
    chips.push({
      rotulo: marcas.find(f => f.valor === m)?.rotulo ?? m,
      href: sem({ marcas: filtros.marcas.filter(v => v !== m) }),
    })
  }
  for (const sabor of filtros.sabores) {
    chips.push({
      rotulo: saborPorValor(sabor)?.rotulo ?? sabor,
      href: sem({ sabores: filtros.sabores.filter(v => v !== sabor) }),
    })
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
 * O estado que "Limpar" restaura: tudo, menos a ordenação.
 *
 * Mora aqui para a tela e o painel não manterem duas listas de campos que
 * precisam concordar — esquecer um campo numa delas limparia pela metade, e a
 * tela continuaria mostrando um recorte sem chip que o explique.
 */
export const SEM_FILTRO: Partial<Filtros> = {
  termo: '',
  categorias: [],
  marcas: [],
  sabores: [],
  soPromocao: false,
  precoMax: null,
  dosePrecoMax: null,
}

/**
 * `true` quando nenhum filtro está ativo. A ordenação não conta como filtro:
 * ela muda a ordem do mesmo conjunto, não o conjunto.
 */
export function semFiltro(filtros: Filtros): boolean {
  return (
    filtros.termo === '' &&
    filtros.categorias.length === 0 &&
    filtros.marcas.length === 0 &&
    filtros.sabores.length === 0 &&
    !filtros.soPromocao &&
    filtros.precoMax === null &&
    filtros.dosePrecoMax === null
  )
}
