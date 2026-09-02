import { expect, test } from '@playwright/test'
import { CLAIMS_PROIBIDOS } from '../lib/claims'

/**
 * A auditoria de claims no vitest lê o código-fonte. Esta lê o que o visitante
 * de fato recebe — é a prova que fecha a questão, porque texto pode chegar à
 * tela por caminho que a leitura do fonte não alcança: dado do banco,
 * interpolação, biblioteca.
 */

const TELAS = [
  ['home', '/'],
  ['lista', '/produtos'],
  ['busca', '/produtos?q=whey'],
  ['categoria', '/categoria/whey-protein'],
  ['ofertas', '/ofertas'],
  ['comparador', '/comparar?ids=1,2'],
  ['produto', '/produto/whey-concentrado-growth'],
] as const

test.describe('nenhuma tela pública faz claim proibido', () => {
  for (const [nome, url] of TELAS) {
    test(`${nome} está limpa`, async ({ page }) => {
      await page.goto(url)
      const visivel = await page.locator('body').innerText()

      const achados = CLAIMS_PROIBIDOS
        .filter(c => c.padrao.test(visivel))
        .map(c => `"${visivel.match(c.padrao)?.[0]}" — ${c.porque}`)

      expect(achados, achados.join('\n')).toEqual([])
    })
  }
})

test.describe('metodologia', () => {
  for (const [nome, url] of [
    ['lista', '/produtos'],
    ['comparador', '/comparar?ids=1,2'],
    ['produto', '/produto/whey-concentrado-growth'],
  ] as const) {
    test(`${nome} oferece o resumo "Como comparamos"`, async ({ page }) => {
      await page.goto(url)
      await expect(page.locator('summary#como-comparamos')).toBeVisible()
    })
  }

  test('o resumo distingue menor preço de destaque', async ({ page }) => {
    await page.goto('/produtos')
    await page.locator('summary#como-comparamos').click()
    await expect(page.getByText(/nem sempre é a mais barata/i)).toBeVisible()
  })

  test('o resumo diz que não avalia eficácia nem segurança', async ({ page }) => {
    await page.goto('/produtos')
    await page.locator('summary#como-comparamos').click()
    await expect(page.getByText(/não avaliamos eficácia/i)).toBeVisible()
  })

  test('o resumo declara a comissão de afiliado', async ({ page }) => {
    await page.goto('/produtos')
    await page.locator('summary#como-comparamos').click()
    await expect(page.getByText(/ganhamos comissão/i)).toBeVisible()
  })

  test('com coleta recente não há aviso de desatualização', async ({ page }) => {
    // O fixture carimba as ofertas com a data de hoje.
    await page.goto('/produtos')
    await expect(page.getByText(/preços podem estar desatualizados/i)).toHaveCount(0)
  })
})
