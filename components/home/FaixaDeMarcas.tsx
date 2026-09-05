import Link from 'next/link'

import { tomDaMarca, type Marca, type TomDeMarca } from '@/lib/brands'

/**
 * A faixa de marcas acompanhadas, abaixo do hero (maquete 1b).
 *
 * Os cartões não são logos. Cada um leva o nome escrito sobre um tom da casa,
 * pela razão registrada no #151: reproduzir a cor oficial de uma marca num
 * cartão que não é o logo dela insinua uma relação institucional que não
 * existe. Não somos revendedores nem parceiros — listamos preço de anúncios.
 */

/**
 * Tom → classe, escrito por extenso.
 *
 * `bg-${tom}` não funciona: o Tailwind varre o código em busca de nomes de
 * classe literais, e uma classe montada em tempo de execução simplesmente não
 * é gerada — o cartão sairia transparente, sem erro nenhum.
 */
const CLASSE_DO_TOM: Record<TomDeMarca, string> = {
  'surface-dark': 'bg-surface-dark',
  'brand-strong': 'bg-brand-strong',
  'surface-darker': 'bg-surface-darker',
  'brand-deep': 'bg-brand-deep',
  'surface-dark-raised': 'bg-surface-dark-raised',
  'brand-ink': 'bg-brand-ink',
}

/**
 * O texto que explica o recorte.
 *
 * A faixa mostra as marcas com mais ofertas ativas, não todas e não em ordem
 * alfabética. Sem dizer isso, o recorte parece arbitrário — e, pior, dizer
 * "as 5 com mais ofertas" quando o catálogo só tem 3 marcas seria afirmar um
 * corte que não houve.
 *
 * Exportada para ser testada: é a única regra desta tela, e ela pode mentir.
 */
export function descreverCorte(total: number, exibidas: number): string {
  if (exibidas < total) return `as ${exibidas} com mais ofertas ativas`
  return exibidas === 1 ? 'a única com oferta ativa' : 'todas as que têm oferta ativa'
}

export default function FaixaDeMarcas({
  marcas,
  total,
}: {
  /** Já ordenadas e cortadas por `marcasEmDestaque()`. */
  marcas: Marca[]
  /** Quantas marcas o catálogo tem ao todo, para o texto do recorte. */
  total: number
}) {
  // Sem marca não há faixa. Nem esqueleto, nem "em breve": a seção some.
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
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4"
          >
            Marcas acompanhadas
          </h2>
          <p className="text-sm text-ink-3">{descreverCorte(total, marcas.length)}</p>
          <span aria-hidden="true" className="hidden h-px flex-1 bg-line sm:block" />
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {marcas.map(marca => (
            <li key={marca.slug}>
              <Link
                // A busca já filtra por marca (#46), então este destino existe
                // hoje. O índice `/marcas` é o #153, e o link para ele entra lá.
                href={`/produtos?q=${encodeURIComponent(marca.nome)}`}
                className={`flex h-[72px] items-center justify-center rounded-xl px-3 text-center transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${CLASSE_DO_TOM[tomDaMarca(marca)]}`}
              >
                <span className="text-lg font-bold uppercase leading-tight tracking-[-0.02em] text-white">
                  {marca.nome}
                </span>
                {/*
                  O cartão mostra só o nome, como na maquete. As contagens vão
                  para o nome acessível do link, para quem navega por leitor de
                  tela saber o tamanho da cobertura sem poluir a faixa.
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
