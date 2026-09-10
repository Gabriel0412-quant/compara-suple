import { expect, test } from '@playwright/test'

/**
 * A faixa de marcas, no HTML que o visitante recebe.
 *
 * O que se cobre aqui e não no vitest: que os cartões existem identificando a
 * marca real — por logo ou por nome escrito —, que cada um leva a uma listagem
 * que responde, e que nada na tela afirma parceria com as marcas listadas.
 */

const FAIXA = 'Marcas acompanhadas'

test.describe('a faixa de marcas', () => {
  test('mostra cartões com nome real, e cada um leva a uma listagem que existe', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    const secao = page.getByRole('region', { name: FAIXA })
    await expect(secao).toBeVisible()

    const cartoes = secao.getByRole('listitem').locator('a')
    const total = await cartoes.count()
    expect(total, 'faixa sem cartão nenhum').toBeGreaterThan(0)

    for (let i = 0; i < total; i++) {
      const href = await cartoes.nth(i).getAttribute('href')
      expect(href, 'cartão sem destino').toMatch(/^\/produtos\?marca=/)

      /*
        O cartão identifica a marca de dois jeitos, e os dois contam.

        Com logo, quem nomeia a marca é o `alt` da imagem — é o que o leitor de
        tela lê e o que aparece se a imagem não carregar. Sem logo, é o `span`
        do nome escrito.

        E o nome escrito se lê por `textContent`, não por `innerText`.
        `innerText` aplica o `text-transform: uppercase` do CSS e devolve
        "BLACK SKULL" onde o dado é "Black Skull" — o que passaria despercebido
        enquanto o teste só conferisse que o nome não é vazio, e falha assim que
        ele passa a exigir o nome certo.
      */
      const logo = cartoes.nth(i).locator('img')
      const nome =
        (await logo.count()) > 0
          ? ((await logo.getAttribute('alt')) ?? '')
          : ((await cartoes.nth(i).locator('span').first().textContent()) ?? '').trim()
      expect(nome.length, 'cartão sem nome visível nem no logo nem escrito').toBeGreaterThan(0)

      /*
        O nome tem que ser o da marca daquele destino, e não um rótulo solto.

        A comparação é contra o slug, porque desde o #220 o destino é
        `?marca=<slug>` e não `?q=<nome>`. O slug do nome exibido tem que ser o
        slug do link — é o que impede o cartão da Growth de levar ao filtro da
        Max Titanium.
      */
      const slug = new URL(href!, 'http://x').searchParams.get('marca')
      const doNome = nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
      expect(slug, `cartão nomeia "${nome}" mas leva a "${slug}"`).toBe(doNome)

      const resposta = await request.get(href!)
      expect(resposta.status(), `${href} não responde 200`).toBe(200)
    }
  })

  test('o cartão leva à listagem já filtrada por aquela marca', async ({ page }) => {
    await page.goto('/')
    const primeiro = page.getByRole('region', { name: FAIXA }).getByRole('listitem').locator('a').first()
    const nome = (await primeiro.locator('img').getAttribute('alt'))!
    const href = await primeiro.getAttribute('href')
    expect(new URL(href!, 'http://x').searchParams.get('marca'), 'href sem slug de marca').toBeTruthy()

    await primeiro.click()
    await expect(page).toHaveURL(/\/produtos\?marca=/)
    /*
      O filtro tem que chegar aplicado, e visível.

      Levar à listagem sem o filtro valendo seria pior que não levar: a pessoa
      clicou numa marca e receberia o catálogo inteiro sem nada dizendo isso.
      O chip é o que prova as duas coisas.
    */
    await expect(
      page.getByRole('link', { name: new RegExp(`^${nome} .*remover filtro`, 'i') }),
    ).toBeVisible()
    const cards = page.getByRole('main').getByRole('article')
    expect(await cards.count(), 'marca da faixa sem produto na listagem').toBeGreaterThan(0)
  })

  test('o caminho para o catálogo inteiro de marcas continua na faixa', async ({ page }) => {
    /*
      Este teste substitui o do texto do recorte, removido no #205.

      A faixa mostra cinco marcas e não diz mais que são "as 5 com mais ofertas
      ativas". Isso só é honesto porque a saída está do lado: `/marcas` abre
      declarando a ordem, e é ela que impede as cinco de serem lidas como o
      catálogo inteiro. Se este link sair, o recorte volta a precisar de
      legenda — e é isso que o teste protege.
    */
    await page.goto('/')
    const secao = page.getByRole('region', { name: FAIXA })
    const paraTodas = secao.getByRole('link', { name: /ver todas as marcas/i })

    await expect(paraTodas).toBeVisible()
    await expect(paraTodas).toHaveAttribute('href', '/marcas')

    await paraTodas.click()
    await expect(page).toHaveURL(/\/marcas$/)
    // O critério que saiu da home tem que estar aqui, senão ele sumiu mesmo.
    await expect(page.getByRole('main')).toContainText(/mais ofertas para a que tem menos/i)
  })

  test('não afirma parceria nem uso de logotipo oficial', async ({ page }) => {
    await page.goto('/')
    const texto = await page.getByRole('region', { name: FAIXA }).innerText()

    for (const proibido of [/parceir/i, /oficial/i, /autorizad/i, /revended/i, /representante/i]) {
      expect(texto, `a faixa insinua vínculo com as marcas: ${proibido}`).not.toMatch(proibido)
    }
  })

  test('as contagens chegam a quem usa leitor de tela', async ({ page }) => {
    await page.goto('/')
    const primeiro = page.getByRole('region', { name: FAIXA }).getByRole('listitem').locator('a').first()
    // O cartão mostra só o nome; produtos e ofertas vão no nome acessível.
    await expect(primeiro).toHaveAccessibleName(/\d+ produtos?, \d+ ofertas? ativas?/)
  })
})

for (const [nome, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['celular', { width: 375, height: 800 }],
] as const) {
  test.describe(`faixa em ${nome}`, () => {
    test.use({ viewport })

    test('cartões visíveis e alcançáveis por teclado, com foco visível', async ({ page }) => {
      await page.goto('/')
      const primeiro = page
        .getByRole('region', { name: FAIXA })
        .getByRole('listitem')
        .locator('a')
        .first()

      await expect(primeiro).toBeVisible()
      await primeiro.focus()
      await expect(primeiro).toBeFocused()

      const contorno = await primeiro.evaluate(el => getComputedStyle(el).outlineStyle)
      expect(contorno, 'cartão sem contorno de foco').not.toBe('none')
    })

    test('a faixa não estoura a largura da página', async ({ page }) => {
      await page.goto('/')
      const estoura = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(estoura).toBe(false)
    })
  })
}
