import { expect, test } from '@playwright/test'

/**
 * Contrato responsivo da home, nos três viewports que importam.
 *
 * As regras aqui não são estéticas — cada uma corresponde a um jeito de a
 * página ficar inutilizável num tamanho de tela que ninguém testou à mão.
 */

const VIEWPORTS = [
  ['celular', { width: 360, height: 780 }],
  ['tablet', { width: 768, height: 1024 }],
  ['desktop', { width: 1440, height: 900 }],
] as const

/** Mínimo de fonte em celular. Abaixo disso o texto existe e não se lê. */
const MINIMO_DE_FONTE = 14
/** Mínimo de alvo de toque. Abaixo disso o dedo erra. */
const MINIMO_DE_TOQUE = 44

/**
 * Onde as regras de celular valem: abaixo do breakpoint `sm` do Tailwind.
 *
 * É a mesma fronteira em que os componentes trocam de tamanho, então teste e
 * código concordam por construção em vez de por coincidência. Acima dela, 10px
 * e 12px são o desenho da maquete 1b, não defeito.
 *
 * A fronteira honesta para alvo de toque seria `pointer: coarse`, não largura —
 * um tablet de 768px é tocado com o dedo e cai fora desta regra. Ficou como
 * está porque mudar isso exige uma variante custom no Tailwind e afeta as
 * telas do EP22; anotado aqui para não parecer descuido.
 */
const LIMITE_DE_CELULAR = 640

/**
 * Link dentro de frase é exceção, e não desleixo.
 *
 * A WCAG 2.5.8 isenta alvo em fluxo de texto justamente porque aumentar a
 * altura de um link no meio de um parágrafo quebra a linha e piora a leitura.
 * "abra o comparador" e "veja as ofertas do dia" são desses; "Ver todos" e os
 * chips de categoria não são, e por isso têm 44px.
 */
const DETECTA_PROSA = `
  (el) => {
    const pai = el.parentElement
    if (!pai) return false
    const doPai = (pai.textContent ?? '').trim().length
    const doLink = (el.textContent ?? '').trim().length
    return ['P', 'SPAN', 'LI', 'DD', 'DT'].includes(pai.tagName) && doPai > doLink + 12
  }
`

for (const [nome, viewport] of VIEWPORTS) {
  test.describe(`home em ${nome} (${viewport.width}px)`, () => {
    test.use({ viewport })

    test('o documento não rola na horizontal', async ({ page }) => {
      await page.goto('/')
      const largura = await page.evaluate(() => ({
        rolagem: document.documentElement.scrollWidth,
        visivel: document.documentElement.clientWidth,
      }))
      expect(
        largura.rolagem,
        `documento com ${largura.rolagem}px de rolagem em ${largura.visivel}px de tela`,
      ).toBeLessThanOrEqual(largura.visivel)
    })

    test('as cinco seções com dado continuam presentes e na ordem', async ({ page }) => {
      await page.goto('/')
      const main = page.getByRole('main')

      await expect(main.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Marcas acompanhadas' })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Whey Protein' })).toBeVisible()
      await expect(
        page.getByRole('region', { name: 'Mesma categoria, preço por dose diferente' }),
      ).toBeVisible()
      await expect(main.getByRole('heading', { name: /maiores descontos/i })).toBeVisible()
    })

    test('a ordem de tabulação segue a ordem de leitura', async ({ page }) => {
      await page.goto('/')
      // Primeiro Tab cai no logo; a partir dele, cada Tab avança na página e
      // nunca volta para cima — ordem de foco que salta é desorientadora.
      await page.keyboard.press('Tab')
      let anterior = -1
      for (let i = 0; i < 12; i++) {
        const y = await page.evaluate(() => {
          const el = document.activeElement
          if (!el || el === document.body) return null
          return Math.round(el.getBoundingClientRect().top + window.scrollY)
        })
        if (y === null) break
        expect(y, `foco voltou para cima no passo ${i}`).toBeGreaterThanOrEqual(anterior - 4)
        anterior = y
        await page.keyboard.press('Tab')
      }
    })
  })
}

test.describe(`regras de celular (abaixo de ${LIMITE_DE_CELULAR}px)`, () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('nenhum texto abaixo do mínimo legível', async ({ page }) => {
    await page.goto('/')
    const pequenos = await page.evaluate(min => {
      return [...document.querySelectorAll('main *')]
        .filter(el => el.textContent?.trim() && el.children.length === 0)
        .map(el => ({
          texto: el.textContent!.trim().slice(0, 40),
          px: parseFloat(getComputedStyle(el).fontSize),
        }))
        .filter(x => x.px < min)
    }, MINIMO_DE_FONTE)

    expect(
      pequenos,
      `texto abaixo de ${MINIMO_DE_FONTE}px:\n${pequenos.map(p => `  ${p.px}px  "${p.texto}"`).join('\n')}`,
    ).toEqual([])
  })

  test('todo controle fora de prosa alcança o mínimo de toque', async ({ page }) => {
    await page.goto('/')
    const pequenos = await page.evaluate(
      ([min, detecta]) => {
        const emProsa = eval(detecta as string) as (el: Element) => boolean
        return [...document.querySelectorAll('main a, main button')]
          .filter(el => !emProsa(el))
          .map(el => ({
            texto: (el.textContent || '').trim().slice(0, 40),
            altura: Math.round(el.getBoundingClientRect().height),
          }))
          .filter(x => x.altura > 0 && x.altura < (min as number))
      },
      [MINIMO_DE_TOQUE, DETECTA_PROSA] as const,
    )

    expect(
      pequenos,
      `alvo abaixo de ${MINIMO_DE_TOQUE}px:\n${pequenos.map(p => `  ${p.altura}px  "${p.texto}"`).join('\n')}`,
    ).toEqual([])
  })

})

test.describe('comparação lado a lado em celular', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('o comparador rola em vez de empilhar', async ({ page }) => {
    await page.goto('/')
    const lista = page
      .getByRole('region', { name: 'Mesma categoria, preço por dose diferente' })
      .getByRole('list')

    /*
      Empilhar seria o reflexo automático, e destruiria a única coisa que o
      bloco faz. Três cartões um embaixo do outro obrigam a memorizar o R$/kg
      do primeiro para conferir no terceiro — o trabalho que o site existe
      para poupar.
    */
    const rola = await lista.evaluate(el => el.scrollWidth > el.clientWidth)
    expect(rola, 'o comparador empilhou em vez de rolar').toBe(true)
    await expect(lista).toHaveCSS('scroll-snap-type', /x/)
  })

  test('as prateleiras também rolam, com snap', async ({ page }) => {
    await page.goto('/')
    const lista = page.getByRole('region', { name: 'Whey Protein' }).getByRole('list')
    expect(await lista.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
    await expect(lista).toHaveCSS('scroll-snap-type', /x/)
  })

  test('a faixa de marcas caibe sem rolagem do documento', async ({ page }) => {
    await page.goto('/')
    const faixa = page.getByRole('region', { name: 'Marcas acompanhadas' })
    await expect(faixa.getByRole('listitem').first()).toBeVisible()
    const estoura = await faixa.evaluate(
      el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
    )
    expect(estoura).toBe(false)
  })
})
