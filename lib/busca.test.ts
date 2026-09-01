import { describe, expect, it } from 'vitest'
import {
  casaComTermo,
  filtrarPorTermo,
  normalizarTexto,
  parseTermoBusca,
} from './busca'

describe('normalizarTexto', () => {
  it('remove acento e baixa a caixa', () => {
    expect(normalizarTexto('Proteína')).toBe('proteina')
    expect(normalizarTexto('AÇÃO')).toBe('acao')
  })

  it('colapsa espaços e apara as pontas', () => {
    expect(normalizarTexto('  whey   protein  ')).toBe('whey protein')
  })

  it('devolve string vazia para entrada só de espaço', () => {
    expect(normalizarTexto('   ')).toBe('')
  })
})

describe('parseTermoBusca', () => {
  it('aceita string simples', () => {
    expect(parseTermoBusca('creatina')).toBe('creatina')
  })

  it('pega o primeiro valor quando a URL repete o parâmetro', () => {
    expect(parseTermoBusca(['creatina', 'whey'])).toBe('creatina')
  })

  it('trata ausência e tipo inesperado como termo vazio', () => {
    expect(parseTermoBusca(undefined)).toBe('')
    expect(parseTermoBusca([])).toBe('')
  })

  it('apara espaços', () => {
    expect(parseTermoBusca('  whey  ')).toBe('whey')
  })

  it('corta termo absurdamente longo', () => {
    expect(parseTermoBusca('a'.repeat(500))).toHaveLength(100)
  })

  it('preserva o texto como digitado, sem normalizar', () => {
    // O termo volta para o campo de busca: normalizar aqui faria o visitante
    // ver "proteina" depois de digitar "Proteína".
    expect(parseTermoBusca('Proteína')).toBe('Proteína')
  })
})

describe('casaComTermo', () => {
  it('acha ignorando acento nos dois lados', () => {
    expect(casaComTermo(['Proteína Whey'], 'proteina')).toBe(true)
    expect(casaComTermo(['Proteina Whey'], 'proteína')).toBe(true)
  })

  it('exige todas as palavras do termo', () => {
    expect(casaComTermo(['Whey Protein', 'Growth'], 'whey growth')).toBe(true)
    expect(casaComTermo(['Whey Protein', 'Max Titanium'], 'whey growth')).toBe(false)
  })

  it('casa palavra em qualquer um dos campos', () => {
    expect(casaComTermo(['Creatina', 'Integralmedica'], 'integral')).toBe(true)
  })

  it('ignora campos nulos', () => {
    expect(casaComTermo(['Creatina', null, undefined], 'creatina')).toBe(true)
  })

  it('termo vazio casa com tudo', () => {
    expect(casaComTermo(['qualquer'], '')).toBe(true)
    expect(casaComTermo(['qualquer'], '   ')).toBe(true)
  })

  it('casa por prefixo parcial da palavra', () => {
    expect(casaComTermo(['Creatina Monohidratada'], 'crea')).toBe(true)
  })
})

describe('filtrarPorTermo', () => {
  const catalogo = [
    { nome: 'Whey Protein Concentrado', marca: 'Growth Supplements' },
    { nome: 'Creatina Monohidratada', marca: 'Integralmédica' },
    { nome: 'Whey Isolado', marca: 'Max Titanium' },
  ]
  const campos = (p: (typeof catalogo)[number]) => [p.nome, p.marca]

  it('filtra por nome', () => {
    const r = filtrarPorTermo(catalogo, 'creatina', campos)
    expect(r).toHaveLength(1)
    expect(r[0].nome).toBe('Creatina Monohidratada')
  })

  it('filtra por marca, ignorando acento', () => {
    const r = filtrarPorTermo(catalogo, 'integralmedica', campos)
    expect(r).toHaveLength(1)
  })

  it('combina nome e marca no mesmo termo', () => {
    const r = filtrarPorTermo(catalogo, 'whey max', campos)
    expect(r).toHaveLength(1)
    expect(r[0].nome).toBe('Whey Isolado')
  })

  it('devolve a lista inteira quando o termo é vazio', () => {
    expect(filtrarPorTermo(catalogo, '', campos)).toHaveLength(3)
    expect(filtrarPorTermo(catalogo, '  ', campos)).toHaveLength(3)
  })

  it('devolve lista vazia quando nada casa', () => {
    expect(filtrarPorTermo(catalogo, 'bcaa', campos)).toHaveLength(0)
  })

  it('não modifica a lista original', () => {
    const copia = [...catalogo]
    filtrarPorTermo(catalogo, 'whey', campos)
    expect(catalogo).toEqual(copia)
  })
})
