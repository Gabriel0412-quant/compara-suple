import {
  categoriaDoProduto,
  getAllProductCards,
  getCategoryBySlug,
  type CategoryProduct,
} from './categories'
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
   * Menor preço entre as ofertas ativas da marca, ou `null` se não houver.
   *
   * A maquete 1a põe "R$ 89,90 +" ao lado do botão de cada cartão. O "+" não é
   * enfeite: é o menor preço *de entrada* da marca, e o que está acima dele
   * varia por produto. Sem o sinal, o número leria como "o preço da marca",
   * que não existe.
   */
  menorPreco: number | null
  /**
   * Slugs das categorias que a marca cobre, sem repetição e em ordem.
   *
   * Serve a um uso só: quando é exatamente uma, o cartão pode dizer qual —
   * "CREATINA" sob o nome da Dark Lab é informação. Com três, como a Growth,
   * não há rótulo honesto de uma palavra, e o cartão não inventa um.
   */
  categorias: string[]
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
 * preço de anúncios. Então o monograma usa tons da própria casa.
 *
 * O #203 não revogou isso. Ele trocou o cartão da home pelo logo de verdade,
 * que é uso nominativo e identifica a marca — o oposto de um cartão nosso
 * vestido com a cor dela. Estes tons ficaram para o índice `/marcas`, onde o
 * que aparece é a inicial da marca, e continuam sem imitar cor de terceiro.
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
    /*
      `\s` e não `\s+`: `normalizarTexto` já colapsou sequências de espaço,
      então o `+` nunca casava mais de um. O Stryker mostrou isso ao trocar um
      pelo outro sem nenhum teste reclamar — não era falta de teste, era
      defesa morta dando aparência de robustez.
    */
    .replace(/\s/g, '-')
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

/**
 * As ordens que `/marcas` oferece, e o rótulo de cada uma.
 *
 * A maquete 1a põe um "Ordenar por" ao lado do título. Quatro opções, porque
 * são as quatro perguntas que a página responde: quem tem mais anúncio, quem
 * cobre mais produto, por onde se começa a gastar e onde achar pelo nome.
 *
 * Chaves curtas porque vão na URL. O rótulo fica aqui e não na tela para o
 * `<option>` e o texto do estado atual não descolarem um do outro.
 */
export const ORDENS_DE_MARCA = {
  ofertas: 'Nº de ofertas',
  produtos: 'Nº de produtos',
  preco: 'Menor preço',
  nome: 'Nome',
} as const

export type OrdemDeMarca = keyof typeof ORDENS_DE_MARCA

export const ORDEM_PADRAO: OrdemDeMarca = 'ofertas'

/**
 * Lê a ordem da URL, caindo no padrão para qualquer coisa que não reconheça.
 *
 * Valor forjado na query não pode quebrar a página nem virar rótulo: a mesma
 * regra que `/go/[offerId]` aplica a superfície e critério inventados.
 */
export function ordemDeMarcaValida(valor: string | string[] | undefined): OrdemDeMarca {
  /*
    Chave repetida (`?ordem=nome&ordem=preco`) chega como array. Aqui não se
    tenta adivinhar qual vale: cai no padrão. A lista separada por vírgula do
    #224 existe para filtro multivalorado, e ordem não é um.
  */
  if (typeof valor !== 'string') return ORDEM_PADRAO
  return valor in ORDENS_DE_MARCA ? (valor as OrdemDeMarca) : ORDEM_PADRAO
}

/**
 * Ordena por um dos critérios oferecidos.
 *
 * Todos terminam no nome em pt-BR pelo motivo já escrito em `ordenarMarcas`:
 * sem um desempate final, duas marcas idênticas no critério trocam de lugar
 * entre deploys conforme a ordem em que o banco respondeu.
 *
 * `preco` sobe em vez de descer — é "a partir de quanto", e o menor primeiro é
 * a leitura natural. Marca sem preço vai para o fim, e não para o começo, que
 * é onde um `null` tratado como zero a colocaria.
 */
export function ordenarMarcasPor(marcas: Marca[], ordem: OrdemDeMarca): Marca[] {
  if (ordem === 'ofertas') return ordenarMarcas(marcas)

  const porNome = (a: Marca, b: Marca) => a.nome.localeCompare(b.nome, 'pt-BR')

  if (ordem === 'nome') return [...marcas].sort(porNome)

  if (ordem === 'produtos') {
    return [...marcas].sort(
      (a, b) => b.produtos - a.produtos || b.ofertas - a.ofertas || porNome(a, b),
    )
  }

  return [...marcas].sort((a, b) => {
    if (a.menorPreco === null && b.menorPreco === null) return porNome(a, b)
    if (a.menorPreco === null) return 1
    if (b.menorPreco === null) return -1
    return a.menorPreco - b.menorPreco || porNome(a, b)
  })
}

/**
 * Como a página descreve a própria ordem, logo abaixo do título.
 *
 * O texto não é enfeite. A faixa da home mostra cinco marcas e, desde o #205,
 * não diz mais que são as cinco com mais ofertas — o critério mudou de lugar
 * para cá, e `e2e/marcas.spec.ts` cobra que ele esteja aqui. Por isso a frase
 * do padrão é literal: se ela sumir, o recorte da home volta a ser arbitrário.
 *
 * E por isso também ela muda junto com a ordem escolhida. Manter "da que tem
 * mais ofertas para a que tem menos" no topo de uma lista ordenada por nome
 * seria a página descrevendo errado o que ela mesma está mostrando.
 */
export function descricaoDaOrdem(ordem: OrdemDeMarca): string {
  if (ordem === 'produtos') return 'da que cobre mais produtos para a que cobre menos'
  if (ordem === 'preco') return 'do menor preço de entrada para o maior'
  if (ordem === 'nome') return 'em ordem alfabética'
  return 'da que tem mais ofertas para a que tem menos'
}

/**
 * O selo do cartão: um fato derivado, ou nada.
 *
 * A maquete 1a põe um rótulo curto ao lado de cada nome, e três dos que ela
 * desenha não têm como existir. "MAIOR QUEDA" afirma variação de preço no
 * tempo, que depende do histórico do EP10 (#128). "WHEY 3W" é nome de produto
 * vestido de categoria. E a oitava marca, "MONITORANDO", descreve marca sem
 * oferta ativa — estado que `agregarMarcas` não produz, porque marca só existe
 * aqui se tiver o que vender.
 *
 * Sobra o que o dado sustenta, nesta ordem de prioridade:
 *
 * 1. quem lidera em ofertas, que é o critério com que a página abre;
 * 2. quem cobre mais produtos, se não for a mesma;
 * 3. a categoria, quando a marca tem exatamente uma.
 *
 * E `null` quando nada disso vale — o selo some, não vira "—" nem "outros".
 */
export function destaqueDaMarca(marca: Marca, marcas: Marca[]): string | null {
  if (marcas.length === 0) return null

  const lider = ordenarMarcas(marcas)[0]
  if (lider.slug === marca.slug) return '1º em ofertas'

  const maisProdutos = marcas.reduce((melhor, m) => (m.produtos > melhor.produtos ? m : melhor))
  if (maisProdutos.slug === marca.slug) return 'Mais produtos'

  if (marca.categorias.length === 1) return getCategoryBySlug(marca.categorias[0])?.name ?? null

  return null
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

    /*
      O menor preço do produto é o da oferta mais barata, que nem sempre é a
      destacada — a mesma distinção que o card de produto faz. Quando não há
      oferta mais barata registrada, o destaque é o que temos.
    */
    const menorDoProduto = card.lowestPrice ?? card.featuredPrice
    const categoria = categoriaDoProduto(card.name)

    const chave = normalizarTexto(nome)
    const atual = porNome.get(chave)
    if (atual) {
      atual.produtos += 1
      atual.ofertas += card.offerCount
      /*
        A guarda de `null` é do compilador, não do comportamento.

        `menorDoProduto` é `lowestPrice ?? featuredPrice`, e `featuredPrice` é
        `number` — então toda marca já entra no mapa com um preço, e o ramo do
        `null` nunca roda. O Stryker mostra isso trocando a condição por
        `false` sem nenhum teste conseguir notar.

        Não dá para remover: o campo é `number | null` porque o tipo descreve
        marca sem preço, que é estado possível para quem consome `Marca` — e
        sem a guarda o compilador recusa passar `number | null` ao `Math.min`.
        E não dá para matar com teste: precisaria de uma marca já agregada com
        preço nulo, que esta função não produz.

        Mesma decisão, e mesmo motivo, das duas guardas de `lib/card.ts`.
      */
      // Stryker disable ConditionalExpression
      atual.menorPreco =
        atual.menorPreco === null ? menorDoProduto : Math.min(atual.menorPreco, menorDoProduto)
      // Stryker restore ConditionalExpression
      if (categoria && !atual.categorias.includes(categoria.slug)) {
        atual.categorias.push(categoria.slug)
      }
      continue
    }
    porNome.set(chave, {
      nome,
      slug: slugDaMarca(nome),
      produtos: 1,
      ofertas: card.offerCount,
      menorPreco: menorDoProduto,
      categorias: categoria ? [categoria.slug] : [],
      tom: hashEstavel(nome) % TONS_DE_MARCA.length,
    })
  }

  return ordenarMarcas([...porNome.values()])
}

/*
  Os dois wrappers abaixo ficam fora da mutação.

  São as únicas linhas do módulo que tocam o banco, e é por isso que
  `agregarMarcas` é puro e exportado. Cobri-los exigiria mockar
  `getAllProductCards`, o que testaria o mock e não a regra; quem prova que
  funcionam é o e2e de `/marcas` e da faixa da home.
*/
// Stryker disable all
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
// Stryker restore all
