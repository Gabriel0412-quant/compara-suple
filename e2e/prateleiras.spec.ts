import { expect, test } from '@playwright/test'

/**
 * As prateleiras por categoria na home.
 *
 * O que se cobre aqui e não no vitest: que os cards renderizados são o mesmo
 * `ProductGridCard` das outras listagens, com as decisões editoriais dele
 * intactas; que os totais são da categoria e não da vitrine; e que a rolagem
 * e o teclado funcionam.
 */

const PRIMEIRA = 'Whey Protein'

function prateleira(page: import('@playwright/test').Page, nome = PRIMEIRA) {
  return page.getByRole('region', { name: nome })
}

test.describe('a prateleira de categoria', () => {
  test('existe, tem título e leva à categoria completa', async ({ page, request }) => {
    await page.goto('/')
    const secao = prateleira(page)
    await expect(secao).toBeVisible()

    const verTodos = secao.getByRole('link', { name: /ver todos/i })
    const href = await verTodos.getAttribute('href')
    expect(href).toMatch(/^\/categoria\//)
    expect((await request.get(href!)).status()).toBe(200)
  })

  test('os totais são da categoria inteira, não dos cards exibidos', async ({ page }) => {
    await page.goto('/')
    const secao = prateleira(page)
    const texto = await secao.innerText()

    const produtos = Number(texto.match(/(\d+) produtos?/)?.[1])
    const cards = await secao.getByRole('listitem').count()

    expect(produtos, 'a prateleira não declara o total da categoria').toBeGreaterThan(0)
    // Contar a vitrine seria dizer "4 produtos" numa categoria de nove.
    expect(produtos).toBeGreaterThanOrEqual(cards)
  })

  test('mostra no máximo quatro cards, e nenhum fictício', async ({ page }) => {
    await page.goto('/')
    const itens = prateleira(page).getByRole('listitem')
    const total = await itens.count()

    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThanOrEqual(4)

    // Todo card tem produto de verdade: nome e um preço.
    for (let i = 0; i < total; i++) {
      await expect(itens.nth(i).getByRole('heading')).not.toBeEmpty()
      await expect(itens.nth(i)).toContainText(/R\$/)
    }
  })
})

test.describe('o card mantém as decisões editoriais', () => {
  test('o CTA de saída diz que leva à loja, e não "Comprar"', async ({ page }) => {
    await page.goto('/')
    const secao = prateleira(page)

    /*
      O rótulo era "Comprar →", que sugere que o checkout acontece aqui — o
      mesmo que o #56 tirou da página de produto. Escapava da auditoria porque
      `lib/claims.ts` proíbe "comprar agora", e esta variante não casava.
    */
    await expect(secao.getByRole('link', { name: /^comprar\s*→?$/i })).toHaveCount(0)
    await expect(secao.getByRole('link', { name: /ir à loja/i }).first()).toBeVisible()
  })

  test('a saída passa pela rota de tracking, marcada como vinda da home', async ({ page }) => {
    await page.goto('/')
    const saida = prateleira(page).getByRole('link', { name: /ir à loja/i }).first()
    await expect(saida).toHaveAttribute('href', /^\/go\/\d+\?de=home&por=destaque$/)
    await expect(saida).toHaveAttribute('rel', /sponsored/)
    await expect(saida).toHaveAttribute('target', '_blank')
  })

  test('preço sem dose nem peso diz isso, em vez de omitir', async ({ page }) => {
    await page.goto('/')
    const secao = prateleira(page)
    const cards = secao.getByRole('listitem')

    for (let i = 0; i < (await cards.count()); i++) {
      const texto = await cards.nth(i).innerText()
      const temNormalizado = /\/dose|\/kg/.test(texto)
      const dizQueFalta = /sem dose ou peso informado/.test(texto)
      expect(
        temNormalizado || dizQueFalta,
        'card sem preço normalizado e sem dizer que falta o dado',
      ).toBe(true)
    }
  })

  test('desconto só aparece quando há preço anterior maior', async ({ page }) => {
    await page.goto('/')
    const cards = prateleira(page).getByRole('listitem')

    for (let i = 0; i < (await cards.count()); i++) {
      const texto = await cards.nth(i).innerText()
      if (!/-\d+%/.test(texto)) continue
      // Selo de desconto exige o preço riscado que o sustenta.
      const riscado = await cards.nth(i).locator('.line-through').count()
      expect(riscado, 'selo de desconto sem preço anterior visível').toBeGreaterThan(0)
    }
  })
})

test.describe('rolagem e teclado', () => {
  test('todos os cards são alcançáveis por teclado', async ({ page }) => {
    await page.goto('/')
    const links = prateleira(page).getByRole('listitem').locator('a')

    for (let i = 0; i < (await links.count()); i++) {
      await links.nth(i).focus()
      await expect(links.nth(i)).toBeFocused()
    }
  })

  test('em tela estreita a faixa rola na horizontal, e a página não', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')

    const lista = prateleira(page).getByRole('list')
    const rola = await lista.evaluate(el => el.scrollWidth > el.clientWidth)
    expect(rola, 'a faixa deveria rolar em 375px').toBe(true)

    const paginaRola = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(paginaRola, 'o documento não pode rolar na horizontal').toBe(false)
  })

  test('a rolagem para em card inteiro', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    const lista = prateleira(page).getByRole('list')
    await expect(lista).toHaveCSS('scroll-snap-type', /x/)
    await expect(lista.getByRole('listitem').first()).toHaveCSS('scroll-snap-align', 'start')
  })

  test('sem JavaScript não há setas, e a faixa continua rolável', async ({ browser }) => {
    const contexto = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 375, height: 800 },
    })
    const page = await contexto.newPage()
    await page.goto('/')

    const secao = prateleira(page)
    // Seta que depende de script não deve existir inerte: ela não é renderizada.
    await expect(secao.getByRole('button')).toHaveCount(0)

    const lista = secao.getByRole('list')
    expect(await lista.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)

    await contexto.close()
  })
})

test.describe('a home fala uma língua visual só', () => {
  test('não afirma queda de preço, só desconto anunciado', async ({ page }) => {
    await page.goto('/')
    const texto = await page.getByRole('main').innerText()

    /*
      "Em queda agora" e o selo "EM QUEDA" afirmavam variação no tempo. O dado
      é `original_price` do anúncio — desconto, não queda observada entre
      coletas. Volta com nome certo no #128, quando o EP10 der histórico.
    */
    expect(texto).not.toMatch(/em queda/i)
    await expect(page.getByRole('heading', { name: /maiores descontos/i })).toBeVisible()
  })

  test('preços em monoespaçada, para alinhar dígito com dígito', async ({ page }) => {
    await page.goto('/')
    const preco = prateleira(page).getByRole('listitem').first().getByText(/^R\$/).first()
    const fonte = await preco.evaluate(el => getComputedStyle(el).fontFamily)
    expect(fonte).toMatch(/plex mono/i)
  })

  test('nenhum CTA da home inteira diz "Comprar"', async ({ page }) => {
    await page.goto('/')
    /*
      O teste do #155 checava só a prateleira, e por isso não viu que o card
      da seção de descontos — outro componente — continuava com "Comprar →".
      Aqui a varredura é da página toda, que é o escopo do claim.
    */
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: /^comprar\s*→?$/i })).toHaveCount(0)

    const saidas = main.locator('a[href^="/go/"]')
    const total = await saidas.count()
    expect(total, 'a home deveria ter saídas para a loja').toBeGreaterThan(0)
    for (let i = 0; i < total; i++) {
      const nome = (await saidas.nth(i).getAttribute('aria-label')) ?? (await saidas.nth(i).innerText())
      expect(nome, `saída com rótulo que sugere checkout aqui: "${nome}"`).not.toMatch(/^comprar/i)
    }
  })

  test('nada na home usa a cor de destaque do layout antigo', async ({ page }) => {
    await page.goto('/')
    /*
      O verde `#16a34a` era a cor de ação do layout anterior — preço, CTA e
      links. Se ele reaparecer em qualquer elemento pintado da home, a
      dissonância voltou.
    */
    const verdes = await page.evaluate(() => {
      const alvo = 'rgb(22, 163, 74)'
      return [...document.querySelectorAll('main *')].filter(el => {
        const s = getComputedStyle(el)
        return s.color === alvo || s.backgroundColor === alvo || s.borderColor === alvo
      }).length
    })
    expect(verdes, 'o verde do layout antigo voltou à home').toBe(0)
  })
})
