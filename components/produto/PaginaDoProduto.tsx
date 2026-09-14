import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import { ComoComparamos } from '@/components/ComoComparamos'
import { Prateleira } from '@/components/home/Prateleira'
import { CaixaDePreco } from '@/components/produto/CaixaDePreco'
import { OffersSection } from '@/components/product/OffersSection'
import type { Category, CategoryProduct } from '@/lib/categories'
import type { EstadoDoProduto } from '@/lib/produto'
import type { Offer } from '@/lib/products'
import { formatCount } from '@/lib/stats'

/**
 * A página de produto sobre a maquete 1c, aprovada em 13/09/2026.
 *
 * 1c é a variante de coluna fixa: o corpo cresce à esquerda — identidade,
 * ofertas, metodologia — e a coluna da direita, com preço e saída, acompanha a
 * rolagem. É a única das três em que o botão de ir à loja não some quando a
 * pessoa desce para comparar as ofertas.
 *
 * Três blocos da maquete não foram construídos, e não é atraso: é ausência de
 * dado, medida contra produção em 13/09/2026.
 *
 * - **Chips de tamanho e sabor** ("1 kg · 2 kg · Baunilha"). O catálogo tem 22
 *   produtos e 23 variantes: uma cada, exceto um. Não há o que alternar. O
 *   sabor e o peso que existem aparecem na linha de embalagem.
 * - **Histórico de preço** com abas de 30, 90 e 180 dias. `price_history` tem
 *   8.697 linhas em 11 dias distintos, e só 9 deles seguidos (31/08 a 08/09).
 *   Um gráfico de 90 dias sobre 9 pontos é desenho, não medição — e mínimo e
 *   máximo sairiam de anúncios diferentes do mesmo produto, não da variação de
 *   um preço no tempo. Volta com o EP10 (#114).
 * - **Nutrição por dose** (proteína, carboidrato, calorias). Não existe coluna
 *   de proteína no catálogo; é o EP15 que enriquece a ficha.
 *
 * A versão anterior desta página trazia os três como esqueleto desabilitado,
 * mais cinco estrelas fixas em 4,5 e quatro miniaturas vazias. Seção sem dado
 * some — é a regra da linha editorial, e era esta a tela que mais a violava.
 */
export function PaginaDoProduto({
  nome,
  marca,
  produtoId,
  categoria,
  estado,
  ofertas,
  servings,
  relacionados,
}: {
  nome: string
  marca: string | null
  produtoId: number
  categoria: Category | null
  estado: EstadoDoProduto
  ofertas: Offer[]
  servings: number | null
  relacionados: CategoryProduct[]
}) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            ...(categoria ? [{ label: categoria.name, href: `/categoria/${categoria.slug}` }] : []),
            { label: nome },
          ]}
        />

        {/*
          370px na coluna da direita, como na maquete. Fixa e não fracionária:
          é uma caixa de leitura, com preço em monoespaçada e um botão — a
          largura dela não deveria mudar porque o nome do produto é longo.

          `items-start` é o que faz o `sticky` funcionar: sem ele o item de
          grade estica até a altura da linha, e um elemento que já ocupa toda a
          altura disponível não tem para onde grudar.

          A ordem do DOM é a ordem do CELULAR — identidade, preço, ofertas —, e
          o desktop reposiciona por `col-start`/`row-start`. Não é preferência
          de estilo: `order` do flex e do grid muda o que se vê e não muda a
          ordem do Tab, e este repositório já pagou por isso uma vez, quando o
          menu do cabeçalho passou a ser focado antes do campo de busca que
          aparecia acima dele. Em coluna única, a caixa com o preço e a saída
          precisa vir logo depois do nome do produto: colocada por CSS ela
          caía 3.400px abaixo, depois da tabela inteira.
        */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <Identidade nome={nome} marca={marca} estado={estado} />
          </div>

          <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <CaixaDePreco estado={estado} />
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <OffersSection offers={ofertas} servings={servings} />

            <nav aria-label="Comparar este produto" className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/comparar?ids=${produtoId}`}
                className="flex min-h-11 items-center rounded-xl border border-brand px-4 text-sm font-semibold text-brand-strong transition-colors hover:bg-brand hover:text-white"
              >
                Comparar com outros suplementos
              </Link>
              {categoria && (
                <Link
                  href={`/categoria/${categoria.slug}`}
                  className="flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand-strong"
                >
                  Ver todos de {categoria.name}
                </Link>
              )}
            </nav>

            <ComoComparamos ultimaColeta={estado.ultimaColeta} className="mt-6" />
          </div>
        </div>
      </main>

      {relacionados.length > 0 && categoria && (
        <section className="bg-surface-muted">
          <Prateleira
            id="prateleira-relacionados"
            titulo={`${categoria.name} mais barato por dose`}
            legenda="Outros produtos da mesma categoria, do menor para o maior preço por dose informado no anúncio."
            link={{ href: `/categoria/${categoria.slug}`, rotulo: `Ver todos de ${categoria.name}` }}
            produtos={relacionados}
            superficie="produto"
          />
        </section>
      )}
    </div>
  )
}

/** Foto, marca, nome, embalagem e azulejos — o topo da maquete 1c. */
function Identidade({
  nome,
  marca,
  estado,
}: {
  nome: string
  marca: string | null
  estado: EstadoDoProduto
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-[280px_minmax(0,1fr)] sm:gap-7">
      {/*
        Caixa de 280px com altura fixa, como os 300×280 da maquete. Fundo
        branco e `object-contain` pelo mesmo motivo do card: quase toda foto do
        ML já vem recortada em branco, e um fundo creme viraria moldura em
        volta de um quadrado branco.
      */}
      <div className="flex h-[280px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface">
        {estado.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={estado.thumbnail} alt={nome} className="h-full w-full object-contain p-4" />
        ) : (
          <span className="text-sm text-ink-4">sem imagem</span>
        )}
      </div>

      <div className="min-w-0">
        {marca && (
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-brand-ink">{marca}</p>
        )}
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.03em] text-ink md:text-4xl">
          {nome}
        </h1>

        <p className="mt-3 font-mono text-sm text-ink-3">
          {estado.embalagem ?? 'sem dose ou peso informado'} · {formatCount(estado.totalOfertas)}{' '}
          {estado.totalOfertas === 1 ? 'oferta' : 'ofertas'} no Mercado Livre
        </p>

        {estado.metricas.length > 0 && (
          <dl className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {estado.metricas.map(m => (
              <div
                key={m.rotulo}
                className={`rounded-xl px-4 py-3 ${
                  m.destaque ? 'bg-surface-warm' : 'bg-surface-muted'
                }`}
              >
                <dt className="font-mono text-xs uppercase tracking-[0.1em] text-ink-3">
                  {m.rotulo}
                </dt>
                <dd
                  className={`mt-1 font-mono text-xl font-semibold ${
                    m.destaque ? 'text-brand-ink' : 'text-ink'
                  }`}
                >
                  {m.valor}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}
