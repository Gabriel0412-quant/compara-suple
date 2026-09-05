import { expect, test } from '@playwright/test'

/**
 * A faixa de marcas, no HTML que o visitante recebe.
 *
 * O que se cobre aqui e não no vitest: que os cartões existem com o nome real,
 * que cada um leva a uma listagem que responde, e que nada na tela afirma
 * parceria com as marcas listadas.
 */

const FAIXA = 'Marcas acompanhadas'

test.describe('a faixa de marcas', () => {
  test('mostra cartões com nome real, e cada um leva a uma listagem que existe', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const secao = page.getByRole('region', { name: FAIXA })
    await expect(secao).toBeVisible()

    const cartoes = secao.getByRole('listitem').locator('a')
    const total = await cartoes.count()
    expect(total, 'faixa sem cartão nenhum').toBeGreaterThan(0)

    for (let i = 0; i < total; i++) {
      const href = await cartoes.nth(i).getAttribute('href')
      expect(href, 'cartão sem destino').toMatch(/^\/produtos\?q=/)

      /*
        O nome visível vem do primeiro `span`, não de `innerText()` do link.

        `innerText` traz duas coisas que atrapalham: aplica o
        `text-transform: uppercase` do CSS, devolvendo "GROWTH SUPPLEMENTS"
        onde o dado é "Growth Supplements"; e inclui o `sr-only` com as
        contagens, que é texto para leitor de tela, não rótulo do cartão.
      */
      const nome = (await cartoes.nth(i).locator('span').first().innerText()).trim()
      expect(nome.length, 'cartão sem nome visível').toBeGreaterThan(0)

      const resposta = await request.get(href!)
      expect(resposta.status(), `${href} não responde 200`).toBe(200)
    }
  })

  test('o cartão leva à listagem filtrada por aquela marca', async ({ page }) => {
    await page.goto('/')
    const primeiro = page.getByRole('region', { name: FAIXA }).getByRole('listitem').locator('a').first()
    // O nome esperado sai do próprio href, que é o contrato: o cartão promete
    // levar à listagem daquela marca, e o campo volta com o mesmo termo.
    const href = await primeiro.getAttribute('href')
    const termo = decodeURIComponent(new URL(href!, 'http://x').searchParams.get('q') ?? '')
    expect(termo, 'href sem termo de busca').not.toBe('')

    await primeiro.click()
    await expect(page).toHaveURL(/\/produtos\?q=/)
    // O termo volta preenchido no campo, que é o contrato do CampoBusca (#46).
    await expect(page.getByRole('searchbox').first()).toHaveValue(termo)
  })

  test('o recorte é explicado, e não promete mais do que mostra', async ({ page }) => {
    await page.goto('/')
    const secao = page.getByRole('region', { name: FAIXA })
    const texto = await secao.innerText()
    const cartoes = await secao.getByRole('listitem').count()

    expect(texto, 'a faixa não diz por que essas marcas').toMatch(
      /com mais ofertas ativas|todas as que têm oferta ativa|a única com oferta ativa/,
    )

    const citado = texto.match(/as (\d+) com mais ofertas/)?.[1]
    if (citado) expect(Number(citado)).toBeLessThanOrEqual(cartoes)
  })

  test('não afirma parceria nem uso de logotipo oficial', async ({ page }) => {
    await page.goto('/')
    const texto = await page.getByRole('region', { name: FAIXA }).innerText()

    for (const proibido of [/parceir/i, /oficial/i, /autorizad/i, /revended/i, /representante/i]) {
      expect(texto, `a faixa insinua vínculo com as marcas: ${proibido}`).not.toMatch(proibido)
    }
  })

  test('as contagens chegam a quem usa leitor de tela', async ({ page }) => {
    await page.goto('/')
    const primeiro = page.getByRole('region', { name: FAIXA }).getByRole('listitem').locator('a').first()
    // O cartão mostra só o nome; produtos e ofertas vão no nome acessível.
    await expect(primeiro).toHaveAccessibleName(/\d+ produtos?, \d+ ofertas? ativas?/)
  })
})

for (const [nome, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['celular', { width: 375, height: 800 }],
] as const) {
  test.describe(`faixa em ${nome}`, () => {
    test.use({ viewport })

    test('cartões visíveis e alcançáveis por teclado, com foco visível', async ({ page }) => {
      await page.goto('/')
      const primeiro = page
        .getByRole('region', { name: FAIXA })
        .getByRole('listitem')
        .locator('a')
        .first()

      await expect(primeiro).toBeVisible()
      await primeiro.focus()
      await expect(primeiro).toBeFocused()

      const contorno = await primeiro.evaluate(el => getComputedStyle(el).outlineStyle)
      expect(contorno, 'cartão sem contorno de foco').not.toBe('none')
    })

    test('a faixa não estoura a largura da página', async ({ page }) => {
      await page.goto('/')
      const estoura = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(estoura).toBe(false)
    })
  })
}
