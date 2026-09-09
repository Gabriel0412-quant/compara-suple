import Image from 'next/image'
import Link from 'next/link'

import { logoDaMarca } from '@/lib/brand-logos'
import { type Marca } from '@/lib/brands'

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
 */

/** Altura de exibição do logo, antes da correção ótica de cada marca. */
const ALTURA_BASE = 36

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

/**
 * O conteúdo do cartão: logo se houver arquivo, nome escrito se não houver.
 *
 * O fallback não é decoração — a faixa é dado vivo. Ela mostra as marcas com
 * mais ofertas ativas, e a próxima coleta pode trazer para cá uma marca cujo
 * logo não temos. Sem este caminho, o cartão sairia vazio.
 */
export function ConteudoDoCartao({ marca }: { marca: Marca }) {
  const logo = logoDaMarca(marca.nome)

  if (!logo) {
    return (
      <span className="text-center text-base font-bold uppercase leading-tight tracking-[-0.02em] text-ink">
        {marca.nome}
      </span>
    )
  }

  return (
    <Image
      src={logo.arquivo}
      // O nome é o texto alternativo: é o que o logo diz. Junto com o `sr-only`
      // abaixo, forma o nome acessível do link.
      alt={marca.nome}
      width={logo.largura}
      height={logo.altura}
      /*
        Sem o otimizador. São marcas pequenas, exibidas em tamanho fixo, e o
        otimizador do Next recusa SVG sem `dangerouslyAllowSVG` ligado no
        projeto inteiro — o que valeria a pena se a imagem viesse de fora, mas
        estas são nossas e estão em `public/`.
      */
      unoptimized
      /*
        A altura vai em `style`, não em classe.

        `max-h-[${...}px]` montado em tempo de execução não é gerado pelo
        Tailwind e sai sem altura nenhuma, em silêncio — a mesma armadilha que
        `CLASSE_DO_TOM` existe para evitar. Aqui o valor é numérico e por marca,
        então não há mapa que sirva: é `style` mesmo.
      */
      // Arredondado: `36 * 1.45` em ponto flutuante sai `52.199999999999996`,
      // e esse número inteiro ia parar no HTML servido.
      style={{ maxHeight: `${Math.round(ALTURA_BASE * (logo.escala ?? 1))}px` }}
      /*
        Cor neutralizada, e original de volta no hover.

        Decidido comparando os dois tratamentos na tela: com a cor de origem, o
        vermelho e azul da Growth puxa o olho para um cartão de cinco enquanto
        as outras quatro são quase pretas, e a fileira deixa de ler como um
        conjunto. Não é o motivo do #151 — aqui a cor é do próprio logo, e
        identifica de fato. É composição: cinco identidades desenhadas para
        dominar sozinhas, lado a lado, brigam entre si. O hover devolve a cor a
        quem se interessou por aquela marca.
      */
      className="w-auto max-w-full object-contain grayscale transition-[filter] group-hover:grayscale-0"
    />
  )
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
          <p className="text-sm text-ink-3">{descreverCorte(total, marcas.length)}</p>
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
                // A busca já filtra por marca (#46), então este destino existe
                // hoje. O índice `/marcas` é o #153, e o link para ele entra lá.
                href={`/produtos?q=${encodeURIComponent(marca.nome)}`}
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
