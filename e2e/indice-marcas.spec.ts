import { expect, test } from '@playwright/test'

/**
 * O índice `/marcas`, no HTML servido.
 *
 * Cobre o que a leitura do fonte não alcança: que as contagens da página
 * conferem com as da faixa da home, que cada marca leva a uma listagem que
 * responde, e que a regra de indexação chega ao `<head>` de verdade.
 */

test.describe('rota /marcas', () => {
  test('existe e lista as marcas com as contagens', async ({ page }) => {
    await page.goto('/marcas')

    await expect(page.getByRole('heading', { level: 1, name: /marcas acompanhadas/i })).toBeVisible()

    const itens = page.getByRole('main').getByRole('listitem')
    const total = await itens.count()
    expect(total, 'índice sem marca nenhuma').toBeGreaterThan(0)

    // Toda linha declara produtos e ofertas, com o singular/plural certo.
    for (let i = 0; i < total; i++) {
      await expect(itens.nth(i)).toContainText(/\d+ produtos?/)
      await expect(itens.nth(i)).toContainText(/\d+ ofertas? ativas?/)
    }
  })

  test('não é indexável enquanto é só uma lista', async ({ page }) => {
    await page.goto('/marcas')
    const robots = page.locator('head meta[name="robots"]')
    // `noindex` porque a página não tem conteúdo próprio além do que já existe
    // em /produtos; `follow` porque os links daqui devem ser rastreados.
    await expect(robots).toHaveAttribute('content', /noindex/)
    await expect(robots).toHaveAttribute('content', /follow/)
  })

  test('o canonical aponta para a própria rota', async ({ page }) => {
    await page.goto('/marcas')
    const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href')
    expect(canonical).toMatch(/\/marcas$/)
  })

  test('nenhuma marca produz link quebrado', async ({ page, request }) => {
    await page.goto('/marcas')
    const links = page.getByRole('main').getByRole('listitem').locator('a')

    for (let i = 0; i < (await links.count()); i++) {
      const href = await links.nth(i).getAttribute('href')
      expect(href, 'linha sem destino').toMatch(/^\/produtos\?marca=/)
      const resposta = await request.get(href!)
      expect(resposta.status(), `${href} não responde 200`).toBe(200)
    }
  })

  test('o filtro leva à listagem daquela marca, com resultado', async ({ page }) => {
    await page.goto('/marcas')
    const linha = page.getByRole('main').getByRole('listitem').first()
    const nome = (await linha.locator('a > span > span').first().textContent())!.trim()
    const primeiro = linha.locator('a')
    const href = await primeiro.getAttribute('href')
    const slug = new URL(href!, 'http://x').searchParams.get('marca')
    expect(slug, 'href sem slug de marca').toBeTruthy()

    await primeiro.click()
    await expect(page).toHaveURL(/\/produtos\?marca=/)
    /*
      O que confirma o filtro é o chip, não o campo de busca.

      Até o #220 o link era `?q=<nome da marca>` e o termo voltava no
      `searchbox`. Agora é filtro de verdade: o campo fica vazio e quem declara
      o recorte é o chip, com o nome como o banco o escreve.
    */
    await expect(page.getByText('Filtros ativos')).toBeVisible()
    /*
      Localiza o chip pelo nome acessível inteiro, não só pela marca.

      O nome da marca aparece em dois links da página: o chip e a opção no
      painel lateral. O `— remover filtro` é `sr-only` justamente para dar ao
      chip um nome acessível que diz o que ele faz, e é ele que desambigua.
    */
    await expect(
      page.getByRole('link', { name: new RegExp(`^${nome} .*remover filtro`, 'i') }),
    ).toBeVisible()
    // Marca listada aqui tem oferta ativa, então a listagem não pode voltar vazia.
    await expect(page.getByRole('main').getByRole('article').first()).toBeVisible()
  })

  test('as contagens conferem com a faixa da home', async ({ page }) => {
    /*
      As duas telas partem do mesmo `listarMarcas()`. Se divergirem, é porque
      alguém recalculou de um lado — que é exatamente o que o read model do
      #151 existe para evitar.
    */
    await page.goto('/marcas')
    const primeiraLinha = page.getByRole('main').getByRole('listitem').first()
    const nome = (await primeiraLinha.locator('a > span > span').first().innerText()).trim()
    const contagens = (await primeiraLinha.innerText()).match(/(\d+) produtos?[^\d]+(\d+) ofertas?/)

    await page.goto('/')
    /*
      Localiza pelo nome acessível, não pelo texto do cartão.

      Desde que a faixa passou a mostrar logo, o nome da marca não é mais texto
      na tela: ele está no `alt` da imagem. `hasText` não enxerga `alt` e
      encontraria zero cartões — em silêncio, porque `toHaveAccessibleName`
      falharia depois por outro motivo. O nome acessível do link é
      "<marca> — N produtos, M ofertas ativas" nos dois tipos de cartão.
    */
    const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const naFaixa = page
      .getByRole('region', { name: 'Marcas acompanhadas' })
      .getByRole('link', { name: new RegExp(`^${escapado}\\b`, 'i') })

    await expect(naFaixa).toHaveAccessibleName(
      new RegExp(`${contagens![1]} produtos?, ${contagens![2]} ofertas?`),
    )
  })
})

test.describe('navegação entre home e índice', () => {
  test('a faixa da home leva ao índice', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('region', { name: 'Marcas acompanhadas' })
      .getByRole('link', { name: /ver todas as marcas/i })
      .click()
    await expect(page).toHaveURL(/\/marcas$/)
  })
})

for (const [nome, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['celular', { width: 375, height: 800 }],
] as const) {
  test.describe(`índice em ${nome}`, () => {
    test.use({ viewport })

    test('não rola na horizontal e o primeiro item recebe foco', async ({ page }) => {
      await page.goto('/marcas')
      const estoura = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(estoura).toBe(false)

      const primeiro = page.getByRole('main').getByRole('listitem').locator('a').first()
      await primeiro.focus()
      await expect(primeiro).toBeFocused()
    })
  })
}
