import { describe, expect, it } from 'vitest'
import { classificarIdCatalogo, motivoDeRecusa } from './catalog-id'
import { loadCuratedItems } from './ingest'

describe('classificarIdCatalogo', () => {
  it('reconhece catalog product', () => {
    expect(classificarIdCatalogo('MLB19049048')).toBe('catalog_product')
    expect(classificarIdCatalogo('MLB6204289')).toBe('catalog_product')
  })

  it('reconhece user product', () => {
    // O caso real que fazia a coleta relatar 15 de 16 sem explicar o restante.
    expect(classificarIdCatalogo('MLBU3907661448')).toBe('user_product')
  })

  it('não confunde user product com catalog product', () => {
    // A regex anterior, /^MLB(U)?[A-Z0-9]+$/i, aceitava os dois como iguais.
    expect(classificarIdCatalogo('MLBU123')).not.toBe('catalog_product')
  })

  it('aceita as duas caixas', () => {
    expect(classificarIdCatalogo('mlb123')).toBe('catalog_product')
    expect(classificarIdCatalogo('mlbu123')).toBe('user_product')
  })

  it('ignora espaço nas pontas', () => {
    expect(classificarIdCatalogo('  MLB123  ')).toBe('catalog_product')
  })

  it.each([
    ['string vazia', ''],
    ['prefixo sozinho', 'MLB'],
    ['prefixo de user product sozinho', 'MLBU'],
    ['site errado', 'MLA123'],
    ['letras no lugar dos dígitos', 'MLBABC'],
    ['id de anúncio, não de catálogo', 'MLB-123'],
  ])('rejeita %s', (_rotulo, valor) => {
    expect(classificarIdCatalogo(valor)).toBe('desconhecido')
  })

  it.each([null, undefined, 123, {}, []])('rejeita valor não textual: %s', valor => {
    expect(classificarIdCatalogo(valor)).toBe('desconhecido')
  })
})

describe('motivoDeRecusa', () => {
  it('nomeia a recusa de user product', () => {
    expect(motivoDeRecusa('user_product')).toBe('user_product_nao_suportado')
  })

  it('nomeia a recusa de id inválido', () => {
    expect(motivoDeRecusa('id_invalido' as never)).toBe(null)
    expect(motivoDeRecusa('desconhecido')).toBe('id_invalido')
  })

  it('catalog product não é recusado', () => {
    expect(motivoDeRecusa('catalog_product')).toBeNull()
  })
})

describe('loadCuratedItems separa o que dá para coletar', () => {
  it('recusa user product e mantém os catalog products', () => {
    const { items, recusados } = loadCuratedItems([
      { catalog_id: 'MLB19049048' },
      { catalog_id: 'MLBU3907661448' },
      { catalog_id: 'MLB6204289' },
    ])
    expect(items.map(i => i.catalogId)).toEqual(['MLB19049048', 'MLB6204289'])
    expect(recusados).toEqual([
      { catalogId: 'MLBU3907661448', motivo: 'user_product_nao_suportado' },
    ])
  })

  it('id inválido some sem virar recusa nomeada', () => {
    // Lixo na lista não é a mesma coisa que um tipo que existe e não sabemos
    // coletar: só o segundo merece linha no relatório.
    const { items, recusados } = loadCuratedItems([
      { catalog_id: 'MLA123' },
      { catalog_id: '' },
      { catalog_id: 'MLB1' },
    ])
    expect(items.map(i => i.catalogId)).toEqual(['MLB1'])
    expect(recusados).toEqual([])
  })

  it('aceita a forma de string simples', () => {
    const { items, recusados } = loadCuratedItems(['MLB1', 'MLBU2'])
    expect(items.map(i => i.catalogId)).toEqual(['MLB1'])
    expect(recusados.map(r => r.catalogId)).toEqual(['MLBU2'])
  })

  it('preserva as URLs curadas por item', () => {
    const { items } = loadCuratedItems([
      { catalog_id: 'MLB1', affiliate_urls: { MLB99: 'https://exemplo/99' } },
    ])
    expect(items[0].manualByItemId).toEqual({ MLB99: 'https://exemplo/99' })
  })

  it('lista vazia não quebra', () => {
    expect(loadCuratedItems([])).toEqual({ items: [], recusados: [] })
  })
})
