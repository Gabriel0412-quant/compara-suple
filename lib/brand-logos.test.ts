import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MANIFESTO_DE_LOGOS, logoDaMarca } from './brand-logos'
import { normalizarTexto } from './busca'

/**
 * O manifesto de logos não pode descolar dos arquivos.
 *
 * Ele é escrito à mão, então os três jeitos de ele mentir são: apontar para um
 * arquivo que não existe (logo somem da faixa em produção, e só lá), declarar
 * uma dimensão que não é a do arquivo (a imagem chega e empurra o layout), e
 * usar uma chave não normalizada (o acento de "Integralmédica" derruba a busca
 * em silêncio, porque `logoDaMarca` devolve `null` sem erro nenhum).
 *
 * As dimensões são lidas do arquivo, não do manifesto — se as duas fontes
 * fossem a mesma, o teste concordaria consigo mesmo e não provaria nada.
 */

const PUBLIC = resolve(process.cwd(), 'public')

/** Dimensão intrínseca declarada dentro do arquivo. */
function dimensoesDoArquivo(caminho: string): { largura: number; altura: number } {
  const absoluto = resolve(PUBLIC, caminho.replace(/^\//, ''))

  if (caminho.endsWith('.svg')) {
    const fonte = readFileSync(absoluto, 'utf8')
    const viewBox = fonte.match(/viewBox\s*=\s*"([^"]+)"/)?.[1]
    if (viewBox) {
      const [, , largura, altura] = viewBox.trim().split(/[\s,]+/).map(Number)
      return { largura, altura }
    }
    const largura = Number(fonte.match(/\bwidth\s*=\s*"([\d.]+)/)?.[1])
    const altura = Number(fonte.match(/\bheight\s*=\s*"([\d.]+)/)?.[1])
    return { largura, altura }
  }

  // PNG: o bloco IHDR começa no byte 16, largura e altura em big-endian.
  const bytes = readFileSync(absoluto)
  return { largura: bytes.readUInt32BE(16), altura: bytes.readUInt32BE(20) }
}

const entradas = Object.entries(MANIFESTO_DE_LOGOS)

describe('manifesto de logos', () => {
  /*
    As marcas cobertas, escritas como o banco as escreve.

    Sem esta lista, todo teste do arquivo itera o próprio manifesto e concorda
    com ele: trocar `'growth supplements'` por `''` continuaria passando em
    "chave normalizada" e em "achada em maiúsculas", porque as duas perguntam
    ao manifesto o que ele contém. Aqui a expectativa vem de fora — é o nome
    que `brand.name` devolve em produção, e é o que `logoDaMarca` recebe.

    Marca nova com logo entra aqui de propósito, não por acidente de arquivo
    largado na pasta.
  */
  const COBERTAS = [
    'Growth Supplements',
    'Max Titanium',
    'Soldiers Nutrition',
    'Integralmédica',
    'Dux Nutrition',
  ]

  it('cobre exatamente as marcas declaradas, pelo nome que vem do banco', () => {
    expect(new Set(Object.keys(MANIFESTO_DE_LOGOS))).toEqual(
      new Set(COBERTAS.map(normalizarTexto)),
    )
  })

  it.each(COBERTAS)('%s tem logo', nome => {
    expect(logoDaMarca(nome)).not.toBeNull()
  })

  it('tem ao menos uma marca — manifesto vazio derruba a faixa inteira em silêncio', () => {
    expect(entradas.length).toBeGreaterThan(0)
  })

  it.each(entradas)('%s aponta para um arquivo que existe', (_marca, logo) => {
    expect(existsSync(resolve(PUBLIC, logo.arquivo.replace(/^\//, '')))).toBe(true)
  })

  it.each(entradas)('%s declara a dimensão real do arquivo', (_marca, logo) => {
    const real = dimensoesDoArquivo(logo.arquivo)
    expect({ largura: logo.largura, altura: logo.altura }).toEqual(real)
  })

  it.each(entradas)('%s usa chave já normalizada', marca => {
    expect(marca).toBe(normalizarTexto(marca))
  })

  it('nenhum arquivo serve a duas marcas', () => {
    const arquivos = entradas.map(([, logo]) => logo.arquivo)
    expect(new Set(arquivos).size).toBe(arquivos.length)
  })
})

describe('logoDaMarca', () => {
  it.each(entradas)('%s é achada mesmo escrita em maiúsculas', marca => {
    expect(logoDaMarca(marca.toUpperCase())).not.toBeNull()
  })

  /*
    O caso que de fato discrimina.

    As chaves do manifesto já estão sem acento, então procurá-las por elas
    mesmas concordaria com a regra sem testá-la. O nome que o banco devolve é
    `Integralmédica`, com acento e maiúscula — se `logoDaMarca` comparasse
    string crua, só este caso falharia.
  */
  it('acha Integralmédica pelo nome acentuado que vem do banco', () => {
    expect(logoDaMarca('Integralmédica')).not.toBeNull()
  })

  it('devolve null para marca sem logo, em vez de inventar um caminho', () => {
    expect(logoDaMarca('Marca Que Nao Existe')).toBeNull()
  })
})
