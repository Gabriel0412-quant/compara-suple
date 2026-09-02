import { expect, test } from '@playwright/test'

/**
 * Os casos do comparador que só um navegador confirma de ponta a ponta, e que
 * foram bugs reais: id repetido virando três colunas (#50), produto sem oferta
 * ocupando slot (#51) e coluna espremida em tela estreita (#50).
 */

test.describe('seleção pela URL', () => {
  test('id repetido não vira várias colunas', async ({ page }) => {
    await page.goto('/comparar?ids=1,1,1')
    await expect(page.getByRole('heading', { name: /comparação/i })).toContainText('(1)')
  })

  test('o teto de 3 é contado depois de remover repetição', async ({ page }) => {
    await page.goto('/comparar?ids=1,1,1,2,3')
    await expect(page.getByRole('heading', { name: /comparação/i })).toContainText('(3)')
  })

  test('id inexistente ou inválido não quebra a página', async ({ page }) => {
    for (const ids of ['999999', 'abc,-1,0']) {
      await page.goto(`/comparar?ids=${ids}`)
      await expect(page.getByText(/escolha até 3 suplementos/i)).toBeVisible()
    }
  })

  test('a URL restaura a comparação depois de recarregar', async ({ page }) => {
    await page.goto('/comparar?ids=1,2&selected=2')
    await expect(page.getByRole('heading', { name: /comparação/i })).toContainText('(2)')
    await page.reload()
    await expect(page.getByRole('heading', { name: /comparação/i })).toContainText('(2)')
  })
})

test.describe('produto sem oferta comprável', () => {
  test('não ocupa slot e a página explica que saiu', async ({ page }) => {
    // O produto 4 do fixture só tem oferta fora do ar.
    await page.goto('/comparar?ids=1,4')
    await expect(page.getByRole('heading', { name: /comparação/i })).toContainText('(1)')
    await expect(page.getByRole('status')).toContainText(/não ter nenhuma oferta disponível/i)
  })

  test('quando todos saem, cai no estado vazio com aviso', async ({ page }) => {
    await page.goto('/comparar?ids=4')
    await expect(page.getByText(/escolha até 3 suplementos/i)).toBeVisible()
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('comparação sadia não mostra aviso nenhum', async ({ page }) => {
    await page.goto('/comparar?ids=1,2,3')
    await expect(page.getByRole('heading', { name: /comparação/i })).toContainText('(3)')
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('o seletor não oferece produto sem oferta', async ({ page }) => {
    await page.goto('/comparar')
    await expect(page.getByText('Blend Vegan')).toHaveCount(0)
  })
})

test.describe('destaques por critério', () => {
  test('um produto sozinho não ganha destaque nenhum', async ({ page }) => {
    // Antes do #50 ele levava seis troféus, por ser o mínimo de si mesmo.
    await page.goto('/comparar?ids=1')
    await expect(page.getByText(/^menor preço$/)).toHaveCount(0)
    await expect(page.getByText(/^menor R\$\/dose$/)).toHaveCount(0)
  })

  test('com dois produtos o destaque aparece e diz de qual critério é', async ({ page }) => {
    await page.goto('/comparar?ids=1,3')
    await expect(page.getByText('menor preço').first()).toBeVisible()
  })
})

test.describe('tela estreita', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('em 320px a comparação empilha e não rola na horizontal', async ({ page }) => {
    await page.goto('/comparar?ids=1,2,3')

    const rolaNaHorizontal = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(rolaNaHorizontal, 'a página não deveria rolar na horizontal').toBe(false)
  })

  test('em 320px a busca da home continua utilizável', async ({ page }) => {
    await page.goto('/')
    const campo = page.getByRole('searchbox', { name: /buscar suplemento/i })
    await expect(campo).toBeVisible()
    await campo.fill('whey')
    await campo.press('Enter')
    await expect(page).toHaveURL(/\/produtos\?q=whey/)

    const rolaNaHorizontal = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(rolaNaHorizontal).toBe(false)
  })
})

test.describe('teclado', () => {
  test('dá para buscar sem tocar no mouse', async ({ page }) => {
    await page.goto('/')
    const campo = page.getByRole('searchbox', { name: /buscar suplemento/i })
    await campo.focus()
    await expect(campo).toBeFocused()
    await page.keyboard.type('creatina')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /buscar preços/i })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/produtos\?q=creatina/)
  })
})
