import { expect, test } from '@playwright/test'

/**
 * A página de produto é a última tela antes de o visitante sair para a loja.
 * O que se cobre aqui é o que ela afirma na saída: para onde manda, o que
 * declara sobre a compra, e o que evita declarar sem ter o dado.
 *
 * Desde o #163 ela é a maquete 1c — coluna fixa com a caixa de preço — e três
 * blocos que existiam como esqueleto deixaram de existir. As ausências estão
 * travadas aqui embaixo: o catálogo não tem histórico de 90 dias, não tem
 * coluna de proteína e não tem avaliação, e nenhum dos três pode voltar como
 * "em breve".
 */

const PRODUTO = '/produto/whey-concentrado-growth'
/** Oferta única: a mais barata é a que o ML promove, e não há o que separar. */
const UMA_OFERTA = '/produto/whey-concentrado-dux'
/** Sem peso, sem doses e sem foto: exercita a ausência. */
const SEM_DADOS = '/produto/pre-treino-sem-dados'
/** Treze ofertas, e a mais barata na pior posição do ML: exercita o teto. */
const MUITAS_OFERTAS = '/produto/creatina-integralmedica'

const saida = (page: import('@playwright/test').Page) =>
  page.getByRole('link', { name: /ver oferta no mercado livre/i })

test.describe('saída para a loja', () => {
  test('o CTA diz para onde leva, e não sugere compra aqui', async ({ page }) => {
    await page.goto(PRODUTO)

    await expect(saida(page)).toBeVisible()
    // "Comprar agora" sugeria que o checkout acontece no Preço Suplemento.
    await expect(page.getByRole('link', { name: /^comprar agora/i })).toHaveCount(0)
  })

  test('a saída principal leva a mais barata, não a que o ML promove', async ({ page }) => {
    /*
      A fixture existe para os dois discordarem: o ML põe na frente a oferta
      101, a R$ 89,90, e a mais barata é a 102, a R$ 84,50. A maquete 1c rotula
      a caixa "menor preço", e é ela que carrega o botão.
    */
    await page.goto(PRODUTO)
    await expect(saida(page)).toHaveAttribute('href', '/go/102?de=produto&por=menor_preco')
  })

  test('a saída abre em nova aba e é rastreada', async ({ page }) => {
    await page.goto(PRODUTO)
    await expect(saida(page)).toHaveAttribute('target', '_blank')
    await expect(saida(page)).toHaveAttribute('rel', /noopener/)
    await expect(saida(page)).toHaveAttribute('rel', /sponsored/)
  })

  test('a divulgação de afiliado é visível antes da saída', async ({ page }) => {
    await page.goto(PRODUTO)
    await expect(page.getByText(/ganhamos comissão se você comprar/i)).toBeVisible()
  })

  test('dá para chegar à saída pelo teclado', async ({ page }) => {
    await page.goto(PRODUTO)
    await saida(page).focus()
    await expect(saida(page)).toBeFocused()
  })
})

test.describe('menor preço e destaque continuam separados', () => {
  test('a oferta promovida aparece nomeada, com o preço e o link dela', async ({ page }) => {
    await page.goto(PRODUTO)

    const promovida = page.getByText(/o mercado livre destaca outra/i)
    await expect(promovida).toBeVisible()
    await expect(
      page.getByRole('link', { name: /ver a oferta em destaque/i }),
    ).toHaveAttribute('href', '/go/101?de=produto&por=destaque')
  })

  test('com uma oferta só, não há contradição a mostrar', async ({ page }) => {
    await page.goto(UMA_OFERTA)
    await expect(page.getByText(/o mercado livre destaca outra/i)).toHaveCount(0)
    await expect(saida(page)).toHaveAttribute('href', '/go/601?de=produto&por=menor_preco')
  })
})

test.describe('a tabela fala em ofertas, não em lojas', () => {
  test('o título conta anúncios do Mercado Livre', async ({ page }) => {
    // Só existe um marketplace: "Comparar em 2 lojas" afirmava outra coisa.
    await page.goto(PRODUTO)
    await expect(page.getByRole('heading', { name: '2 ofertas no Mercado Livre' })).toBeVisible()
    await expect(page.getByRole('main').getByText(/\d+ lojas/)).toHaveCount(0)
  })
})

test.describe('o teto da tabela de ofertas', () => {
  // A página tem uma tabela só; `#ofertas-do-produto` é o `<h2>` que a nomeia.
  const linhas = (page: import('@playwright/test').Page) => page.locator('tbody tr')

  test('mostra dez, mais a mais barata, e diz quantas faltam', async ({ page }) => {
    /*
      A fixture tem 13 ofertas e a mais barata é a de pior posição no ML. Sem a
      linha extra, a caixa de preço anunciaria R$ 89,90 e nenhuma das dez
      linhas visíveis teria esse valor.
    */
    await page.goto(MUITAS_OFERTAS)
    await expect(linhas(page)).toHaveCount(11)
    await expect(page.getByRole('button', { name: 'Ver as outras 2 ofertas' })).toBeVisible()
    // A linha extra é a mais barata, e ela vem por último, fora da ordem do ML.
    await expect(linhas(page).last()).toContainText('R$ 89,90')
  })

  test('abrir mostra todas, e o botão passa a fechar', async ({ page }) => {
    await page.goto(MUITAS_OFERTAS)
    await page.getByRole('button', { name: 'Ver as outras 2 ofertas' }).click()
    await expect(linhas(page)).toHaveCount(13)
    await expect(page.getByRole('button', { name: 'Mostrar menos' })).toBeVisible()
  })

  test('o filtro de loja oficial recorta a lista', async ({ page }) => {
    await page.goto(MUITAS_OFERTAS)
    await page.getByRole('button', { name: 'Loja oficial' }).click()
    await expect(linhas(page)).toHaveCount(1)
    await expect(page.getByRole('heading', { name: /de 13 oferta/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'limpar' })).toBeVisible()
  })

  test('ordenar por menor preço traz a mais barata para a primeira linha', async ({ page }) => {
    await page.goto(MUITAS_OFERTAS)
    await page.getByLabel('Ordenar ofertas').selectOption('preco')
    await expect(linhas(page).first()).toContainText('R$ 89,90')
  })
})

test.describe('dado ausente é informação', () => {
  test('com dose e peso, os dois azulejos aparecem', async ({ page }) => {
    await page.goto(PRODUTO)
    await expect(page.getByRole('term').filter({ hasText: 'R$ / dose' })).toBeVisible()
    await expect(page.getByRole('term').filter({ hasText: 'R$ / kg' })).toBeVisible()
  })

  test('sem dose e sem peso, a página diz que não sabe', async ({ page }) => {
    await page.goto(SEM_DADOS)
    await expect(page.getByText(/sem dose ou peso informado/i).first()).toBeVisible()
    // Sem azulejo nenhum: não vira "—" nem caixa vazia.
    await expect(page.getByRole('term')).toHaveCount(0)
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

  for (const [nome, padrao] of [
    ['histórico de preço', /hist[óo]rico de pre[çc]o/i],
    ['informação nutricional', /informa[çc][ãa]o nutricional/i],
    ['avaliações', /avalia[çc][õo]es/i],
    ['promessa de "em breve"', /em breve/i],
  ] as const) {
    test(`não mostra ${nome}`, async ({ page }) => {
      /*
        Os três estavam na tela desabilitados, com "em breve" por legenda, mais
        cinco estrelas cravadas em 4,5. `price_history` tem 11 dias distintos,
        não existe coluna de proteína e não coletamos avaliação — seção sem
        dado some, e é isso que estas quatro linhas impedem de voltar.
      */
      await page.goto(PRODUTO)
      await expect(page.getByText(padrao)).toHaveCount(0)
    })
  }
})

test.describe('relacionados', () => {
  test('a fileira ordena por R$/dose e não repete o produto da tela', async ({ page }) => {
    await page.goto(PRODUTO)

    const fileira = page.locator('#prateleira-relacionados')
    await expect(
      page.getByRole('heading', { name: /whey protein mais barato por dose/i }),
    ).toBeVisible()

    const nomes = await fileira.getByRole('heading', { level: 2 }).allInnerTexts()
    expect(nomes.length).toBeGreaterThan(1)
    expect(nomes.join(' | ')).not.toContain('Whey Protein Concentrado 1kg Growth Supplements')

    /*
      A ordem sai dos R$/dose da fixture: Max Titanium 149,90/30 = 5,00, o sem
      marca 175,50/30 = 5,85 e a DUX 199,90/30 = 6,66. Se a fileira voltar a
      ordenar por preço de etiqueta, a ordem é a mesma — por isso o teste
      confere também que o título promete dose, e a legenda, o critério.
    */
    expect(nomes[0]).toContain('Max Titanium')
    await expect(fileira.locator('..').getByText(/menor para o maior preço por dose/i)).toBeVisible()
  })

  test('o clique dos relacionados sai marcado como vindo do produto', async ({ page }) => {
    await page.goto(PRODUTO)
    const compra = page.locator('#prateleira-relacionados a[href^="/go/"]').first()
    await expect(compra).toHaveAttribute('href', /de=produto/)
  })
})

test.describe('produto sem oferta', () => {
  test('não finge que há o que comprar', async ({ page }) => {
    // O produto 4 do fixture só tem oferta fora do ar.
    await page.goto('/produto/blend-vegan-fora-do-ar')
    await expect(page.getByText(/sem ofertas disponíveis/i)).toBeVisible()
    await expect(saida(page)).toHaveCount(0)
  })
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('o preço e a saída vêm antes da tabela de ofertas', async ({ page }) => {
    /*
      Em coluna única o grid empilha na ordem do DOM. Posicionando a caixa pela
      direita com `order`, ela caía depois da tabela inteira — 3.400px abaixo
      do nome do produto — e ainda quebrava a ordem do Tab, que `order` não
      muda. Por isso a ordem do DOM é a do celular e o desktop reposiciona.
    */
    await page.goto(PRODUTO)
    const caixa = await saida(page).boundingBox()
    const tabela = await page.locator('#ofertas-do-produto').boundingBox()
    expect(caixa!.y).toBeLessThan(tabela!.y)
  })

  test('a página não rola de lado', async ({ page }) => {
    await page.goto(PRODUTO)
    const transbordo = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(transbordo).toBe(0)
  })
})
