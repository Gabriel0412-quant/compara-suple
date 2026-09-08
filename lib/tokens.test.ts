import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Cor da marca mora em `app/globals.css`, e só lá.
 *
 * A maquete de Preço Suplemento veio do Claude Design em estilo inline: só a
 * home 1b repete `#F26A1B` dezenas de vezes, porque num canvas de desenho isso
 * não custa nada. Copiar esse padrão para os componentes custa: a cor deixa de
 * ter um dono, e a próxima loja, o tema escuro ou um ajuste de contraste viram
 * busca e substituição em vinte arquivos.
 *
 * Este teste existe para que isso não aconteça em silêncio. Ele é irmão de
 * `claims.test.ts`: mesma ideia de auditar o próprio código-fonte, e mesma
 * consequência — o build falha.
 */

const RAIZ = process.cwd()

/** `#fff`, `#F26A1B`, `#F26A1BCC`. */
const HEX = /#[0-9a-fA-F]{3,8}\b/g
/** `oklch(...)`, `rgb(...)`, `rgba(...)`, `hsl(...)`. */
const FUNCAO_DE_COR = /\b(?:oklch|rgba?|hsla?)\([^)]*\)/g

/**
 * Classe da paleta padrão do Tailwind: `text-green-600`, `bg-gray-50`.
 *
 * O teste acima pegava `#F26A1B` e deixava passar `text-green-600`, que é a
 * mesma falha com outra sintaxe — e foi por isso que a home ficou com hero
 * laranja e cards verdes por três PRs sem nada acusar (#192).
 *
 * A paleta de Preço Suplemento está em `app/globals.css` e se usa por
 * `bg-brand`, `text-ink-3`, `border-line`. Cor que vem do Tailwind não passou
 * por decisão nenhuma de marca.
 */
const CLASSE_DA_PALETA_PADRAO =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g

/**
 * Exceções, cada uma com data de validade declarada.
 *
 * Não é lista de conveniência: uma entrada aqui é dívida, e quem a adiciona
 * precisa dizer qual issue a remove.
 */
const EXCECOES: { arquivo: string; valores: string[]; porque: string }[] = [
  {
    arquivo: 'app/produto/[slug]/page.tsx',
    valores: ['#16a34a'],
    porque:
      'Gráfico de histórico ainda em mock e desabilitado na tela, verde fora da paleta. ' +
      'Sai quando o #114 (EP10) ligar o histórico real, ou quando o #133 redesenhar a página — o que vier antes.',
  },
]

/**
 * Telas que ainda não foram redesenhadas, com a issue que as migra.
 *
 * Não é lista de conveniência: é dívida com prazo. Cada entrada some quando a
 * página correspondente entrar no EP22, e nenhuma entrada nova deve ser
 * acrescentada — arquivo novo já nasce nos tokens.
 */
const AGUARDANDO_REDESENHO: { arquivo: string; issue: string }[] = [
  { arquivo: 'app/produtos/page.tsx', issue: '#161' },
  { arquivo: 'app/produto/[slug]/page.tsx', issue: '#163' },
  { arquivo: 'app/produto/[slug]/loading.tsx', issue: '#163' },
  { arquivo: 'app/produto/[slug]/not-found.tsx', issue: '#163' },
  { arquivo: 'components/product/OffersSection.tsx', issue: '#163' },
  { arquivo: 'app/comparar/page.tsx', issue: '#165' },
  { arquivo: 'app/categoria/[slug]/page.tsx', issue: '#167' },
  { arquivo: 'app/categoria/[slug]/not-found.tsx', issue: '#167' },
  { arquivo: 'app/ofertas/page.tsx', issue: '#169' },
  { arquivo: 'components/ComoComparamos.tsx', issue: '#163' },
]

function arquivosDeUi(): string[] {
  const achados: string[] = []
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) {
        anda(caminho)
        continue
      }
      if (!/\.tsx?$/.test(nome)) continue
      if (/\.test\.tsx?$/.test(nome)) continue
      achados.push(caminho)
    }
  }
  for (const alvo of ['app', 'components']) anda(resolve(RAIZ, alvo))
  return achados
}

type Ocorrencia = { arquivo: string; linha: number; valor: string }

/**
 * Apaga comentários preservando a numeração das linhas.
 *
 * Precisa existir porque referência de issue é indistinguível de cor: `#129`
 * casa com `#[0-9a-fA-F]{3}` tão bem quanto `#fff`. A primeira versão deste
 * teste acusou o comentário "Volta no #129" do Header como se fosse laranja
 * escrito à mão (#120).
 *
 * `lib/claims.ts` exporta `removerComentarios`, mas ele troca cada bloco por
 * um único espaço — o que desloca as linhas seguintes, e este relatório cita
 * linha. Aqui a substituição mantém as quebras.
 *
 * Cor dentro de comentário também não é cor de verdade, então apagar os dois
 * casos de uma vez está certo pelos dois motivos.
 */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (_linha, indentacao: string) => indentacao)
}

function coresLiterais(conteudo: string, arquivo: string): Ocorrencia[] {
  const permitidos = new Set(
    EXCECOES.filter((e) => e.arquivo === arquivo).flatMap((e) => e.valores.map((v) => v.toLowerCase())),
  )
  const achados: Ocorrencia[] = []
  conteudo.split('\n').forEach((texto, i) => {
    for (const re of [HEX, FUNCAO_DE_COR]) {
      for (const m of texto.matchAll(re)) {
        if (permitidos.has(m[0].toLowerCase())) continue
        achados.push({ arquivo, linha: i + 1, valor: m[0] })
      }
    }
  })
  return achados
}

describe('cores da marca vivem só nos tokens', () => {
  it('nenhum literal de cor em app/ ou components/', () => {
    const ocorrencias = arquivosDeUi().flatMap((caminho) =>
      coresLiterais(semComentarios(readFileSync(caminho, 'utf8')), relative(RAIZ, caminho)),
    )

    const relatorio = ocorrencias.map((o) => `  ${o.arquivo}:${o.linha}  ${o.valor}`).join('\n')
    expect(
      ocorrencias,
      ocorrencias.length === 0
        ? ''
        : `Cor escrita direto no componente:\n${relatorio}\n\n` +
          'A paleta de Preço Suplemento está em app/globals.css. Use o token — ' +
          'bg-brand, text-ink-3, border-line — em vez do valor. Se a cor for mesmo ' +
          'nova, acrescente o token lá primeiro.',
    ).toEqual([])
  })

  it('audita um conjunto de arquivos que não está vazio', () => {
    // Uma auditoria que não lê nada passa sempre. Mesma proteção do claims.test.ts.
    expect(arquivosDeUi().length).toBeGreaterThan(5)
  })

  it('nenhuma classe da paleta padrão do Tailwind fora das telas ainda não redesenhadas', () => {
    const esperando = new Set(AGUARDANDO_REDESENHO.map(e => e.arquivo))

    const achados = arquivosDeUi().flatMap(caminho => {
      const arquivo = relative(RAIZ, caminho)
      if (esperando.has(arquivo)) return []
      const conteudo = semComentarios(readFileSync(caminho, 'utf8'))
      return conteudo.split('\n').flatMap((texto, i) =>
        [...texto.matchAll(CLASSE_DA_PALETA_PADRAO)].map(m => `  ${arquivo}:${i + 1}  ${m[0]}`),
      )
    })

    expect(
      achados,
      achados.length === 0
        ? ''
        : `Cor da paleta do Tailwind, não da marca:\n${achados.join('\n')}\n\n` +
          'Use os tokens de app/globals.css — bg-brand, text-ink-3, border-line. ' +
          'Se o arquivo ainda espera redesenho, ele precisa estar em AGUARDANDO_REDESENHO ' +
          'com a issue que o migra.',
    ).toEqual([])
  })

  it('toda tela aguardando redesenho aponta a issue que a migra', () => {
    for (const { arquivo, issue } of AGUARDANDO_REDESENHO) {
      expect(issue, `${arquivo} sem issue de migração`).toMatch(/^#\d+$/)
    }
  })

  it('a lista de espera não guarda arquivo que já foi migrado', () => {
    // Entrada obsoleta esconde regressão: o arquivo voltaria a poder usar a
    // paleta antiga sem ninguém notar.
    for (const { arquivo } of AGUARDANDO_REDESENHO) {
      const conteudo = semComentarios(readFileSync(resolve(RAIZ, arquivo), 'utf8'))
      expect(
        CLASSE_DA_PALETA_PADRAO.test(conteudo),
        `${arquivo} já está nos tokens: tire da lista de espera`,
      ).toBe(true)
      CLASSE_DA_PALETA_PADRAO.lastIndex = 0
    }
  })

  it('referência de issue em comentário não é confundida com cor', () => {
    // O caso real que quebrou o #120: "Volta no #129" acusado como hex.
    const codigo = ['// Volta no #129, junto com o serviço.', 'const a = 1', '/* ver #114 e #fff */'].join('\n')
    expect(coresLiterais(semComentarios(codigo), 'exemplo.tsx')).toEqual([])
  })

  it('mas cor fora de comentário continua sendo acusada, na linha certa', () => {
    // A mutação que importa: o comentário some, e o que sobra mantém a linha.
    const codigo = ['/* bloco\n de duas linhas */', 'const cor = "#F26A1B"'].join('\n')
    const achados = coresLiterais(semComentarios(codigo), 'exemplo.tsx')
    expect(achados).toHaveLength(1)
    expect(achados[0]).toMatchObject({ valor: '#F26A1B', linha: 3 })
  })

  it('toda exceção aponta a issue que a remove', () => {
    for (const e of EXCECOES) {
      expect(e.porque, `exceção de ${e.arquivo} sem justificativa`).toMatch(/#\d+/)
    }
  })
})

describe('os tokens da paleta existem', () => {
  const css = readFileSync(resolve(RAIZ, 'app/globals.css'), 'utf8')

  // Se um destes sumir, algum componente perde a cor sem erro de compilação:
  // Tailwind simplesmente não gera a classe e o elemento fica transparente.
  it.each([
    '--brand',
    '--brand-strong',
    '--surface',
    '--surface-muted',
    '--surface-dark',
    '--surface-warm',
    '--ink',
    '--ink-3',
    '--ink-on-dark',
    '--line',
  ])('define %s', (token) => {
    expect(css).toContain(`${token}:`)
  })

  it('expõe as fontes da marca ao Tailwind', () => {
    expect(css).toContain('--font-sans: var(--font-familjen-grotesk)')
    expect(css).toContain('--font-mono: var(--font-ibm-plex-mono)')
  })
})
