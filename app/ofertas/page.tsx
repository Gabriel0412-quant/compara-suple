import type { Metadata } from 'next'

import { PaginaDeBusca } from '@/components/busca/PaginaDeBusca'
import { getAllProductCards } from '@/lib/categories'
import { ROTA_DAS_OFERTAS, ordemPadrao, parseFiltros } from '@/lib/filtros'
import { getCatalogStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ofertas em suplementos · Preço Suplemento',
  description:
    'Suplementos em promoção no Mercado Livre — wheys, creatina, pré-treino e mais com desconto.',
}

/**
 * `/ofertas` é a tela de busca com a promoção fixa no caminho.
 *
 * Era uma página inteira só dela: grade própria, cabeçalho com emoji, botão
 * verde e fundo cinza — o visual de antes do rebranding, que nenhuma outra
 * rota ainda usava. E o que ela mostrava era exatamente o que a busca mostra
 * com "Só em promoção" marcado e a ordem por desconto.
 *
 * Duas telas para o mesmo recorte custam duas vezes: o filtro de marca, o de
 * sabor, o teto de preço e a ordenação existiam numa e não na outra, e quem
 * chegava aqui perdia todos eles.
 *
 * A promoção fica no caminho, como a categoria em `/categoria/<slug>`:
 * `serializarFiltros` não a repete na query, e o × do chip leva para
 * `/produtos` sem ela — porque `/ofertas` sem promoção não é `/ofertas`.
 */
export default async function OfertasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  /*
    O padrão da rota é "maior desconto", e não relevância: abrir uma página de
    promoções na ordem do catálogo esconderia o que ela promete mostrar. Quem
    clicar em "Relevância" continua sendo obedecido — é `ordemPadrao` que
    mantém a leitura e a escrita da URL de acordo.
  */
  const daQuery = parseFiltros(await searchParams, ordemPadrao(ROTA_DAS_OFERTAS))
  const filtros = { ...daQuery, soPromocao: true }

  const [catalogo, { lastUpdated }] = await Promise.all([
    getAllProductCards(),
    getCatalogStats(),
  ])

  return (
    <PaginaDeBusca
      titulo="Ofertas em suplementos"
      trilha="Ofertas"
      filtros={filtros}
      catalogo={catalogo}
      lastUpdated={lastUpdated}
      base={ROTA_DAS_OFERTAS}
    />
  )
}
