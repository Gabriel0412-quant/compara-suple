import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import FaixaDeMarcas, { ConteudoDoCartao } from './FaixaDeMarcas'
import type { Marca } from '@/lib/brands'
import { removerComentarios } from '@/lib/claims'

/**
 * O que esta suíte cobre.
 *
 * A renderização em si é verificada em `e2e/marcas.spec.ts`, contra o HTML
 * servido — mesma divisão de `claims.test.ts` e `confianca.spec.ts`. Aqui
 * ficam as decisões que a função toma sozinha: sumir sem marca, escolher entre
 * logo e nome escrito, e aplicar a correção ótica.
 *
 * O texto do recorte saiu no #205, e `descreverCorte` com ele.
 */

describe('estado vazio', () => {
  /*
    Um server component é uma função. Para saber se a seção some quando não há
    marca, basta o valor de retorno — não é preciso DOM nem renderizador, o que
    manteria a suíte unitária sem jsdom só por causa deste caso.
  */
  it('sem marca, a seção inteira não existe', () => {
    expect(FaixaDeMarcas({ marcas: [] })).toBeNull()
  })

  it('com marca, a seção existe', () => {
    const marca: Marca = { nome: 'Growth', slug: 'growth', produtos: 2, ofertas: 7, menorPreco: 100, categorias: [], tom: 0 }
    expect(FaixaDeMarcas({ marcas: [marca] })).not.toBeNull()
  })

  it('não há texto de espera para preencher o vazio', () => {
    /*
      "Em breve", esqueleto ou "nenhuma marca ainda" seriam placeholder — a
      regra do projeto é que dado ausente some, não vira promessa.

      Lê sem comentários, reusando o mesmo `removerComentarios` da auditoria de
      claims. Sem isso o teste acusaria o comentário do próprio componente, que
      cita as frases justamente para dizer que elas não entram — é o mesmo
      falso positivo que o `#129` causou no `tokens.test.ts` do #120.
    */
    const fonte = removerComentarios(
      readFileSync(resolve(process.cwd(), 'components/home/FaixaDeMarcas.tsx'), 'utf8'),
    )
    for (const proibido of [/em breve/i, /nenhuma marca/i, /skeleton/i, /placeholder/i]) {
      expect(fonte, `${proibido} não deveria aparecer na faixa`).not.toMatch(proibido)
    }
  })
})

describe('conteúdo do cartão', () => {
  const comLogo: Marca = {
    nome: 'Growth Supplements',
    slug: 'growth-supplements',
    produtos: 4,
    ofertas: 31,
    menorPreco: 100,
    categorias: [],
    tom: 0,
  }
  /*
    Era a Dark Lab, até o #233 trazer o arquivo dela.

    O teste falhou na hora, e estava certo: o exemplo de "marca sem logo" tinha
    virado marca com logo, e o caminho do fallback deixou de ser exercido.
    Black Skull é a mesma escolha da fixture de ponta a ponta — marca real, do
    mesmo catálogo, cujo arquivo não temos.
  */
  const semLogo: Marca = { nome: 'Black Skull', slug: 'black-skull', produtos: 1, ofertas: 2, menorPreco: 100, categorias: [], tom: 0 }

  /*
    O elemento devolvido basta, como no caso do estado vazio: `type` e `props`
    dizem qual dos dois caminhos correu, sem precisar de DOM.

    O par não é decorativo. As duas marcas são reais e estão no mesmo catálogo:
    a Growth tem logo no manifesto, a Black Skull não. Se o fallback sumisse,
    só o segundo caso acusaria — e é justamente ele que a home vai exercer
    sozinha quando a próxima coleta mudar o ranking das cinco.
  */

  it('marca com logo vira imagem, com o nome no texto alternativo', () => {
    const elemento = ConteudoDoCartao({ marca: comLogo })
    expect(elemento.props).toMatchObject({
      alt: 'Growth Supplements',
      src: '/marcas/growth-supplements.png',
    })
  })

  it('marca sem logo mostra o nome escrito, e não um cartão vazio', () => {
    const elemento = ConteudoDoCartao({ marca: semLogo })
    expect(elemento.props.children).toBe('Black Skull')
  })

  it('a marca recortada é limitada à altura do tamanho', () => {
    // Sem o teto, um arquivo de 180px de altura entraria com 180px na faixa e
    // empurraria o cartão de 72px.
    expect(ConteudoDoCartao({ marca: comLogo }).props.style.maxHeight).toBe('36px')
    expect(ConteudoDoCartao({ marca: comLogo, tamanho: 'painel' }).props.style.maxHeight).toBe(
      '84px',
    )
  })

  it('o azulejo cobre a caixa, nos dois tamanhos', () => {
    /*
      A Integralmédica é azulejo desde o #241: arquivo 1:1, com o vermelho da
      marca como fundo. Contido numa caixa de 36px de altura ele sairia com
      36px de largura — um quadradinho ilegível, que foi o que a faixa da home
      mostrou antes de o preenchimento valer para os dois tamanhos.
    */
    const integral: Marca = {
      nome: 'Integralmédica',
      slug: 'integralmedica',
      produtos: 3,
      ofertas: 12,
      menorPreco: 100,
      categorias: [],
      tom: 0,
    }

    for (const tamanho of ['faixa', 'painel'] as const) {
      const elemento = ConteudoDoCartao({ marca: integral, tamanho })
      expect(elemento.props.className, `${tamanho} não cobre a caixa`).toContain('object-cover')
      expect(elemento.props.style, `${tamanho} ainda limita a altura`).toBeUndefined()
    }
  })
})

describe('fundo do cartão da faixa', () => {
  /**
   * Percorre a árvore devolvida e junta todo `className` que for string.
   *
   * Sem DOM, como o resto desta suíte: o que se quer saber é qual classe o
   * componente montou, e isso está no elemento antes de qualquer render.
   */
  function classes(no: unknown, achadas: string[] = []): string[] {
    if (Array.isArray(no)) {
      for (const filho of no) classes(filho, achadas)
      return achadas
    }
    if (!no || typeof no !== 'object') return achadas
    const props = (no as { props?: Record<string, unknown> }).props
    if (!props) return achadas
    if (typeof props.className === 'string') achadas.push(props.className)
    classes(props.children, achadas)
    return achadas
  }

  function cartoes(marcas: Marca[]): string[] {
    return classes(FaixaDeMarcas({ marcas })).filter(c => c.includes('h-[72px]'))
  }

  it('a marca de logo escuro recebe painel escuro, e as outras o claro', () => {
    /*
      As duas na mesma faixa, de propósito.

      Com uma marca só, `fundoDoLogo` trocado por uma classe fixa passaria: o
      teste veria a única classe que sobrou e concordaria. O par é o que exige
      que o fundo venha da marca, e não do componente.
    */
    const growth: Marca = { nome: 'Growth Supplements', slug: 'growth-supplements', produtos: 4, ofertas: 9, menorPreco: 100, categorias: [], tom: 0 }
    const darkLab: Marca = { nome: 'Dark Lab', slug: 'dark-lab', produtos: 1, ofertas: 3, menorPreco: 49.9, categorias: [], tom: 0 }

    const [oGrowth, aDarkLab] = cartoes([growth, darkLab])

    expect(oGrowth).toContain('bg-surface-muted')
    expect(aDarkLab).toContain('bg-surface-dark')
    // E o claro não é o escuro por prefixo: `bg-surface-dark` contém
    // `bg-surface-dark`, mas `bg-surface-muted` não pode conter nenhum dos dois.
    expect(oGrowth).not.toContain('bg-surface-dark')
  })

  it('o azulejo tira o respiro do cartão, e a marca recortada mantém', () => {
    /*
      O respiro é o que separa os dois estados na faixa: azulejo encosta na
      borda, marca recortada respira. Sem este teste, apagar o `px-4` passa
      despercebido — o cartão continua do mesmo tamanho e só as marcas
      recortadas ficam coladas na borda.
    */
    const growth: Marca = { nome: 'Growth Supplements', slug: 'growth-supplements', produtos: 4, ofertas: 9, menorPreco: 100, categorias: [], tom: 0 }
    const integral: Marca = { nome: 'Integralmédica', slug: 'integralmedica', produtos: 2, ofertas: 649, menorPreco: 36, categorias: [], tom: 0 }

    const [oGrowth, aIntegral] = cartoes([growth, integral])

    const classes = (c: string) => c.split(/\s+/).filter(Boolean).sort()

    expect(classes(oGrowth), 'marca recortada perdeu o respiro').toContain('px-4')

    /*
      Comparado por diferença, e não por ausência.

      "não contém px-4" deixa passar qualquer coisa no lugar: o Stryker troca a
      string vazia do ramo do azulejo por lixo e o teste continua verde, porque
      lixo também não é `px-4`. O que se afirma é que os dois cartões são a
      mesma lista de classes, a menos do respiro.
    */
    expect(classes(aIntegral)).toEqual(classes(oGrowth).filter(c => c !== 'px-4'))
  })

  it('o cartão continua com a altura e o alvo de toque da faixa', () => {
    // O `className` inteiro é uma expressão montada agora que o fundo varia:
    // apagá-la levaria junto a altura fixa e o foco visível, sem erro nenhum.
    const [cartao] = cartoes([
      { nome: 'Growth Supplements', slug: 'growth-supplements', produtos: 4, ofertas: 9, menorPreco: 100, categorias: [], tom: 0 },
    ])

    expect(cartao).toContain('h-[72px]')
    expect(cartao).toContain('rounded-xl')
    expect(cartao).toContain('focus-visible:outline-brand')
  })
})
