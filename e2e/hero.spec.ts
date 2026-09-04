import { expect, test } from '@playwright/test'

/**
 * O hero da home, verificado no que o visitante recebe.
 *
 * Os três números e a data de coleta são o ponto onde esta home já mentiu:
 * ela exibiu "1.482 produtos monitorados" e "R$4,2M economizados", valores
 * escritos à mão que nunca corresponderam ao banco. `lib/stats.ts` nasceu
 * disso, e estes testes existem para que a origem não se perca de novo.
 */

test.describe('os números do hero vêm do banco', () => {
  test('não são os valores da maquete escritos à mão', async ({ page }) => {
    await page.goto('/')
    const hero = page.getByRole('main')
    const texto = await hero.innerText()

    // A maquete 1b diz "967 ofertas de 21 produtos". Se esses números
    // aparecerem contra o stub, alguém copiou o desenho para dentro do código.
    expect(texto, 'número da maquete no lugar do dado do banco').not.toContain('967 ofertas')
    expect(texto, 'número da maquete no lugar do dado do banco').not.toContain('21 produtos')

    // E os do stub precisam estar lá, com origem.
    await expect(hero.getByText(/\d+ ofertas/).first()).toBeVisible()
    await expect(hero.getByText(/\d+ produtos/).first()).toBeVisible()
  })

  test('a última coleta traz a hora, e a hora tem formato de hora', async ({ page }) => {
    await page.goto('/')
    const texto = await page.getByRole('main').innerText()

    expect(texto).toMatch(/Última coleta (hoje|ontem|em \d{2}\/\d{2}) às \d{2}:\d{2}/)
  })

  test('os mesmos números não aparecem duas vezes na mesma dobra', async ({ page }) => {
    await page.goto('/')
    const texto = await page.getByRole('main').innerText()

    // A faixa de estatísticas repetia ofertas/produtos/coleta logo abaixo do
    // parágrafo do hero. Saiu no #123, e não deve voltar.
    expect(texto).not.toContain('ofertas comparadas')
    expect(texto).not.toContain('produtos monitorados')
  })
})

test.describe('a busca do hero', () => {
  test('leva o termo para a listagem', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('searchbox').first().fill('creatina')
    await page.getByRole('button', { name: /buscar preços/i }).first().click()

    await expect(page).toHaveURL(/\/produtos\?q=creatina/)
  })

  test('funciona sem JavaScript', async ({ browser }) => {
    // `<form method="get">` nativo, escolhido no #46 justamente por isso.
    const contexto = await browser.newContext({ javaScriptEnabled: false })
    const page = await contexto.newPage()
    await page.goto('/')

    await page.getByRole('searchbox').first().fill('whey')
    await page.getByRole('button', { name: /buscar preços/i }).first().click()
    await expect(page).toHaveURL(/\/produtos\?q=whey/)

    await contexto.close()
  })

  test('não se chama "Comparar", que já é outra coisa no site', async ({ page }) => {
    await page.goto('/')
    // A maquete rotula o botão como "Comparar", mas /comparar é outra página,
    // que põe produtos lado a lado. Dois controles com o mesmo nome levando a
    // destinos diferentes confundem mais do que a fidelidade ajuda.
    await expect(page.getByRole('button', { name: /^comparar$/i })).toHaveCount(0)
  })
})

test.describe('hero em tela estreita', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('cabe em 360px sem rolagem horizontal', async ({ page }) => {
    await page.goto('/')
    const estoura = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(estoura).toBe(false)
  })

  test('título, busca e chips continuam utilizáveis', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('searchbox').first()).toBeVisible()

    const botao = page.getByRole('button', { name: /buscar preços/i }).first()
    const caixa = await botao.boundingBox()
    expect(caixa!.height, 'alvo de toque menor que 44px').toBeGreaterThanOrEqual(44)

    await expect(page.getByRole('navigation', { name: /categorias em destaque/i })).toBeVisible()
  })
})
