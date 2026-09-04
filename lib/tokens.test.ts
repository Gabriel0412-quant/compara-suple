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
