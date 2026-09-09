import { expect, test, type Page } from '@playwright/test'

import { PRODUTOS, TOTAIS } from './fixture'

/**
 * Contrato da home: a jornada inteira, em desktop e celular.
 *
 * Os specs por seção — `hero`, `marcas`, `prateleiras`, `comparador-home`,
 * `responsivo-home` — cobrem cada peça em profundidade. Este cobre o que só
 * aparece quando se olha a página como um todo:
 *
 * - os números batem com a fixture, e não com um literal digitado;
 * - todo link da página responde;
 * - as seções que ainda não têm dado **não estão lá**, nem como promessa.
 *
 * O terceiro é o que mais importa. A home foi construída em nove PRs, e três
 * das suas seções estão bloqueadas esperando dado (#128, #129, #130). A
 * tentação de "adiantar" o visual delas com um esqueleto ou um "em breve"
 * existe justamente porque a página parece incompleta sem elas.
 */

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }],
  ['celular', { width: 375, height: 800 }],
] as const

/**
 * Quantos whey compráveis a fixture tem, derivado dela.
 *
 * Escrever o número à mão já me custou duas correções: `toHaveCount(2)` virou
 * 3 no #157 e 4 no #198, cada vez que a fixture ganhou um produto por um
 * motivo legítimo. Derivar faz a asserção seguir a fixture, e o teste passa a
 * falhar só quando o comportamento muda — que é o que ele deveria vigiar.
 */
const WHEY_COMPRAVEIS = PRODUTOS.filter(
  p => /whey/i.test(p.name) && p.variant.some(v => v.offer.some(o => o.available)),
).length

async function linksInternos(page: Page): Promise<string[]> {
  const hrefs = await page.locator('a[href^="/"]').evaluateAll(as =>
    as.map(a => a.getAttribute('href') ?? ''),
  )
  return [...new Set(hrefs)].filter(
    // `/go/` sai do site: pedir aqui bateria no Mercado Livre de verdade.
    href => href && !href.startsWith('/go/'),
  )
}

for (const [nome, viewport] of VIEWPORTS) {
  test.describe(`home em ${nome}`, () => {
    test.use({ viewport })

    test('as cinco seções com dado estão presentes', async ({ page }) => {
      await page.goto('/')
      const main = page.getByRole('main')

      await expect(main.getByRole('heading', { level: 1 })).toContainText(/quanto custa/i)
      await expect(main.getByRole('searchbox')).toBeVisible()
      await expect(page.getByRole('region', { name: 'Marcas acompanhadas' })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Whey Protein' })).toBeVisible()
      await expect(
        page.getByRole('region', { name: 'Mesma categoria, preço por dose diferente' }),
      ).toBeVisible()
      await expect(main.getByRole('heading', { name: /maiores descontos/i })).toBeVisible()
    })

    test('os números do hero batem com a fixture', async ({ page }) => {
      await page.goto('/')
      const texto = await page.getByRole('main').innerText()

      /*
        Amarrado à fixture, não a um literal. É o que garante o critério
        "fixtures não dependem de contagem de produção": se alguém colar aqui
        os números do banco real, o teste quebra na hora.

        E com limite de palavra, não `toContain`. A primeira versão usava
        `toContain('7 ofertas')` e passava com "967 ofertas" na tela — porque
        "967 ofertas" contém "7 ofertas" como substring. A mutação que colava
        o número da maquete no lugar do dado sobrevivia a esta asserção; só o
        teste específico do `hero.spec.ts` a pegava.
      */
      expect(texto).toMatch(new RegExp(`\\b${TOTAIS.ofertasDisponiveis} ofertas\\b`))
      expect(texto).toMatch(new RegExp(`\\b${TOTAIS.produtos} produtos\\b`))
      expect(texto).toMatch(/Última coleta (hoje|ontem|em \d{2}\/\d{2}) às \d{2}:\d{2}/)
    })

    test('todo link interno da página responde', async ({ page, request }) => {
      await page.goto('/')
      const links = await linksInternos(page)

      expect(links.length, 'home sem link interno nenhum').toBeGreaterThan(8)
      for (const href of links) {
        const resposta = await request.get(href)
        expect(resposta.status(), `${href} não responde 200`).toBe(200)
      }
    })

    test('os CTAs levam aos destinos certos', async ({ page }) => {
      await page.goto('/')
      const main = page.getByRole('main')

      await expect(main.getByRole('link', { name: /abra o comparador/i })).toHaveAttribute(
        'href',
        '/comparar',
      )
      await expect(
        page
          .getByRole('region', { name: 'Marcas acompanhadas' })
          .getByRole('link', { name: /ver todas as marcas/i }),
      ).toHaveAttribute('href', '/marcas')
      await expect(
        page.getByRole('region', { name: 'Whey Protein' }).getByRole('link', { name: /ver todos/i }),
      ).toHaveAttribute('href', '/categoria/whey-protein')
      await expect(
        page
          .getByRole('region', { name: 'Mesma categoria, preço por dose diferente' })
          .getByRole('link', { name: /abrir comparador/i }),
      ).toHaveAttribute('href', /^\/comparar\?ids=/)
    })

    test('a busca da home leva à listagem, com o mesmo total da fixture', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('searchbox').first().fill('whey')
      await page.getByRole('button', { name: /buscar preços/i }).click()

      await expect(page).toHaveURL(/\/produtos\?q=whey/)
      await expect(page.locator('article')).toHaveCount(WHEY_COMPRAVEIS)
    })
  })
}

test.describe('as seções sem dado não estão na página', () => {
  /*
    Três seções da maquete 1b estão bloqueadas, cada uma esperando algo:

    - "Maior queda de hoje" e o feed de quedas (#128) esperam o EP10 (#114)
      entregar histórico com cobertura mínima. Afirmam variação no tempo, e o
      `price_history` é esparso.
    - A captura de alerta por e-mail (#129) espera o EP18. Campo de e-mail que
      não envia e-mail promete serviço inexistente e coleta dado pessoal sem
      finalidade.
    - Os guias (#130) esperam os artigos existirem.

    A regra do projeto é que dado ausente é informação: a seção some, não vira
    esqueleto nem "em breve". Este teste é o que impede alguém de "adiantar" o
    visual delas.
  */

  const AFIRMACOES_BLOQUEADAS = [
    { padrao: /maior queda/i, issue: '#128', porque: 'afirma variação de preço no tempo' },
    { padrao: /em queda/i, issue: '#128', porque: 'afirma variação de preço no tempo' },
    { padrao: /quedas? nas últimas/i, issue: '#128', porque: 'conta quedas sem histórico' },
    { padrao: /tá quente/i, issue: '#128', porque: 'sugere movimento recente de preço' },
    { padrao: /alerta de preço/i, issue: '#129', porque: 'promete serviço que não existe' },
    { padrao: /criar alerta/i, issue: '#129', porque: 'promete serviço que não existe' },
    { padrao: /quero ser avisado/i, issue: '#129', porque: 'promete serviço que não existe' },
  ] as const

  const PLACEHOLDERS = [/em breve/i, /em desenvolvimento/i, /aguarde/i, /logo mais/i] as const

  test('nenhuma afirmação bloqueada aparece', async ({ page }) => {
    await page.goto('/')
    const texto = await page.getByRole('main').innerText()

    const achados = AFIRMACOES_BLOQUEADAS.filter(a => a.padrao.test(texto)).map(
      a => `  "${texto.match(a.padrao)?.[0]}" — ${a.porque} (${a.issue})`,
    )
    expect(
      achados,
      achados.length === 0
        ? ''
        : `A home voltou a afirmar o que não sustenta:\n${achados.join('\n')}\n\n` +
          'Estas seções entram quando o dado existir, com o nome certo.',
    ).toEqual([])
  })

  test('não há campo de e-mail em lugar nenhum da home', async ({ page }) => {
    await page.goto('/')
    // O EP18 não começou. Campo que não envia coleta dado pessoal sem finalidade.
    await expect(page.locator('input[type="email"]')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: /e-?mail/i })).toHaveCount(0)
  })

  test('não há esqueleto nem promessa no lugar das seções ausentes', async ({ page }) => {
    await page.goto('/')
    const texto = await page.getByRole('main').innerText()

    for (const padrao of PLACEHOLDERS) {
      expect(texto, `placeholder na home: ${padrao}`).not.toMatch(padrao)
    }
    // Esqueleto de carregamento também não: a home é server-rendered.
    await expect(page.locator('main .animate-pulse')).toHaveCount(0)
  })

  test('a seção de guias não aparece sem os artigos', async ({ page }) => {
    await page.goto('/')
    // #130: link de guia antes do artigo existir prometeria profundidade que
    // o site não tem, e a malha de links do #113 deixa de fazer sentido se
    // aponta para 404.
    await expect(page.getByRole('region', { name: /guias/i })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('heading', { name: /^guias$/i })).toHaveCount(0)
  })
})
