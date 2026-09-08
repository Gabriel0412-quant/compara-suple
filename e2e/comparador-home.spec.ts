import { expect, test } from '@playwright/test'

/**
 * O bloco comparador da home, no HTML servido.
 *
 * O que se cobre aqui e não no vitest: que o selo corresponde à métrica
 * exibida, que o CTA leva os três ids certos, e que o critério da seleção
 * está escrito na tela.
 */

const BLOCO = 'Mesma categoria, preço por dose diferente'

test.describe('o bloco comparador', () => {
  test('mostra três produtos com as três métricas', async ({ page }) => {
    await page.goto('/')
    const secao = page.getByRole('region', { name: BLOCO })
    await expect(secao).toBeVisible()

    const cartoes = secao.getByRole('listitem')
    await expect(cartoes).toHaveCount(3)

    for (let i = 0; i < 3; i++) {
      await expect(cartoes.nth(i)).toContainText('Por dose')
      await expect(cartoes.nth(i)).toContainText('Por quilo')
      // "Ofertas", não "Lojas": conta anúncios do mesmo marketplace.
      await expect(cartoes.nth(i)).toContainText('Ofertas')
      await expect(cartoes.nth(i)).not.toContainText(/\bLojas\b/)
    }
  })

  test('declara o critério da seleção', async ({ page }) => {
    await page.goto('/')
    // Seleção que o leitor não entende parece favorecimento.
    await expect(page.getByRole('region', { name: BLOCO })).toContainText(
      /com mais ofertas ativas/i,
    )
  })

  test('o selo vai para quem tem o menor R$/kg exibido', async ({ page }) => {
    await page.goto('/')
    const cartoes = page.getByRole('region', { name: BLOCO }).getByRole('listitem')

    const porKg: (number | null)[] = []
    for (let i = 0; i < 3; i++) {
      const texto = await cartoes.nth(i).innerText()
      const m = texto.match(/Por quilo\s*\n?\s*R\$\s*([\d.]+),(\d{2})/)
      porKg.push(m ? Number(`${m[1].replace(/\./g, '')}.${m[2]}`) : null)
    }

    const comSelo: number[] = []
    for (let i = 0; i < 3; i++) {
      if ((await cartoes.nth(i).getByText(/melhor r\$\/kg/i).count()) > 0) comSelo.push(i)
    }

    const validos = porKg.filter((v): v is number => v !== null)
    const menor = Math.min(...validos)
    const empateGeral = validos.length === 3 && validos.every(v => v === menor)

    if (empateGeral || validos.length < 2) {
      // Vencer sozinho não é comparar, e empate geral não tem vencedor.
      expect(comSelo, 'selo em situação sem vencedor legítimo').toEqual([])
    } else {
      expect(comSelo.length, 'nenhum selo com vencedor disponível').toBeGreaterThan(0)
      for (const i of comSelo) {
        expect(porKg[i], `selo no cartão ${i}, que não tem o menor R$/kg`).toBe(menor)
      }
    }
  })

  test('o CTA abre o comparador com os três pré-selecionados', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByRole('region', { name: BLOCO }).getByRole('link', {
      name: /abrir comparador/i,
    })
    const href = await cta.getAttribute('href')
    const ids = new URL(href!, 'http://x').searchParams.get('ids')!.split(',')
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size, 'ids repetidos na URL do comparador').toBe(3)

    await cta.click()
    await expect(page).toHaveURL(/\/comparar\?ids=/)
    // Os três chegam ao comparador como colunas, não como seletor vazio.
    await expect(page.getByRole('heading', { name: /comparação/i })).toBeVisible()
  })

  test('é navegável por teclado', async ({ page }) => {
    await page.goto('/')
    const secao = page.getByRole('region', { name: BLOCO })
    const links = secao.getByRole('link')

    for (let i = 0; i < (await links.count()); i++) {
      await links.nth(i).focus()
      await expect(links.nth(i)).toBeFocused()
      const contorno = await links.nth(i).evaluate(el => getComputedStyle(el).outlineStyle)
      expect(contorno).not.toBe('none')
    }
  })

  test('as métricas usam monoespaçada, para comparar coluna com coluna', async ({ page }) => {
    await page.goto('/')
    const valor = page
      .getByRole('region', { name: BLOCO })
      .getByRole('listitem')
      .first()
      .locator('dd')
      .first()
    expect(await valor.evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/plex mono/i)
  })
})
