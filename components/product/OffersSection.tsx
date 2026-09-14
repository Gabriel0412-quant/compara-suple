'use client'

import { useMemo, useState } from 'react'
import { ArrowDownAZ, MapPin, ShieldCheck, Truck } from 'lucide-react'

import { formatBRL, pricePerDose, type Offer } from '@/lib/products'
import { formatCount } from '@/lib/stats'
import {
  filtrarRows,
  linhasVisiveis,
  menorPrecoRow,
  ofertasOcultas,
  offerToRow,
  ordenarRows,
  rotuloDeMaisOfertas,
  rotuloFrete,
  OFERTAS_VISIVEIS,
  type SortBy,
} from '@/lib/offers-table'

/**
 * A tabela de ofertas, na paleta de Preço Suplemento.
 *
 * A maquete 1c desenha esta seção como "Onde comprar", com três lojas grandes
 * e um "ver mais 1 loja". Aqui ela continua sendo uma tabela com filtros, e o
 * motivo é o catálogo: a mediana é de 9 ofertas por produto, mas a creatina da
 * Integralmédica tem 544. Três linhas grandes e um link não dão conta disso —
 * quem chega neste produto precisa filtrar, não paginar.
 *
 * O vocabulário mudou junto com as cores. A seção dizia "Comparar em N lojas",
 * e não são lojas: é um marketplace só, e o que se compara são anúncios dele.
 * É a primeira frase do CLAUDE.md, e esta era a última tela que a contrariava.
 */
export function OffersSection({
  offers,
  servings,
  superficie = 'produto',
}: {
  offers: Offer[]
  servings: number | null
  superficie?: 'produto' | 'comparador'
}) {
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(false)
  const [onlyOfficial, setOnlyOfficial] = useState(false)
  const [onlyFull, setOnlyFull] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('featured')
  const [tudoAberto, setTudoAberto] = useState(false)

  /*
    Os mutantes desativados neste arquivo têm todos o mesmo motivo, e é honesto
    dizê-lo uma vez: eles só mudam de resultado DEPOIS de um clique.

    O vitest aqui renderiza uma vez, estaticamente — este repositório não tem
    jsdom nem testing-library, e montar um DOM só para o Stryker seria trocar
    uma dependência de teste por uma pontuação. Lista de dependência de
    `useMemo`, corpo de `onClick` e a classe do ramo ativo de um chip são
    invisíveis na primeira renderização, e nenhuma asserção sobre o HTML
    inicial os distingue do original.

    Quem cobre a interação é `e2e/produto.spec.ts`, que filtra, ordena e abre a
    lista contra o app servido. O que dá para observar numa renderização só —
    quem leva o selo de menor preço, quando aparece o preço riscado, o que o
    botão de "ver mais" diz — está coberto em `OffersSection.test.tsx` e
    continua sendo mutado.
  */
  // Stryker disable next-line ArrayDeclaration
  const todas = useMemo(() => offers.map(offerToRow), [offers])

  const visiveis = useMemo(
    // Stryker disable next-line ObjectLiteral
    () => ordenarRows(filtrarRows(todas, { onlyFreeShipping, onlyOfficial, onlyFull }), sortBy),
    // Stryker disable next-line ArrayDeclaration
    [todas, onlyFreeShipping, onlyOfficial, onlyFull, sortBy],
  )

  /*
    A mais barata sai das linhas filtradas, e não das exibidas: o teto é um
    recorte de leitura, não uma escolha do visitante sobre o que comparar.
    Calculá-la sobre as dez primeiras faria o selo "MENOR PREÇO" mudar de dono
    conforme a tabela abre e fecha.
  */
  const maisBarata = menorPrecoRow(visiveis)
  /*
    O `?? 0` só é alcançado com a lista vazia, e aí nenhuma linha é renderizada
    — `precoMaisBarato` não chega a ser usado. Mutante equivalente.
  */
  // Stryker disable next-line OptionalChaining,LogicalOperator
  const precoMaisBarato = maisBarata?.preco ?? 0
  // Stryker disable next-line ArrayDeclaration
  const filtrosAtivos = [onlyFreeShipping, onlyOfficial, onlyFull].filter(Boolean).length
  /*
    Sai do JSX para que a diretiva do Stryker caia num comentário de JavaScript:
    dentro de `{/* ... *\/}` ela não é lida, e o mutante que apaga o recorte
    ("N de M") passa sem ninguém notar. Só existe com filtro ligado, que é
    estado de depois do clique — coberto no e2e.
  */
  /*
    Bloco, e não `disable next-line`: a diretiva de uma linha só cai sobre
    `const recorte =`, e a condição está na linha seguinte. Foi assim que um
    mutante escapou no #241, e foi assim que este escapou de novo aqui.
  */
  // Stryker disable ConditionalExpression,StringLiteral
  const recorte =
    filtrosAtivos > 0 ? (
      <span className="font-normal text-ink-4"> de {formatCount(todas.length)}</span>
    ) : null
  // Stryker restore ConditionalExpression,StringLiteral
  const ocultas = ofertasOcultas(visiveis, OFERTAS_VISIVEIS)
  const naTela = tudoAberto ? visiveis : linhasVisiveis(visiveis, OFERTAS_VISIVEIS)

  return (
    <section
      aria-labelledby="ofertas-do-produto"
      className="overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="border-b border-line p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="ofertas-do-produto" className="text-xl font-bold tracking-[-0.025em] text-ink">
              {formatCount(visiveis.length)}
              {recorte}{' '}
              {visiveis.length === 1 ? 'oferta' : 'ofertas'} no Mercado Livre
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">
              A ordem &ldquo;Destaque&rdquo; é a do próprio Mercado Livre. Frete não entra no preço.
            </p>
          </div>
          <SeletorDeOrdem valor={sortBy} aoMudar={setSortBy} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-muted px-5 py-3">
        <span className="mr-1 font-mono text-xs uppercase tracking-[0.1em] text-ink-3">Filtros</span>
        <Chip
          ativo={onlyFreeShipping}
          // Stryker disable next-line ArrowFunction,BooleanLiteral
          aoAlternar={() => setOnlyFreeShipping(v => !v)}
          icone={<Truck className="h-3.5 w-3.5" />}
        >
          Frete grátis
        </Chip>
        <Chip
          ativo={onlyOfficial}
          // Stryker disable next-line ArrowFunction,BooleanLiteral
          aoAlternar={() => setOnlyOfficial(v => !v)}
          icone={<ShieldCheck className="h-3.5 w-3.5" />}
        >
          Loja oficial
        </Chip>
        <Chip
          ativo={onlyFull}
          // Stryker disable next-line ArrowFunction,BooleanLiteral
          aoAlternar={() => setOnlyFull(v => !v)}
        >
          Full (envio rápido)
        </Chip>
        {filtrosAtivos > 0 && (
          <button
            onClick={() => {
              setOnlyFreeShipping(false)
              setOnlyOfficial(false)
              setOnlyFull(false)
            }}
            className="ml-auto text-sm text-ink-3 underline hover:text-ink"
          >
            limpar
          </button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <p className="p-10 text-center text-ink-3">Nenhuma oferta atende a esses filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full max-sm:block sm:min-w-[620px]">
            {/*
              Quatro colunas de largura declarada, como na maquete 1c. A
              entrega, que era a quinta, desceu para a linha do vendedor: com
              cinco colunas em 780px o "+R$ 17,01 vs. menor preço" quebrava em
              três linhas e cada oferta ocupava 100px de altura.
            */}
            <colgroup className="max-sm:hidden">
              <col />
              <col className="w-40" />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <thead className="max-sm:hidden">
              <tr className="border-b border-line">
                {/*
                  `relative` no `th`, e não é enfeite.

                  O cabeçalho da coluna de ação é `sr-only`, que é
                  `position: absolute`. Sem um ancestral posicionado, o bloco
                  de contenção dele vira o da página inteira — e aí ele escapa
                  do `overflow-x-auto` da tabela e estica o documento. Medido:
                  206px de transbordo horizontal a 390px de largura, causados
                  por um elemento de 1px que ninguém vê.
                */}
                {['Oferta', 'Preço', 'R$/dose', 'Ação'].map(col => (
                  <th
                    key={col}
                    className="relative px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.1em] text-ink-3"
                  >
                    {col === 'Ação' ? <span className="sr-only">Ação</span> : col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {naTela.map(linha => {
                // `maisBarata` só é nulo com a lista vazia, e aí este `map` não roda.
                // Stryker disable next-line OptionalChaining
                const eMaisBarata = linha.offerId === maisBarata?.offerId
                const porDose = pricePerDose(linha.preco, servings)
                /*
                  Zero e não `null` para a mais barata: com `number | null` a
                  renderização precisava de `diferenca !== null && diferenca > 0`,
                  e a primeira metade é guarda de tipo — `null > 0` já é falso,
                  então o mutante que a apaga é equivalente e não morre. Em
                  número puro sobra uma condição só, e ela tem caso de teste.
                */
                const diferenca = eMaisBarata ? 0 : linha.preco - precoMaisBarato
                return (
                  <tr
                    key={linha.offerId}
                    className={`border-b border-line transition-colors last:border-0 max-sm:grid max-sm:grid-cols-2 max-sm:items-center max-sm:gap-x-3 max-sm:px-4 max-sm:py-3 ${
                      eMaisBarata ? 'bg-surface-warm' : 'hover:bg-surface-muted'
                    }`}
                  >
                    <td className="px-4 py-3 max-sm:col-span-2 max-sm:px-0 max-sm:py-0">
                      <div className="flex items-center gap-2.5">
                        {/*
                          Quadrado neutro com as iniciais, e não um círculo
                          colorido por `seller_id`. A cor sorteada parecia
                          identidade de marca de terceiro sem ser nenhuma — e o
                          #151 já decidiu que cartão nosso não se veste com cor
                          que não é nossa.
                        */}
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted font-mono text-xs font-semibold text-ink-3"
                        >
                          {linha.avatar}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-semibold text-ink">{linha.nome}</span>
                            {eMaisBarata && (
                              <span className="whitespace-nowrap rounded-full bg-brand px-2 py-0.5 font-mono text-xs font-semibold text-white">
                                MENOR PREÇO
                              </span>
                            )}
                            {linha.isOfficial && !eMaisBarata && (
                              <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-surface-warm px-2 py-0.5 font-mono text-xs font-semibold text-brand-ink">
                                <ShieldCheck className="h-2.5 w-2.5" />
                                OFICIAL
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-4">
                            {linha.freeShipping && (
                              <span className="inline-flex items-center gap-0.5">
                                <Truck className="h-2.5 w-2.5" />
                                Frete grátis
                              </span>
                            )}
                            {linha.city && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {linha.city}
                                {linha.state ? `, ${linha.state}` : ''}
                              </span>
                            )}
                            <span>{linha.entrega}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* O preço é o do item. O frete depende do CEP e não é somado. */}
                    <td className="px-4 py-3 max-sm:px-0 max-sm:pb-0 max-sm:pt-2">
                      <p className="font-mono font-semibold text-ink">{formatBRL(linha.preco)}</p>
                      {linha.originalPrice && linha.originalPrice > linha.preco && (
                        <p className="font-mono text-sm text-ink-4 line-through">
                          {formatBRL(linha.originalPrice)}
                        </p>
                      )}
                      <p className="text-sm text-ink-4">{rotuloFrete(linha)}</p>
                      {diferenca > 0 && (
                        <p className="font-mono text-sm text-ink-4">
                          +{formatBRL(diferenca)} vs. menor preço
                        </p>
                      )}
                    </td>

                    {/*
                      No celular a tabela vira cartão: as colunas somem e o
                      valor perde o cabeçalho que o nomeava. Sem o rótulo,
                      "R$ 5,94" ao lado de "R$ 189,99" lê como um segundo preço
                      do produto, e não como o preço da dose.
                    */}
                    <td className="px-4 py-3 max-sm:px-0 max-sm:pb-0 max-sm:pt-2 max-sm:text-right">
                      {porDose ? (
                        <p className="font-mono text-ink-2">
                          {porDose.replace(' / dose', '')}
                          <span className="text-ink-4 sm:hidden"> / dose</span>
                        </p>
                      ) : (
                        <p className="text-sm text-ink-4">—</p>
                      )}
                    </td>

                    <td className="px-4 py-3 max-sm:col-span-2 max-sm:px-0 max-sm:pb-0 max-sm:pt-3">
                      <a
                        href={`/go/${linha.offerId}?de=${superficie}&por=${
                          eMaisBarata ? 'menor_preco' : 'destaque'
                        }`}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className={`flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${
                          eMaisBarata
                            ? 'bg-ink text-ink-on-dark hover:bg-surface-darker'
                            : 'border border-line-strong text-ink-2 hover:border-brand hover:text-brand-strong'
                        }`}
                      >
                        Ir à loja
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/*
            O botão diz quantas faltam, e não só "ver mais": o número é a
            informação — 121 ofertas escondidas e 2 escondidas são decisões
            diferentes para quem está comparando.
          */}
          {ocultas > 0 && (
            <button
              // Stryker disable next-line ArrowFunction,BooleanLiteral
              onClick={() => setTudoAberto(v => !v)}
              aria-expanded={tudoAberto}
              aria-controls="ofertas-do-produto"
              className="flex min-h-12 w-full items-center justify-center border-t border-line px-4 text-sm font-semibold text-brand-strong transition-colors hover:bg-surface-warm-soft"
            >
              {rotuloDeMaisOfertas(ocultas, tudoAberto)}
            </button>
          )}
        </div>
      )}

      <div className="space-y-1.5 border-t border-line bg-surface-warm-soft px-5 py-4 text-sm leading-relaxed text-ink-3">
        <p className="font-semibold text-ink-2">Como funciona o redirecionamento</p>
        <p>
          Ao clicar em <strong>Ir à loja</strong>, você vai para a página do produto no Mercado
          Livre. O ML decide qual vendedor destacar por frete, CEP, estoque e reputação — pode
          mostrar uma oferta diferente da que você clicou. Os preços acima são os da última coleta;
          o ML pode atualizá-los a qualquer momento.
        </p>
        <p>
          Os valores são <strong>o preço do item</strong>. O frete depende do seu CEP e não está
          somado aqui — confira na loja antes de fechar. Onde a oferta tem frete grátis, isso vem
          indicado na linha.
        </p>
        <p>Ganhamos comissão quando você compra por um link daqui, sem custo extra para você.</p>
      </div>
    </section>
  )
}

/**
 * Como um chip de filtro se veste, ligado e desligado.
 *
 * Exportada porque o ramo ligado não existe na primeira renderização — ele só
 * aparece depois de um clique, e é justamente o estado em que o visitante
 * precisa enxergar que há filtro aplicado. Como função, os dois ramos têm
 * teste; dentro do JSX, um deles seria só uma string que ninguém verifica.
 */
export function classeDoChip(ativo: boolean): string {
  return ativo
    ? 'border-brand bg-brand text-white hover:bg-brand-strong'
    : 'border-line-strong bg-surface text-ink-2 hover:border-brand hover:text-brand-strong'
}

function Chip({
  ativo,
  aoAlternar,
  icone,
  children,
}: {
  ativo: boolean
  aoAlternar: () => void
  icone?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={aoAlternar}
      aria-pressed={ativo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${classeDoChip(
        ativo,
      )}`}
    >
      {icone}
      {children}
    </button>
  )
}

function SeletorDeOrdem({
  valor,
  aoMudar,
}: {
  valor: SortBy
  aoMudar: (v: SortBy) => void
}) {
  const rotulos: Record<SortBy, string> = {
    featured: 'Destaque (ordem do Mercado Livre)',
    preco: 'Menor preço',
    discount: 'Maior desconto',
  }
  return (
    <div className="inline-flex items-center gap-2">
      <ArrowDownAZ className="h-3.5 w-3.5 text-ink-4" aria-hidden="true" />
      <label htmlFor="ordem-das-ofertas" className="sr-only">
        Ordenar ofertas
      </label>
      <select
        id="ordem-das-ofertas"
        value={valor}
        // Stryker disable next-line ArrowFunction
        onChange={e => aoMudar(e.target.value as SortBy)}
        className="cursor-pointer rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
      >
        {(Object.keys(rotulos) as SortBy[]).map(k => (
          <option key={k} value={k}>
            {rotulos[k]}
          </option>
        ))}
      </select>
    </div>
  )
}
