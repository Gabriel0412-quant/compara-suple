import { expect, test } from '@playwright/test'

/**
 * Header e rodapé, verificados no HTML que o visitante recebe.
 *
 * Existe porque as duas falhas que este trabalho corrigiu eram invisíveis para
 * a leitura do fonte: o rodapé só existia na home, e portanto sete páginas
 * públicas nunca mostravam a divulgação de afiliado; e o nome antigo aparecia
 * na tela partido entre dois `<span>`, o que fez o teste do #119 passar
 * enquanto todas as páginas ainda diziam ComparaSuple.
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

test.describe('a marca aparece em toda página', () => {
  for (const [nome, url] of TELAS) {
    test(`${nome} tem header e rodapé`, async ({ page }) => {
      await page.goto(url)

      await expect(page.getByRole('banner')).toBeVisible()
      await expect(page.getByRole('contentinfo')).toBeVisible()

      // O nome, colado, para pegar a forma partida em elementos.
      const texto = (await page.locator('body').innerText()).replace(/\s+/g, '')
      expect(texto, 'a marca não aparece na página').toContain('PreçoSuplemento')
      expect(texto, 'o nome antigo voltou').not.toMatch(/comparasuple/i)
    })

    test(`${nome} mostra a divulgação de afiliado no rodapé`, async ({ page }) => {
      await page.goto(url)
      await expect(
        page.getByRole('contentinfo').getByText(/links são de afiliados/i),
      ).toBeVisible()
    })
  }
})

test.describe('nenhum destino inventado', () => {
  test('todo link do header e do rodapé leva a uma rota que existe', async ({ page, request }) => {
    await page.goto('/')

    const hrefs = new Set<string>()
    for (const regiao of ['banner', 'contentinfo'] as const) {
      for (const href of await page.getByRole(regiao).locator('a[href]').evaluateAll(
        (as) => as.map((a) => a.getAttribute('href') ?? ''),
      )) {
        hrefs.add(href)
      }
    }

    expect(hrefs.size, 'header e rodapé sem link nenhum').toBeGreaterThan(5)
    // "#" era o padrão dos links institucionais removidos. Não pode voltar.
    expect([...hrefs].filter((h) => h === '#' || h === '')).toEqual([])

    for (const href of hrefs) {
      const resposta = await request.get(href)
      expect(resposta.status(), `${href} não responde 200`).toBe(200)
    }
  })

  /*
    Este teste queria comparar o menu com `listCategories()`, mas importar
    `lib/categories` aqui derruba a suíte: ele importa `lib/db`, que constrói o
    cliente Supabase na carga do módulo, e o processo do Playwright não tem as
    variáveis de ambiente do app.

    É uma acoplagem que não deveria existir — a lista de categorias é constante
    literal e não precisa do banco para nada. Enquanto ela não for separada, a
    verificação de que cada destino existe fica por conta do teste acima, que
    bate 200 em todos.
  */
  test('o menu oferece as categorias do catálogo, e todas resolvem', async ({ page }) => {
    await page.goto('/')
    const slugs = await page.getByRole('banner').locator('a[href^="/categoria/"]').evaluateAll(
      (as) => as.map((a) => (a.getAttribute('href') ?? '').replace('/categoria/', '')),
    )
    const unicos = new Set(slugs.filter(Boolean))
    expect(unicos.size, 'o menu deveria listar as categorias do catálogo').toBeGreaterThanOrEqual(8)
  })
})

test.describe('nada que finja ser interativo', () => {
  test('nenhum botão sem ação no header ou no rodapé', async ({ page }) => {
    await page.goto('/')

    for (const regiao of ['banner', 'contentinfo'] as const) {
      const botoes = page.getByRole(regiao).locator('button')
      for (let i = 0; i < (await botoes.count()); i++) {
        const rotulo = (await botoes.nth(i).innerText()).trim()
        throw new Error(
          `Botão "${rotulo}" no ${regiao} sem destino. ` +
            'O header antigo tinha "Entrar" sem login e um campo de busca sem form. ' +
            'Controle que não faz nada sai — volta com o serviço que promete.',
        )
      }
    }
  })

  test('não há campo de busca morto no header', async ({ page }) => {
    await page.goto('/')
    // A busca de verdade é o CampoBusca da home, dentro de um <form>.
    const camposNoHeader = page.getByRole('banner').locator('input')
    await expect(camposNoHeader).toHaveCount(0)
  })
})

test.describe('teclado e telas estreitas', () => {
  test('dá para chegar à navegação pelo teclado, com foco visível', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')

    const focado = page.locator(':focus')
    await expect(focado).toBeVisible()
    await expect(focado).toHaveAttribute('href', '/')

    const contorno = await focado.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(contorno, 'foco sem contorno visível sobre o fundo escuro').not.toBe('none')
  })

  test('em tela estreita a navegação larga some e o menu aparece', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')

    const header = page.getByRole('banner')
    await expect(header.getByRole('link', { name: 'Ofertas' })).toBeHidden()
    await expect(header.getByText('Menu')).toBeVisible()
  })

  test('o menu estreito abre sem JavaScript', async ({ browser }) => {
    // `<details>` foi escolhido justamente por isso: se o script falhar, a
    // navegação continua funcionando.
    const contexto = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } })
    const page = await contexto.newPage()
    await page.goto('/')

    const menu = page.getByRole('banner').locator('details')
    await expect(menu.getByRole('link', { name: 'Comparador' })).toBeHidden()
    await menu.getByText('Menu').click()
    await expect(menu.getByRole('link', { name: 'Comparador' })).toBeVisible()

    await contexto.close()
  })

  test('a home não rola na horizontal em 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/')
    const estoura = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(estoura, 'o documento rola na horizontal').toBe(false)
  })
})
