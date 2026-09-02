import { expect, test } from '@playwright/test'
import { TOTAIS } from './fixture'

/**
 * A malha de links: o que o Google percorre e o que permite subir um nível.
 *
 * O teste central rastreia o site a partir da home, só por `<a href>`, e exige
 * que todo produto comprável seja alcançável sem passar pela busca interna.
 * Hoje passa; o valor está em impedir que pare de passar.
 */

/** Rastreia a partir de `/`, seguindo apenas links internos de navegação. */
async function rastrear(page: import('@playwright/test').Page) {
  const visitadas = new Set<string>()
  const produtos = new Set<string>()
  const fila = ['/']

  while (fila.length > 0 && visitadas.size < 40) {
    const url = fila.shift()!
    if (visitadas.has(url)) continue
    visitadas.add(url)

    await page.goto(url)
    const hrefs = await page.locator('a[href^="/"]').evaluateAll(as =>
      as.map(a => a.getAttribute('href') ?? ''),
    )

    for (const bruto of hrefs) {
      const href = bruto.split('#')[0]
      if (!href) continue
      if (href.startsWith('/produto/')) {
        produtos.add(href)
        continue
      }
      // Só navegação: busca interna e seleções do comparador não contam como
      // caminho de descoberta — é justamente o que o critério exclui.
      const navegavel =
        href === '/' ||
        href === '/produtos' ||
        href === '/ofertas' ||
        href.startsWith('/categoria/')
      if (navegavel && !visitadas.has(href)) fila.push(href)
    }
  }

  return { visitadas, produtos }
}

test.describe('descoberta por links', () => {
  test('todo produto comprável é alcançável a partir da home', async ({ page }) => {
    test.slow()
    const { produtos } = await rastrear(page)
    expect(
      produtos.size,
      'produto que só aparece na busca interna é órfão para quem navega e para quem rastreia',
    ).toBe(TOTAIS.produtosCompraveis)
  })

  test('produto sem oferta não entra na malha', async ({ page }) => {
    test.slow()
    const { produtos } = await rastrear(page)
    expect([...produtos].some(u => u.includes('blend-vegan-fora-do-ar'))).toBe(false)
  })
})

test.describe('trilha de navegação', () => {
  for (const [nome, url] of [
    ['lista', '/produtos'],
    ['ofertas', '/ofertas'],
    ['categoria', '/categoria/whey-protein'],
    ['comparador', '/comparar'],
    ['produto', '/produto/whey-concentrado-growth'],
  ] as const) {
    test(`${nome} tem trilha rotulada`, async ({ page }) => {
      await page.goto(url)
      await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible()
    })
  }

  test('a trilha do produto passa pela categoria', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    const trilha = page.getByRole('navigation', { name: /breadcrumb/i })
    await expect(trilha.getByRole('link', { name: 'Início' })).toBeVisible()
    await expect(trilha.getByRole('link', { name: /whey protein/i })).toBeVisible()
  })

  test('a categoria da trilha leva à listagem daquela categoria', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    await page.getByRole('navigation', { name: /breadcrumb/i })
      .getByRole('link', { name: /whey protein/i })
      .click()
    await expect(page).toHaveURL(/\/categoria\/whey-protein/)
  })
})

test.describe('do produto para a comparação', () => {
  test('o produto oferece comparar já entrando na seleção', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    await page.getByRole('link', { name: /comparar com outros/i }).click()
    await expect(page).toHaveURL(/\/comparar\?ids=\d+/)
    await expect(page.getByRole('heading', { name: /comparação/i })).toContainText('(1)')
  })

  test('o produto leva à sua categoria', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    await page.getByRole('link', { name: /ver todos de/i }).click()
    await expect(page).toHaveURL(/\/categoria\//)
  })
})

test.describe('regra de indexação', () => {
  test('seleção do comparador não é indexável', async ({ page }) => {
    await page.goto('/comparar?ids=1,2')
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', /noindex/)
  })

  test('a raiz do comparador continua indexável', async ({ page }) => {
    await page.goto('/comparar')
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('resultado de busca não é indexável', async ({ page }) => {
    await page.goto('/produtos?q=whey')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })

  test('a listagem sem busca continua indexável', async ({ page }) => {
    await page.goto('/produtos')
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })
})
