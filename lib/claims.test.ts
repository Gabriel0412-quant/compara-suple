import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CLAIMS_PROIBIDOS,
  descreverOcorrencia,
  encontrarClaims,
  removerComentarios,
  type OcorrenciaDeClaim,
} from './claims'

const RAIZ = process.cwd()

/** Arquivos que compõem as telas públicas. */
function arquivosDeUi(): string[] {
  const alvos = ['app', 'components']
  const achados: string[] = []
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) {
        if (nome === 'api') continue
        anda(caminho)
        continue
      }
      if (!/\.tsx?$/.test(nome)) continue
      if (/\.test\.tsx?$/.test(nome)) continue
      achados.push(caminho)
    }
  }
  for (const alvo of alvos) anda(resolve(RAIZ, alvo))
  return achados
}

describe('auditoria de claims nas telas públicas', () => {
  it('nenhuma frase proibida aparece no código das páginas', () => {
    const ocorrencias: OcorrenciaDeClaim[] = []
    for (const caminho of arquivosDeUi()) {
      const conteudo = removerComentarios(readFileSync(caminho, 'utf8'))
      ocorrencias.push(...encontrarClaims(conteudo, relative(RAIZ, caminho)))
    }

    const relatorio = ocorrencias.map(descreverOcorrencia).join('\n')
    expect(
      ocorrencias,
      ocorrencias.length === 0
        ? ''
        : `Claims proibidos reapareceram:\n${relatorio}\n\n` +
          'Cada um destes já esteve na tela e saiu por não ter como ser sustentado. ' +
          'Se algum passou a ter lastro, remova a entrada de lib/claims.ts junto com a mudança, ' +
          'explicando de onde vem o dado.',
    ).toEqual([])
  })

  it('audita um conjunto de arquivos que não está vazio', () => {
    // Uma auditoria que não lê nada passa sempre.
    expect(arquivosDeUi().length).toBeGreaterThan(5)
  })
})

describe('encontrarClaims', () => {
  it('acha a frase e diz de onde', () => {
    const r = encontrarClaims('<p>Em estoque</p>', 'exemplo.tsx')
    expect(r).toHaveLength(1)
    expect(r[0].arquivo).toBe('exemplo.tsx')
    expect(r[0].trecho).toBe('Em estoque')
  })

  it('ignora caixa', () => {
    expect(encontrarClaims('EM ESTOQUE', 'x')).toHaveLength(1)
    expect(encontrarClaims('em estoque', 'x')).toHaveLength(1)
  })

  it('texto limpo não acusa nada', () => {
    expect(encontrarClaims('<p>Ver oferta no Mercado Livre</p>', 'x')).toEqual([])
  })

  it('desconto de uma oferta não é economia agregada', () => {
    // "Economiza R$ 30" sai de `original_price` do anúncio e tem origem; foi a
    // auditoria do HTML servido que expôs a diferença.
    expect(encontrarClaims('Economiza R$ 30', 'x')).toEqual([])
  })

  it('acha mais de um claim no mesmo arquivo', () => {
    const r = encontrarClaims('Em estoque. Compra segura no ML.', 'x')
    expect(r.length).toBeGreaterThanOrEqual(2)
  })

  it.each([
    ['estoque inventado', 'Em estoque'],
    ['promessa de segurança', 'Compra segura no ML'],
    ['selo de afiliado', '✓ Link de afiliado'],
    ['checkout aqui', 'Comprar agora →'],
    ['juízo de valor', 'o melhor whey de 2026'],
    ['alegação de saúde', 'previne lesões'],
    ['registro sanitário', 'Aprovado pela Anvisa'],
    ['economia prometida', 'economize até R$ 1.200'],
    ['economia agregada', 'R$ 4,2M economizados pelos usuários'],
  ])('pega %s', (_rotulo, texto) => {
    expect(encontrarClaims(texto, 'x').length).toBeGreaterThan(0)
  })
})

describe('catálogo de claims', () => {
  it('cada claim explica por que não pode', () => {
    for (const c of CLAIMS_PROIBIDOS) {
      expect(c.porque.length, String(c.padrao)).toBeGreaterThan(20)
    }
  })
})

describe('removerComentarios', () => {
  it('tira comentário de linha', () => {
    expect(removerComentarios('const a = 1 \n// Em estoque\nconst b = 2')).not.toMatch(/Em estoque/)
  })

  it('tira bloco de comentário', () => {
    expect(removerComentarios('/* Compra segura no ML */ const a = 1')).not.toMatch(/Compra segura/)
  })

  it('tira comentário de JSX', () => {
    expect(removerComentarios('{/* Comprar agora saiu daqui */}<p>ok</p>')).not.toMatch(/Comprar agora/)
  })

  it('preserva o que vai para a tela', () => {
    const jsx = '<p>Ver oferta no Mercado Livre</p>'
    expect(removerComentarios(jsx)).toContain('Ver oferta no Mercado Livre')
  })

  it('preserva string de JSX mesmo com comentário na linha de cima', () => {
    const codigo = '// nota interna\n<p>Ganhamos comissão</p>'
    expect(removerComentarios(codigo)).toContain('Ganhamos comissão')
  })

  it('o comentário que documenta a remoção não conta como reincidência', () => {
    // É exatamente o caso que fez a primeira versão da auditoria falhar:
    // os comentários dos PRs #50 e #56 citam as frases que removeram.
    const real = `
      /*
        "Compra segura no ML" era promessa que não temos como sustentar.
      */
      <a href="/go/1">Ver oferta no Mercado Livre</a>
    `
    expect(encontrarClaims(removerComentarios(real), 'x')).toEqual([])
  })
})
