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

test.describe('os cards têm todos o mesmo tamanho', () => {
  /*
    Antes desta trava, os cards da mesma prateleira mediam 562, 514 e 514px.

    A causa era dupla: o `<article>` não preenchia o `<li>` esticado pelo flex,
    e a linha "Menor preço" existe em uns cards e não em outros. O resultado
    era uma fileira com três alturas diferentes e os preços em três linhas
    distintas — num comparador, isso obriga a procurar o número em vez de
    correr o olho.
  */

  /**
   * Orçamento de altura, medido em 1440px.
   *
   * Foi 562px, caiu para 380 no #199 e subiu para 640 no #207, quando a caixa
   * da imagem passou de 96px para 378 e o card fechou em 630. O orçamento não
   * é "o card não pode crescer": é "o card não cresce sem alguém decidir". As
   * duas primeiras vezes ele cresceu por acidente de conteúdo; desta vez foi
   * escolha, e o número se move junto com a escolha.
   */
  const ALTURA_MAXIMA = 640

  async function medir(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const secao = document.querySelector('section[aria-labelledby="prateleira-whey-protein-titulo"]')
      return [...(secao?.querySelectorAll('li') ?? [])].map(li => {
        const art = li.querySelector('article')!
        const preco = [...art.querySelectorAll('span')].find(s => /^R\$/.test(s.textContent ?? ''))
        const botao = [...art.querySelectorAll('a')].find(a => /ir à loja/i.test(a.textContent ?? ''))
        return {
          altura: Math.round(art.getBoundingClientRect().height),
          precoY: Math.round(preco?.getBoundingClientRect().top ?? -1),
          botaoY: Math.round(botao?.getBoundingClientRect().top ?? -1),
        }
      })
    })
  }

  test('altura idêntica entre cards da mesma prateleira', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/')
    const cards = await medir(page)

    expect(cards.length, 'prateleira sem cards para comparar').toBeGreaterThan(1)
    const alturas = [...new Set(cards.map(c => c.altura))]
    expect(alturas, `alturas diferentes na mesma fileira: ${alturas.join(', ')}px`).toHaveLength(1)
  })

  test('preço e botão de saída na mesma linha em todos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/')
    const cards = await medir(page)

    // Preço desalinhado é o sintoma que mais atrapalha a comparação, e vem de
    // linhas opcionais (riscado, "menor preço") mudando a altura do bloco.
    expect([...new Set(cards.map(c => c.precoY))], 'preços em linhas diferentes').toHaveLength(1)
    expect([...new Set(cards.map(c => c.botaoY))], 'botões em linhas diferentes').toHaveLength(1)
  })

  test('o card cabe no orçamento de altura', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/')
    const cards = await medir(page)

    for (const card of cards) {
      expect(
        card.altura,
        `card com ${card.altura}px; o orçamento é ${ALTURA_MAXIMA}px. ` +
          'Se cresceu de propósito, mova o orçamento junto e diga por quê.',
      ).toBeLessThanOrEqual(ALTURA_MAXIMA)
    }
  })

  test('em tela larga o card mede um quinto da prateleira', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/')
    /*
      A prateleira mede 1280px e os cards eram fixos em 268: cinco deles mais
      quatro vãos davam 1396, e o quinto aparecia cortado ao meio. Não era
      convite a rolar — era um card partido na borda de uma lista que já tem
      setas para dizer que rola.

      A asserção é sobre a largura, não sobre quantos cards aparecem. O
      catálogo do fixture tem quatro produtos por prateleira de propósito, e
      inflá-lo para cinco quebraria as contagens exatas que outros testes
      afirmam. Medir a regra — largura igual a um quinto do que sobra depois
      dos quatro vãos — prova a mesma coisa com os produtos que existem.
    */
    const m = await page.evaluate(() => {
      const ul = document.querySelector('ul[id^="prateleira-"]') as HTMLElement | null
      const li = ul?.querySelector(':scope > li') as HTMLElement | null
      if (!ul || !li) return null
      const vao = parseFloat(getComputedStyle(ul).columnGap)
      return {
        card: li.getBoundingClientRect().width,
        esperado: (ul.getBoundingClientRect().width - 4 * vao) / 5,
      }
    })

    expect(m, 'prateleira sem card para medir').not.toBeNull()
    expect(
      Math.abs(m!.card - m!.esperado),
      `card com ${m!.card.toFixed(1)}px; um quinto da prateleira é ${m!.esperado.toFixed(1)}px`,
    ).toBeLessThanOrEqual(1)
  })

  test('a imagem fica com a maior parte do card', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/')
    /*
      A guarda é de proporção, não de pixels.

      Ela era "pelo menos 88px de área útil", o que fazia sentido quando a
      caixa tinha 96px. Com 378, aquele piso virou letra morta: passaria com a
      imagem em 15% do card. O que se decidiu no #207 foi a divisão — imagem em
      60%, informação em 40% —, e é a divisão que precisa ser defendida, porque
      é dela que sai o reconhecimento da embalagem.

      O piso é 55% e não 60% para uma linha a mais de nome não derrubar a
      suíte. Abaixo disso a decisão foi desfeita, não arredondada.
    */
    const proporcao = await page.evaluate(() => {
      const secao = document.querySelector('section[aria-labelledby="prateleira-whey-protein-titulo"]')
      const art = secao?.querySelector('li article') as HTMLElement | null
      const caixa = art?.querySelector('a.relative') as HTMLElement | null
      if (!art || !caixa) return 0
      return caixa.getBoundingClientRect().height / art.getBoundingClientRect().height
    })
    expect(
      Math.round(proporcao * 100),
      'a imagem deixou de ser a maior parte do card',
    ).toBeGreaterThanOrEqual(55)
  })
})

test.describe('setas de navegação da prateleira', () => {
  /*
    Largura escolhida para os cards da fixture transbordarem: quatro cards de
    ~268px passam de 900px de viewport. Em 1440px eles cabem, e as setas
    corretamente não aparecem — o teste em desktop provaria o contrário do que
    interessa.
  */
  test.use({ viewport: { width: 900, height: 900 } })

  function setas(page: import('@playwright/test').Page) {
    return prateleira(page).getByRole('button')
  }

  test('aparecem quando há produto fora da tela', async ({ page }) => {
    await page.goto('/')
    await expect(setas(page)).toHaveCount(2)
    await expect(prateleira(page).getByRole('button', { name: /ver próximos/i })).toBeVisible()
  })

  test('a de voltar começa desabilitada, e a de avançar não', async ({ page }) => {
    await page.goto('/')
    // Seta que parece clicável e não move nada é a mesma falha do controle sem
    // ação, em escala menor.
    await expect(prateleira(page).getByRole('button', { name: /ver anteriores/i })).toBeDisabled()
    await expect(prateleira(page).getByRole('button', { name: /ver próximos/i })).toBeEnabled()
  })

  test('avançar rola a faixa, e habilita o voltar', async ({ page }) => {
    await page.goto('/')
    const lista = prateleira(page).getByRole('list')
    const antes = await lista.evaluate(el => el.scrollLeft)

    await prateleira(page).getByRole('button', { name: /ver próximos/i }).click()
    await expect
      .poll(async () => lista.evaluate(el => el.scrollLeft), { timeout: 4000 })
      .toBeGreaterThan(antes)

    await expect(prateleira(page).getByRole('button', { name: /ver anteriores/i })).toBeEnabled()
  })

  test('no fim da faixa, avançar desabilita', async ({ page }) => {
    await page.goto('/')
    const lista = prateleira(page).getByRole('list')
    await lista.evaluate(el => el.scrollTo({ left: el.scrollWidth }))

    await expect(prateleira(page).getByRole('button', { name: /ver próximos/i })).toBeDisabled()
    await expect(prateleira(page).getByRole('button', { name: /ver anteriores/i })).toBeEnabled()
  })

  test('alcançáveis por teclado, com alvo de toque cheio', async ({ page }) => {
    await page.goto('/')
    const avancar = prateleira(page).getByRole('button', { name: /ver próximos/i })
    await avancar.focus()
    await expect(avancar).toBeFocused()

    const caixa = await avancar.boundingBox()
    expect(caixa!.height).toBeGreaterThanOrEqual(44)
    expect(caixa!.width).toBeGreaterThanOrEqual(44)
  })

  test('cabem em 1440px sem aparecer, quando não há o que rolar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    // A fixture tem quatro whey, que cabem em 1440px. Seta sem função não
    // entra na tela — é a mesma regra do "Entrar" removido do header.
    await expect(setas(page)).toHaveCount(0)
  })
})
