import { expect, test } from '@playwright/test'

/**
 * A página de busca com filtros (#220).
 *
 * O que se cobre aqui e não no vitest: que o estado da URL vira tela, que a
 * contagem da faceta é a mesma coisa que o clique entrega, e que o painel
 * funciona sem JavaScript — as três coisas que só existem renderizadas.
 */

const painel = (page: import('@playwright/test').Page) =>
  page.getByRole('complementary', { name: 'Filtros' })

const cards = (page: import('@playwright/test').Page) =>
  page.getByRole('main').getByRole('article')

const chip = (page: import('@playwright/test').Page, rotulo: string | RegExp) =>
  page.getByRole('link', {
    name: rotulo instanceof RegExp ? rotulo : new RegExp(`^${rotulo} .*remover filtro`, 'i'),
  })

test.describe('filtros da busca', () => {
  test('a contagem da faceta é o que o clique entrega', async ({ page }) => {
    await page.goto('/produtos')
    const opcao = painel(page).getByRole('listitem').locator('a').first()
    const rotulo = (await opcao.locator('span').first().textContent())!.trim()
    /*
      A promessa da faceta é um número, e o teste cobra esse número.

      Contar com o próprio filtro já aplicado — o erro clássico de faceta —
      produziria uma contagem que não bate com o resultado do clique. Aqui a
      asserção liga as duas pontas.
    */
    const n = Number((await opcao.locator('span').last().textContent())!.trim())
    expect(n, `faceta "${rotulo}" sem contagem`).toBeGreaterThan(0)

    await opcao.click()
    await expect(cards(page)).toHaveCount(n)
    await expect(chip(page, rotulo)).toBeVisible()
  })

  test('o filtro chega pela URL, sem passar pela tela', async ({ page }) => {
    // É o que faz o cartão de marca da home e o chip de categoria funcionarem:
    // um link comum, sem estado de componente.
    await page.goto('/produtos?categoria=whey-protein')
    await expect(chip(page, 'Whey Protein')).toBeVisible()
    expect(await cards(page).count()).toBeGreaterThan(0)
  })

  test('categoria desconhecida na URL mostra o catálogo, não uma tela vazia', async ({ page }) => {
    await page.goto('/produtos')
    const total = await cards(page).count()

    await page.goto('/produtos?categoria=categoria-inventada')
    // Categoria é lista fechada: slug fora dela é link velho ou erro de
    // digitação, e não pode produzir tela vazia que parece bug.
    await expect(cards(page)).toHaveCount(total)
    await expect(page.getByText('Filtros ativos')).toHaveCount(0)
  })

  test('marca desconhecida devolve zero com o chip na tela, e não o catálogo', async ({ page }) => {
    /*
      A assimetria com a categoria é deliberada, e este par de testes é o que a
      registra.

      Marca vem do catálogo e muda a cada coleta: não há lista para validar
      contra, e "essa marca não tem produto agora" é uma resposta verdadeira.
      Ignorar o filtro devolveria o catálogo inteiro para quem pediu uma marca.
    */
    await page.goto('/produtos?marca=marca-que-nao-existe')
    await expect(cards(page)).toHaveCount(0)
    await expect(chip(page, 'marca-que-nao-existe')).toBeVisible()
    await expect(page.getByText(/nenhum produto/i)).toBeVisible()
  })

  test('o × do chip tira só aquele filtro', async ({ page }) => {
    await page.goto('/produtos?categoria=whey-protein&promocao=1')
    await expect(chip(page, 'Whey Protein')).toBeVisible()
    await expect(chip(page, 'Só em promoção')).toBeVisible()

    await chip(page, 'Whey Protein').click()
    await expect(chip(page, 'Whey Protein')).toHaveCount(0)
    // O outro filtro sobrevive: é a diferença entre remover e limpar.
    await expect(chip(page, 'Só em promoção')).toBeVisible()
    await expect(page).toHaveURL(/promocao=1/)
  })

  test('ordenar por R$/dose põe o menor primeiro, e quem não tem dose no fim', async ({ page }) => {
    await page.goto('/produtos?ordem=dose')
    const textos = await cards(page).allInnerTexts()

    const doses = textos.map(t => {
      const m = t.match(/R\$\s*([\d.,]+)\/dose/)
      return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null
    })
    const comDose = doses.filter((d): d is number => d !== null)
    const semDose = doses.map((d, i) => (d === null ? i : -1)).filter(i => i >= 0)

    expect(comDose.length, 'nenhum card com R$/dose para ordenar').toBeGreaterThan(1)
    for (let i = 1; i < comDose.length; i++) {
      expect(comDose[i], `dose ${comDose[i]} depois de ${comDose[i - 1]}`).toBeGreaterThanOrEqual(
        comDose[i - 1],
      )
    }
    /*
      Quem não tem dose vai para o fim, nunca para o começo.

      `null - 9` é `-9` em JavaScript, e a comparação ingênua anunciaria como o
      mais barato por dose justamente quem não tem o dado.
    */
    for (const i of semDose) {
      expect(i, 'produto sem dose informada apareceu antes de quem tem').toBeGreaterThanOrEqual(
        comDose.length,
      )
    }
  })

  test('combinação sem resultado explica e oferece saída, sem prometer', async ({ page }) => {
    await page.goto('/produtos?q=whey&categoria=creatina')
    await expect(cards(page)).toHaveCount(0)
    await expect(page.getByText(/nenhum produto/i)).toBeVisible()

    const texto = await page.getByRole('main').innerText()
    for (const proibido of [/em breve/i, /aguarde/i, /em desenvolvimento/i]) {
      expect(texto, `promessa no estado vazio: ${proibido}`).not.toMatch(proibido)
    }

    await page.getByRole('link', { name: /limpar filtros/i }).click()
    await expect(page).toHaveURL(/\/produtos$/)
    expect(await cards(page).count()).toBeGreaterThan(0)
  })
})

test.describe('sem JavaScript', () => {
  /*
    O painel é feito de `<a>` e de um `<form method="get">` de propósito, e
    este teste é o que cobra essa decisão.

    Se alguém trocar uma opção por `onClick`, a tela continua funcionando no
    navegador de quem revisa e para de funcionar aqui — que é o mesmo lugar
    onde o Google e um leitor de tela mais antigo estariam.
  */
  test.use({ javaScriptEnabled: false })

  test('os filtros continuam funcionando', async ({ page }) => {
    await page.goto('/produtos')
    const opcao = painel(page).getByRole('listitem').locator('a').first()
    const rotulo = (await opcao.locator('span').first().textContent())!.trim()

    await opcao.click()
    await expect(chip(page, rotulo)).toBeVisible()
  })

  test('o teto de preço aplica e preserva os outros filtros', async ({ page }) => {
    await page.goto('/produtos?categoria=whey-protein')
    await painel(page).getByLabel(/preço até/i).fill('120')
    await painel(page).getByRole('button', { name: /aplicar/i }).click()

    await expect(page).toHaveURL(/preco_max=120/)
    // O `<form method="get">` reescreve a query inteira: sem os campos ocultos,
    // aplicar o teto apagaria a categoria escolhida.
    await expect(page).toHaveURL(/categoria=whey-protein/)
    await expect(chip(page, 'Whey Protein')).toBeVisible()
  })
})
