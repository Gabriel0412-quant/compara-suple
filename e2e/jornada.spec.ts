import { expect, test } from '@playwright/test'
import { TOTAIS } from './fixture'

/**
 * Os três caminhos de entrada do #11, mais os estados que só aparecem em um
 * navegador de verdade. Cada teste faz o que uma pessoa faria: digita, clica,
 * e confere onde foi parar.
 */

test.describe('home → resultados de busca', () => {
  test('digitar e apertar Enter leva aos resultados, com o termo na URL', async ({ page }) => {
    await page.goto('/')

    const campo = page.getByRole('searchbox', { name: /buscar suplemento/i })
    await campo.fill('creatina')
    await campo.press('Enter')

    await expect(page).toHaveURL(/\/produtos\?q=creatina/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('creatina')
    await expect(page.locator('article')).toHaveCount(1)
    await expect(page.locator('article').first()).toContainText('Creatina Monohidratada')
  })

  test('clicar no botão faz a mesma coisa que o Enter', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('searchbox', { name: /buscar suplemento/i }).fill('whey')
    await page.getByRole('button', { name: /buscar preços/i }).click()

    await expect(page).toHaveURL(/\/produtos\?q=whey/)
    await expect(page.locator('article')).toHaveCount(2)
  })

  test('o termo volta no campo depois de navegar', async ({ page }) => {
    await page.goto('/produtos?q=creatina')
    await expect(page.getByRole('searchbox', { name: /buscar suplemento/i }))
      .toHaveValue('creatina')
  })

  test('busca sem resultado oferece um caminho de volta', async ({ page }) => {
    await page.goto('/produtos?q=bcaa')

    await expect(page.locator('article')).toHaveCount(0)
    await expect(page.getByText(/nenhum produto para/i)).toBeVisible()

    await page.getByRole('link', { name: /limpar busca/i }).click()
    await expect(page).toHaveURL(/\/produtos$/)
    await expect(page.locator('article')).toHaveCount(TOTAIS.produtosCompraveis)
  })

  test('acento e caixa não mudam o resultado', async ({ page }) => {
    await page.goto('/produtos?q=PROTEÍNA')
    const comAcento = await page.locator('article').count()
    await page.goto('/produtos?q=proteina')
    expect(await page.locator('article').count()).toBe(comAcento)
  })
})

test.describe('home → categoria', () => {
  test('todo atalho de categoria da home leva a uma página que existe', async ({ page }) => {
    await page.goto('/')
    const atalhos = page.locator('a[href^="/categoria/"]')
    const total = await atalhos.count()
    expect(total).toBeGreaterThan(0)

    // Regressão do #49: "Whey Isolado" virava /categoria/whey-isolado, que é 404.
    for (let i = 0; i < total; i++) {
      const href = await atalhos.nth(i).getAttribute('href')
      const resposta = await page.request.get(href!)
      expect(resposta.status(), `${href} devia responder 200`).toBe(200)
    }
  })

  test('clicar num atalho abre a categoria com produtos', async ({ page }) => {
    await page.goto('/')
    await page.locator('a[href="/categoria/creatina"]').first().click()
    await expect(page).toHaveURL(/\/categoria\/creatina/)
    await expect(page.locator('article').first()).toContainText('Creatina')
  })
})

test.describe('home → comparador', () => {
  test('o link do comparador abre o comparador vazio', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /abra o comparador/i }).click()
    await expect(page).toHaveURL(/\/comparar/)
    await expect(page.getByText(/escolha até 3 suplementos/i)).toBeVisible()
  })

  test('dá para montar uma comparação a partir do seletor', async ({ page }) => {
    await page.goto('/comparar')
    await page.locator('a[href*="ids="]').first().click()
    await expect(page).toHaveURL(/ids=\d+/)
    await expect(page.getByRole('heading', { name: /comparação/i })).toBeVisible()
  })
})

test.describe('listagem', () => {
  test('mostra só produto com oferta comprável', async ({ page }) => {
    await page.goto('/produtos')
    await expect(page.locator('article')).toHaveCount(TOTAIS.produtosCompraveis)
    // O "Blend Vegan" do fixture só tem oferta fora do ar.
    await expect(page.getByText('Blend Vegan')).toHaveCount(0)
  })

  test('produto sem doses nem peso diz que não sabe, em vez de omitir', async ({ page }) => {
    await page.goto('/produtos?q=insanity')
    await expect(page.locator('article')).toHaveCount(1)
    await expect(page.getByText(/sem dose ou peso informado/i)).toBeVisible()
  })

  test('nenhum link da home aponta para lugar nenhum', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href="#"]')).toHaveCount(0)
  })
})
