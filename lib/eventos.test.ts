import { describe, expect, it } from 'vitest'
import { ehBot, montarLinha } from './eventos'

describe('montarLinha — regra do termo de busca', () => {
  it('guarda o termo quando a busca não devolveu nada', () => {
    // É o caso que vira decisão de catálogo: procuraram e não temos.
    const l = montarLinha({
      evento: 'busca_enviada', superficie: 'lista', nResultados: 0, termo: 'bcaa',
    })
    expect(l.termo).toBe('bcaa')
    expect(l.n_resultados).toBe(0)
  })

  it('descarta o termo quando houve resultado', () => {
    const l = montarLinha({
      evento: 'busca_enviada', superficie: 'lista', nResultados: 7, termo: 'whey',
    })
    expect(l.termo).toBeNull()
    expect(l.n_resultados).toBe(7)
  })

  it('corta termo longo no limite da constraint', () => {
    const l = montarLinha({
      evento: 'busca_enviada', superficie: 'lista', nResultados: 0, termo: 'a'.repeat(500),
    })
    expect(l.termo).toHaveLength(100)
  })

  it('termo só de espaço vira null, não string vazia', () => {
    const l = montarLinha({
      evento: 'busca_enviada', superficie: 'lista', nResultados: 0, termo: '   ',
    })
    expect(l.termo).toBeNull()
  })

  it('apara espaço das pontas', () => {
    const l = montarLinha({
      evento: 'busca_enviada', superficie: 'lista', nResultados: 0, termo: '  bcaa  ',
    })
    expect(l.termo).toBe('bcaa')
  })
})

describe('montarLinha — demais eventos', () => {
  it('comparação leva a contagem de produtos e nada mais', () => {
    const l = montarLinha({ evento: 'comparacao_montada', superficie: 'comparador', nProdutos: 3 })
    expect(l).toEqual({
      evento: 'comparacao_montada', superficie: 'comparador',
      n_produtos: 3, n_resultados: null, criterio: null, termo: null,
    })
  })

  it('metodologia leva só a superfície', () => {
    const l = montarLinha({ evento: 'metodologia_aberta', superficie: 'produto' })
    expect(l.termo).toBeNull()
    expect(l.n_produtos).toBeNull()
    expect(l.criterio).toBeNull()
  })

  it('saída leva o critério do destaque', () => {
    const l = montarLinha({ evento: 'saida_para_loja', superficie: 'lista', criterio: 'menor_preco' })
    expect(l.criterio).toBe('menor_preco')
  })

  it('saída sem critério não inventa um', () => {
    const l = montarLinha({ evento: 'saida_para_loja', superficie: 'produto' })
    expect(l.criterio).toBeNull()
  })
})

describe('nenhum evento carrega dado pessoal', () => {
  const CAMPOS_PERMITIDOS = [
    'evento', 'superficie', 'n_resultados', 'n_produtos', 'criterio', 'termo',
  ]

  it.each([
    ['busca com resultado', { evento: 'busca_enviada', superficie: 'lista', nResultados: 3, termo: 'whey' }],
    ['busca sem resultado', { evento: 'busca_enviada', superficie: 'lista', nResultados: 0, termo: 'bcaa' }],
    ['comparação', { evento: 'comparacao_montada', superficie: 'comparador', nProdutos: 2 }],
    ['metodologia', { evento: 'metodologia_aberta', superficie: 'home' }],
    ['saída', { evento: 'saida_para_loja', superficie: 'lista', criterio: 'destaque' }],
  ] as const)('%s só produz campos do dicionário', (_rotulo, entrada) => {
    // Se alguém acrescentar IP, cookie ou user-agent à linha, este teste cai.
    expect(Object.keys(montarLinha(entrada)).sort()).toEqual([...CAMPOS_PERMITIDOS].sort())
  })
})

describe('ehBot', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'facebookexternalhit/1.1',
    'curl/8.4.0',
    'python-requests/2.31.0',
    'Mozilla/5.0 HeadlessChrome/120',
  ])('reconhece automação: %s', ua => {
    expect(ehBot(ua)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
  ])('deixa passar navegador de gente: %s', ua => {
    expect(ehBot(ua)).toBe(false)
  })

  it('sem user-agent trata como automação', () => {
    expect(ehBot(null)).toBe(true)
    expect(ehBot('')).toBe(true)
    expect(ehBot(undefined)).toBe(true)
  })
})
