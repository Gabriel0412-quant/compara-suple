import Link from 'next/link'

import { ConteudoDoCartao } from '@/components/brand/LogoDaMarca'
import { buscaPorMarca } from '@/lib/filtros'
import { type Marca } from '@/lib/brands'

/* Reexportado: `FaixaDeMarcas.test.ts` exercita o cartão por aqui desde o #203. */
export { ConteudoDoCartao }

/**
 * A faixa de marcas acompanhadas, abaixo do hero (maquete 1b).
 *
 * Cada cartão mostra o logo da marca quando temos o arquivo dela, e o nome
 * escrito quando não temos. O logo identifica a marca cujos preços listamos —
 * uso nominativo, o mesmo de qualquer comparador. O que o #151 recusou, e
 * continua recusado, é vestir um cartão nosso com a cor oficial de terceiro:
 * ali a cor não identificava ninguém, só insinuava uma relação institucional
 * que não existe. A razão completa está em `lib/brand-logos.ts`.
 *
 * O cartão é claro porque três das cinco logos são pretas: no cartão escuro
 * que a faixa usava, elas sumiriam.
 *
 * A faixa não diz mais qual é o recorte. Ela mostra as marcas com mais ofertas
 * ativas, e até o #205 dizia isso em texto para o corte não parecer arbitrário.
 * O critério não sumiu, mudou de lugar: "Ver todas as marcas" fica ao lado do
 * título, e `/marcas` abre declarando a ordem — "da que tem mais ofertas para a
 * que tem menos". Se aquele link sair daqui, o recorte volta a precisar de
 * legenda.
 */

export default function FaixaDeMarcas({
  marcas,
}: {
  /** Já ordenadas e cortadas por `marcasEmDestaque()`. */
  marcas: Marca[]
}) {
  // Sem marca não há faixa. Nem esqueleto, nem promessa: a seção some.
  if (marcas.length === 0) return null

  return (
    <section
      aria-labelledby="marcas-acompanhadas"
      className="border-t border-line bg-surface px-4 py-8 md:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2
            id="marcas-acompanhadas"
            className="font-mono text-sm uppercase tracking-[0.12em] text-ink-4 sm:text-[11px]"
          >
            Marcas acompanhadas
          </h2>
          <span aria-hidden="true" className="hidden h-px flex-1 bg-line sm:block" />
          {/*
            O link que faltava no #152: `/marcas` não existia ainda, e apontar
            para 404 é o que o rodapé já rejeitou quando removeu Sobre, Blog e
            Termos apontando para "#". Agora o destino existe.
          */}
          <Link
            href="/marcas"
            className="flex min-h-11 items-center rounded-md text-sm font-semibold text-brand-strong hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Ver todas as marcas <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {marcas.map(marca => (
            <li key={marca.slug}>
              <Link
                /*
                  Filtro de marca, não busca por texto.

                  Era `?q=Growth Supplements`, que dependia de o nome da marca
                  aparecer no nome do produto para casar. Desde o #220 existe
                  filtro de verdade, e `?marca=` é o mesmo slug que
                  `parseFiltros` lê — então o cartão leva à busca já filtrada,
                  com o chip da marca visível e removível.
                */
                href={buscaPorMarca(marca.slug)}
                className="group flex h-[72px] items-center justify-center rounded-xl border border-line-strong bg-surface-muted px-4 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <ConteudoDoCartao marca={marca} />
                {/*
                  As contagens vão para o nome acessível do link, para quem
                  navega por leitor de tela saber o tamanho da cobertura sem
                  poluir a faixa.
                */}
                <span className="sr-only">
                  {` — ${marca.produtos} ${marca.produtos === 1 ? 'produto' : 'produtos'}, ${marca.ofertas} ${marca.ofertas === 1 ? 'oferta ativa' : 'ofertas ativas'}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
