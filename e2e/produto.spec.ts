import { expect, test } from '@playwright/test'

/**
 * A página de produto é a última tela antes de o visitante sair para a loja.
 * O que se cobre aqui é o que ela afirma na saída: para onde manda, o que
 * declara sobre a compra, e o que evita declarar sem ter o dado.
 */

const PRODUTO = '/produto/whey-concentrado-growth'

test.describe('saída para a loja', () => {
  test('o CTA diz para onde leva, e não sugere compra aqui', async ({ page }) => {
    await page.goto(PRODUTO)

    const cta = page.getByRole('link', { name: /ver oferta no mercado livre/i })
    await expect(cta).toBeVisible()
    // "Comprar agora" sugeria que o checkout acontece no ComparaSuple.
    await expect(page.getByRole('link', { name: /^comprar agora/i })).toHaveCount(0)
  })

  test('a saída passa pela rota de tracking e abre em nova aba', async ({ page }) => {
    await page.goto(PRODUTO)
    const cta = page.getByRole('link', { name: /ver oferta no mercado livre/i })
    await expect(cta).toHaveAttribute('href', /^\/go\/\d+$/)
    await expect(cta).toHaveAttribute('target', '_blank')
    await expect(cta).toHaveAttribute('rel', /noopener/)
    await expect(cta).toHaveAttribute('rel', /sponsored/)
  })

  test('a divulgação de afiliado é visível antes da saída', async ({ page }) => {
    await page.goto(PRODUTO)
    await expect(page.getByText(/ganhamos comissão se você comprar/i)).toBeVisible()
  })

  test('dá para chegar à saída pelo teclado', async ({ page }) => {
    await page.goto(PRODUTO)
    const cta = page.getByRole('link', { name: /ver oferta no mercado livre/i })
    await cta.focus()
    await expect(cta).toBeFocused()
  })
})

test.describe('não afirmar o que não se sabe', () => {
  test('não declara estoque', async ({ page }) => {
    // `offerToRow` devolvia "Em estoque" fixo, em verde, para toda oferta.
    await page.goto(PRODUTO)
    await expect(page.getByText(/em estoque/i)).toHaveCount(0)
  })

  test('não promete segurança da loja', async ({ page }) => {
    await page.goto(PRODUTO)
    await expect(page.getByText(/compra segura/i)).toHaveCount(0)
  })

  test('não afirma que o link é de afiliado', async ({ page }) => {
    // Enquanto o #54 não fecha, nenhuma URL coletada carrega tag de afiliado.
    await page.goto(PRODUTO)
    await expect(page.getByText(/✓ Link de afiliado/)).toHaveCount(0)
  })
})

test.describe('controles', () => {
  test('nenhum botão sem ação ao lado da saída', async ({ page }) => {
    await page.goto(PRODUTO)
    // Favoritar e avisar não tinham handler nem `disabled`: pareciam
    // funcionais e não eram. O que sobrou é honesto — desabilitado e rotulado.
    const botoes = page.locator('main button, article button')
    const total = await botoes.count()
    for (let i = 0; i < total; i++) {
      const b = botoes.nth(i)
      const desabilitado = await b.isDisabled()
      const rotulo = ((await b.textContent()) ?? '').trim()
      expect(
        desabilitado || rotulo.length > 0,
        'botão sem rótulo e sem disabled é controle morto',
      ).toBe(true)
    }
  })

  test('o aviso de preço continua marcado como indisponível', async ({ page }) => {
    await page.goto(PRODUTO)
    const aviso = page.getByRole('button', { name: /avisar quando baixar/i })
    await expect(aviso).toBeDisabled()
  })
})

test.describe('produto sem oferta', () => {
  test('não finge que há o que comprar', async ({ page }) => {
    // O produto 4 do fixture só tem oferta fora do ar.
    await page.goto('/produto/blend-vegan-fora-do-ar')
    await expect(page.getByText(/sem ofertas disponíveis/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /ver oferta no mercado livre/i })).toHaveCount(0)
  })
})
