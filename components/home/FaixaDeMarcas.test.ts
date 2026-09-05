import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import FaixaDeMarcas, { descreverCorte } from './FaixaDeMarcas'
import type { Marca } from '@/lib/brands'
import { removerComentarios } from '@/lib/claims'

/**
 * A única regra desta tela que pode mentir.
 *
 * A faixa mostra as marcas com mais ofertas ativas, não todas — e o texto
 * precisa dizer isso, senão o recorte parece arbitrário. Mas o texto também
 * não pode afirmar uma seleção que não houve: com três marcas no catálogo e
 * limite de cinco, dizer "as 5 com mais ofertas ativas" inventa um corte.
 *
 * A renderização em si é verificada em `e2e/marcas.spec.ts`, contra o HTML
 * servido — mesma divisão de `claims.test.ts` e `confianca.spec.ts`.
 */

describe('texto do recorte', () => {
  it('nomeia o critério quando de fato houve corte', () => {
    expect(descreverCorte(12, 5)).toBe('as 5 com mais ofertas ativas')
  })

  it('não afirma corte quando mostra todas', () => {
    expect(descreverCorte(3, 3)).toBe('todas as que têm oferta ativa')
  })

  it('não diz "todas" no plural quando só existe uma', () => {
    expect(descreverCorte(1, 1)).toBe('a única com oferta ativa')
  })

  it('nunca promete mais do que exibe', () => {
    // Varre o intervalo inteiro: nenhum texto pode citar um número maior que
    // o de cartões efetivamente na tela.
    for (let total = 1; total <= 12; total++) {
      for (let exibidas = 1; exibidas <= total; exibidas++) {
        const texto = descreverCorte(total, exibidas)
        const citado = texto.match(/\d+/)?.[0]
        if (citado) expect(Number(citado)).toBeLessThanOrEqual(exibidas)
      }
    }
  })
})

describe('estado vazio', () => {
  /*
    Um server component é uma função. Para saber se a seção some quando não há
    marca, basta o valor de retorno — não é preciso DOM nem renderizador, o que
    manteria a suíte unitária sem jsdom só por causa deste caso.
  */
  it('sem marca, a seção inteira não existe', () => {
    expect(FaixaDeMarcas({ marcas: [], total: 0 })).toBeNull()
  })

  it('com marca, a seção existe', () => {
    const marca: Marca = { nome: 'Growth', slug: 'growth', produtos: 2, ofertas: 7, tom: 0 }
    expect(FaixaDeMarcas({ marcas: [marca], total: 1 })).not.toBeNull()
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
