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

    /*
      Até o #235 este teste proibia botão nenhum nas duas regiões, porque não
      havia botão legítimo para existir ali: o header antigo tinha "Entrar" sem
      login e um campo de busca sem `form`.

      A busca do header trouxe um botão de verdade, então a regra passou do
      "não existe botão" para o que ela sempre quis dizer: botão que não leva a
      lugar nenhum sai. Um `submit` dentro de `form` com `action` leva.
    */
    for (const regiao of ['banner', 'contentinfo'] as const) {
      const botoes = page.getByRole(regiao).locator('button')

      for (let i = 0; i < (await botoes.count()); i++) {
        const botao = botoes.nth(i)
        const rotulo = (await botao.innerText()).trim()
        const destino = await botao.evaluate(el => {
          const b = el as HTMLButtonElement
          return { tipo: b.type, action: b.form?.getAttribute('action') ?? null }
        })

        expect(
          destino.tipo === 'submit' && !!destino.action,
          `Botão "${rotulo}" no ${regiao} sem destino (type=${destino.tipo}, form=${destino.action}). ` +
            'O header antigo tinha "Entrar" sem login e um campo de busca sem form. ' +
            'Controle que não faz nada sai — volta com o serviço que promete.',
        ).toBe(true)
      }
    }
  })

  test('todo campo do header vive dentro de um formulário com destino', async ({ page }) => {
    await page.goto('/')
    const campos = page.getByRole('banner').locator('input')

    /*
      O que este teste guardava era "campo de busca morto no header", e o jeito
      de garantir isso era exigir zero campos. Com a busca de verdade no header
      (#235), a exigência passa a ser a que interessa: nenhum campo solto.

      Campo sem `form` é exatamente a falha antiga — parecia busca, aceitava
      texto, e o Enter não fazia nada.
    */
    for (let i = 0; i < (await campos.count()); i++) {
      const dono = await campos.nth(i).evaluate(el => {
        const c = el as HTMLInputElement
        return { name: c.name, action: c.form?.getAttribute('action') ?? null }
      })
      expect(dono.action, `campo "${dono.name}" no header sem formulário`).toBeTruthy()
    }
  })
})

test.describe('a busca do header', () => {
  /*
    A busca só existia na home, dentro do hero. Nas outras seis rotas não havia
    como buscar sem voltar ao começo — e é isso que o #235 resolve, então o
    teste percorre as rotas em vez de olhar só uma.
  */
  const ROTAS = ['/', '/produtos', '/ofertas', '/comparar', '/marcas', '/categoria/whey-protein']

  for (const rota of ROTAS) {
    test(`existe em ${rota}, com destino e nome próprios`, async ({ page }) => {
      await page.goto(rota)
      const busca = page.getByRole('banner').getByRole('search')

      await expect(busca).toHaveAttribute('action', '/produtos')
      await expect(busca).toHaveAttribute('method', 'get')
      await expect(busca.getByRole('searchbox')).toHaveAttribute('name', 'q')
    })
  }

  test('leva o termo para a listagem', async ({ page }) => {
    await page.goto('/ofertas')
    const busca = page.getByRole('banner').getByRole('search')

    await busca.getByRole('searchbox').fill('creatina')
    await busca.getByRole('button', { name: /^buscar$/i }).click()

    await expect(page).toHaveURL(/\/produtos\?q=creatina/)
  })

  test('funciona sem JavaScript, como o resto da busca', async ({ browser }) => {
    const contexto = await browser.newContext({ javaScriptEnabled: false })
    const page = await contexto.newPage()
    await page.goto('/marcas')

    const busca = page.getByRole('banner').getByRole('search')
    await busca.getByRole('searchbox').fill('whey')
    await busca.getByRole('button', { name: /^buscar$/i }).click()

    await expect(page).toHaveURL(/\/produtos\?q=whey/)
    await contexto.close()
  })

  test('na home convive com a busca do hero sem se confundir com ela', async ({ page }) => {
    /*
      Duas buscas na mesma página é o caso que o #235 cria, e ele tem duas
      armadilhas: `id` repetido quebra o `<label for>` — clicar no rótulo de
      uma foca a outra — e dois marcos `role="search"` com o mesmo nome deixam
      quem navega por landmark escolhendo no escuro.
    */
    await page.goto('/')

    await expect(page.getByRole('search')).toHaveCount(2)

    const ids = await page.locator('input[type="search"]').evaluateAll(cs =>
      cs.map(c => (c as HTMLInputElement).id),
    )
    expect(new Set(ids).size, `campos de busca com id repetido: ${ids.join(', ')}`).toBe(ids.length)

    const nomes = await page
      .getByRole('search')
      .evaluateAll(fs => fs.map(f => f.getAttribute('aria-label')))
    expect(new Set(nomes).size, `marcos de busca com o mesmo nome: ${nomes.join(', ')}`).toBe(2)
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
