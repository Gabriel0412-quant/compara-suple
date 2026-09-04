import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O nome antigo não volta.
 *
 * O produto se chamou ComparaSuple até 04/09/2026. A troca por Preço Suplemento
 * é fácil de desfazer sem querer: basta alguém copiar um título de página
 * antigo, restaurar um trecho de um commit velho, ou colar código de um branch
 * que não acompanhou o rebranding.
 *
 * Este teste cobre as superfícies onde o nome é *marca*. Dois lugares guardam
 * a string antiga de propósito, e por isso estão fora do alcance dele:
 *
 * - `lib/ml/token-crypto.ts` — 'compara-suple:ml-oauth:v1' é additional data
 *   do AES-GCM, não texto. Trocar invalida todo token cifrado no banco; o
 *   comentário no arquivo explica.
 * - `supabase/migrations/` — comentários em migrations já aplicadas. Migration
 *   aplicada não se reescreve.
 */

const RAIZ = process.cwd()
const NOME_ANTIGO = /comparasuple/i

function superficiesPublicas(): string[] {
  const achados: string[] = []
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) {
        anda(caminho)
        continue
      }
      if (!/\.(tsx?|css)$/.test(nome)) continue
      if (/marca\.test\.ts$/.test(nome)) continue
      achados.push(caminho)
    }
  }
  for (const alvo of ['app', 'components']) anda(resolve(RAIZ, alvo))
  return achados
}

describe('o nome antigo não aparece nas superfícies públicas', () => {
  it('nenhum arquivo de app/ ou components/ diz ComparaSuple', () => {
    const achados = superficiesPublicas().flatMap((caminho) => {
      const linhas = readFileSync(caminho, 'utf8').split('\n')
      return linhas
        .map((texto, i) => ({ caminho: relative(RAIZ, caminho), linha: i + 1, texto: texto.trim() }))
        .filter((l) => NOME_ANTIGO.test(l.texto))
    })

    const relatorio = achados.map((a) => `  ${a.caminho}:${a.linha}  ${a.texto}`).join('\n')
    expect(
      achados,
      achados.length === 0
        ? ''
        : `O nome antigo reapareceu:\n${relatorio}\n\n` +
          'O produto se chama Preço Suplemento desde 04/09/2026.',
    ).toEqual([])
  })

  it('audita um conjunto de arquivos que não está vazio', () => {
    expect(superficiesPublicas().length).toBeGreaterThan(5)
  })
})

describe('o que guarda o nome antigo de propósito continua guardando', () => {
  it('o additional data do AES-GCM não acompanhou a marca', () => {
    // Se esta asserção falhar, todo refresh token já cifrado no banco parou de
    // decifrar. Não "conserte" trocando a string: leia o comentário no arquivo.
    const fonte = readFileSync(resolve(RAIZ, 'lib/ml/token-crypto.ts'), 'utf8')
    expect(fonte).toContain("Buffer.from('compara-suple:ml-oauth:v1', 'utf8')")
  })
})
