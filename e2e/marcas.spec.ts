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

/**
 * A página `/marcas`, redesenhada pelo #219 sobre a maquete 1a.
 *
 * O que se cobre aqui e não no vitest: que o painel de logo aparece de fato,
 * que a ordem escolhida chega na URL e muda a lista *e* a frase que a
 * descreve, e que nada na tela afirma o que o dado não sustenta.
 */
test.describe('a página de marcas', () => {
  test('um cartão por marca, com logo ou nome, levando ao filtro daquela marca', async ({
    page,
    request,
  }) => {
    await page.goto('/marcas')
    const cartoes = page.getByRole('main').getByRole('listitem')
    const total = await cartoes.count()
    expect(total, 'página sem cartão nenhum').toBeGreaterThan(0)

    for (let i = 0; i < total; i++) {
      const link = cartoes.nth(i).getByRole('link')
      /*
        Um link por cartão, e não dois.

        O cartão inteiro é o link e o "Ver ofertas" é um `<span>` com cara de
        botão — `<a>` dentro de `<a>` é HTML inválido, e dois links para o
        mesmo destino dariam duas paradas de tabulação por marca.
      */
      expect(await link.count(), 'cartão com mais de um link').toBe(1)

      const href = await link.getAttribute('href')
      expect(href, 'cartão sem destino').toMatch(/^\/produtos\?marca=/)
      expect((await request.get(href!)).status(), `${href} não responde 200`).toBe(200)

      // Identifica a marca por logo ou por nome escrito, como na faixa.
      const logo = link.locator('img')
      const identificacao =
        (await logo.count()) > 0
          ? ((await logo.getAttribute('alt')) ?? '')
          : ((await link.locator('span').first().textContent()) ?? '')
      expect(identificacao.trim().length, 'cartão sem marca identificada').toBeGreaterThan(0)
    }
  })

  test('o painel de logo existe, e não é pintado com cor de terceiro', async ({ page }) => {
    /*
      O #151 recusou vestir um cartão nosso com a cor oficial da marca, e a
      maquete 1a desenha exatamente isso — painéis no azul da Integralmédica,
      no vermelho da Max Titanium. A própria maquete diz em texto que aqueles
      painéis são placeholders do arquivo oficial, e é o arquivo que entra.

      O teste guarda a consequência: todos os painéis têm o mesmo fundo. Se um
      dia alguém pintar por marca, eles passam a ser vários.
      */
    await page.goto('/marcas')
    const { paineis, cartoes, fundos } = await page.evaluate(() => {
      const encontrados = [...document.querySelectorAll('main li a > div:first-child')]
      return {
        paineis: encontrados.length,
        cartoes: document.querySelectorAll('main li').length,
        fundos: [...new Set(encontrados.map(p => getComputedStyle(p).backgroundColor))],
      }
    })

    /*
      Um painel por cartão, antes de olhar a cor.

      Sem esta linha o teste passa com zero painéis encontrados: um conjunto
      vazio tem zero cores distintas, não uma — e foi o que aconteceu quando o
      painel deixou de ser `span` e virou `div`.
    */
    expect(paineis, 'seletor de painel não encontra os cartões').toBe(cartoes)
    expect(fundos.length, `painéis com fundos diferentes: ${fundos.join(', ')}`).toBe(1)
  })

  test('não afirma o que o dado não sustenta', async ({ page }) => {
    await page.goto('/marcas')
    const texto = await page.getByRole('main').innerText()

    /*
      Três selos da maquete não têm origem no banco e não podem aparecer:

      - "maior queda" afirma variação de preço no tempo, que depende do
        histórico do EP10 (#128);
      - "monitorando" descreve marca sem oferta ativa, estado que a agregação
        não produz — marca só existe aqui se tiver o que vender;
      - "avisar quando voltar" e "sugerir marca" oferecem serviços que não
        existem, e a faixa de captura do #213 já é uma dívida dessas.
    */
    for (const proibido of [
      /maior queda/i,
      /monitorando/i,
      /avisar quando/i,
      /sugerir marca/i,
      /parceir/i,
      /oficial/i,
      /autorizad/i,
    ]) {
      expect(texto, `a página afirma o que não pode provar: ${proibido}`).not.toMatch(proibido)
    }
  })

  test('os cartões têm todos a mesma altura', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/marcas')
    const alturas = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll('main li')].map(c =>
          Math.round(c.getBoundingClientRect().height),
        ),
      ),
    ])
    expect(alturas, `alturas diferentes na grade: ${alturas.join(', ')}px`).toHaveLength(1)
  })

  test('ordenar muda a lista e a frase que a descreve', async ({ page }) => {
    await page.goto('/marcas')
    const primeiroPorOfertas = await page.getByRole('main').getByRole('listitem').first().innerText()
    await expect(page.getByRole('main')).toContainText(/mais ofertas para a que tem menos/i)

    await page.getByLabel('Ordenar por').selectOption('nome')
    await page.getByRole('button', { name: /aplicar/i }).click()

    // O estado escolhido cabe na URL, então dá para compartilhar e voltar.
    await expect(page).toHaveURL(/\/marcas\?ordem=nome/)
    await expect(page.getByRole('main')).toContainText(/em ordem alfabética/i)

    const primeiroPorNome = await page.getByRole('main').getByRole('listitem').first().innerText()
    expect(
      primeiroPorNome,
      'a lista não mudou ao trocar a ordem — a fixture parou de discriminar',
    ).not.toBe(primeiroPorOfertas)
  })

  test('ordem forjada na URL não quebra a página nem vira rótulo', async ({ page }) => {
    // Mesma regra de `/go/[offerId]`: valor inventado cai no padrão.
    await page.goto('/marcas?ordem=inventado')
    await expect(page.getByRole('main')).toContainText(/mais ofertas para a que tem menos/i)
    await expect(page.getByRole('main').getByRole('listitem').first()).toBeVisible()
  })

  test.describe('sem JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('a ordenação continua funcionando, porque é formulário GET', async ({ page }) => {
      await page.goto('/marcas')
      await page.getByLabel('Ordenar por').selectOption('preco')
      await page.getByRole('button', { name: /aplicar/i }).click()

      await expect(page).toHaveURL(/\/marcas\?ordem=preco/)
      await expect(page.getByRole('main')).toContainText(/do menor preço de entrada para o maior/i)
    })
  })
})
