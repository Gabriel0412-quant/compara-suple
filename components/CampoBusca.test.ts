import { describe, expect, it } from 'vitest'

import CampoBusca from './CampoBusca'

/**
 * O que quebra quando duas buscas dividem a mesma página.
 *
 * A do header (#235) convive com a do hero na home e com a da listagem em
 * `/produtos`. As duas falhas possíveis são silenciosas: `id` repetido faz o
 * clique no rótulo de uma focar a outra, e dois marcos `role="search"` com o
 * mesmo nome deixam quem navega por landmark escolhendo no escuro. Nenhuma das
 * duas quebra o build nem aparece na tela.
 *
 * O e2e cobre isso no HTML servido; aqui se cobre a regra que o sustenta, sem
 * precisar de página montada.
 */

/** Percorre a árvore devolvida e junta os elementos que casam o teste. */
function achar(no: unknown, casa: (props: Record<string, unknown>) => boolean, achados: Record<string, unknown>[] = []) {
  if (Array.isArray(no)) {
    for (const filho of no) achar(filho, casa, achados)
    return achados
  }
  if (!no || typeof no !== 'object') return achados
  const props = (no as { props?: Record<string, unknown> }).props
  if (!props) return achados
  if (casa(props)) achados.push(props)
  achar(props.children, casa, achados)
  return achados
}

const campoDe = (tamanho: 'hero' | 'padrao' | 'header') =>
  achar(CampoBusca({ tamanho }), p => p.name === 'q')[0]

const rotuloDe = (tamanho: 'hero' | 'padrao' | 'header') =>
  achar(CampoBusca({ tamanho }), p => typeof p.htmlFor === 'string')[0]

describe('as três variantes de busca', () => {
  it('o campo do header tem id próprio, porque divide a página com os outros', () => {
    expect(campoDe('header').id).not.toBe(campoDe('hero').id)
    expect(campoDe('header').id).not.toBe(campoDe('padrao').id)
  })

  it('o rótulo aponta para o campo da própria variante', () => {
    // `htmlFor` apontando para o `id` de outra instância é a falha que não
    // aparece: o rótulo existe, o leitor de tela lê, e o clique foca o campo
    // errado — o do outro formulário.
    for (const tamanho of ['hero', 'padrao', 'header'] as const) {
      expect(rotuloDe(tamanho).htmlFor, `${tamanho} com rótulo órfão`).toBe(campoDe(tamanho).id)
    }
  })

  it('o marco de busca do header tem nome distinto do das páginas', () => {
    const marco = (t: 'hero' | 'padrao' | 'header') =>
      (CampoBusca({ tamanho: t }) as { props: Record<string, unknown> }).props['aria-label']

    expect(marco('header')).not.toBe(marco('hero'))
    expect(marco('header')).not.toBe(marco('padrao'))
  })

  it('as três enviam o mesmo parâmetro para a mesma rota', () => {
    // O que muda entre elas é tamanho e rótulo. Se o `name` ou o `action`
    // divergissem, uma das buscas levaria a lugar nenhum.
    for (const tamanho of ['hero', 'padrao', 'header'] as const) {
      const form = CampoBusca({ tamanho }) as { props: Record<string, unknown> }
      expect(form.props.action, `${tamanho} com destino diferente`).toBe('/produtos')
      expect(form.props.method).toBe('get')
      expect(campoDe(tamanho).name, `${tamanho} com parâmetro diferente`).toBe('q')
    }
  })
})
