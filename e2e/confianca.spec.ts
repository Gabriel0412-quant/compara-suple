import { expect, test } from '@playwright/test'
import { CLAIMS_PROIBIDOS } from '../lib/claims'

/**
 * A auditoria de claims no vitest lê o código-fonte. Esta lê o que o visitante
 * de fato recebe — é a prova que fecha a questão, porque texto pode chegar à
 * tela por caminho que a leitura do fonte não alcança: dado do banco,
 * interpolação, biblioteca.
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

test.describe('nenhuma tela pública faz claim proibido', () => {
  for (const [nome, url] of TELAS) {
    test(`${nome} está limpa`, async ({ page }) => {
      await page.goto(url)
      const visivel = await page.locator('body').innerText()

      const achados = CLAIMS_PROIBIDOS
        .filter(c => c.padrao.test(visivel))
        .map(c => `"${visivel.match(c.padrao)?.[0]}" — ${c.porque}`)

      expect(achados, achados.join('\n')).toEqual([])
    })
  }
})

/*
  O resumo, e não a página.

  Em `/produto/[slug]` a comissão de afiliado é declarada duas vezes — no
  resumo e ao lado das ofertas —, e procurar na página inteira dá violação de
  modo estrito. Estes testes falam do resumo, então é nele que olham.
*/
const resumo = (page: import('@playwright/test').Page) =>
  page.locator('details:has(> summary#como-comparamos)')

test.describe('metodologia', () => {
  /*
    A lista saiu daqui no #239.

    O resumo e o aviso de coleta defasada foram tirados de `/produtos`,
    `/categoria/<slug>` e `/ofertas` por decisão do dono do produto: a listagem
    é para escanear produto, e dois blocos de texto entre o campo de busca e o
    primeiro card empurravam a grade para baixo da dobra.

    A metodologia não saiu do site — continua nas duas telas onde a decisão de
    compra acontece, que são as que sobraram nesta lista. A declaração de
    comissão continua também no rodapé de toda página.
  */
  for (const [nome, url] of [
    ['comparador', '/comparar?ids=1,2'],
    ['produto', '/produto/whey-concentrado-growth'],
  ] as const) {
    test(`${nome} oferece o resumo "Como comparamos"`, async ({ page }) => {
      await page.goto(url)
      await expect(page.locator('summary#como-comparamos')).toBeVisible()
    })
  }

  test('o resumo distingue menor preço de destaque', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    await page.locator('summary#como-comparamos').click()
    await expect(resumo(page).getByText(/nem sempre é a mais barata/i)).toBeVisible()
  })

  test('o resumo diz que não avalia eficácia nem segurança', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    await page.locator('summary#como-comparamos').click()
    await expect(resumo(page).getByText(/não avaliamos eficácia/i)).toBeVisible()
  })

  test('o resumo declara a comissão de afiliado', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    await page.locator('summary#como-comparamos').click()
    await expect(resumo(page).getByText(/ganhamos comissão/i)).toBeVisible()
  })

  test('com coleta recente não há aviso de desatualização', async ({ page }) => {
    /*
      Apontava para `/produtos`, que desde o #239 não tem aviso nenhum — o
      teste continuaria verde por não haver o que procurar, em vez de por a
      coleta estar fresca. Aponta para a tela que ainda tem o aviso.

      O fixture carimba as ofertas com a data de hoje.
    */
    await page.goto('/produto/whey-concentrado-growth')
    await expect(page.getByText(/preços podem estar desatualizados/i)).toHaveCount(0)
  })

  test('a listagem não anuncia metodologia que não está mais lá', async ({ page }) => {
    /*
      O contrário do teste acima: a listagem perdeu o resumo de propósito, e
      isso precisa estar travado. Sem esta linha, alguém o recoloca sem
      ninguém notar — e a decisão do #239 se desfaz em silêncio.

      A declaração de comissão continua no rodapé, que é o que o `banner` e o
      `contentinfo` do `cabecalho.spec.ts` já cobram.
    */
    for (const rota of ['/produtos', '/categoria/whey-protein', '/ofertas']) {
      await page.goto(rota)
      await expect(
        page.getByRole('main').locator('summary#como-comparamos'),
        `${rota} voltou a mostrar o resumo`,
      ).toHaveCount(0)
      await expect(
        page.getByRole('main').getByText(/preços podem estar desatualizados/i),
        `${rota} voltou a mostrar o aviso de coleta`,
      ).toHaveCount(0)
    }
    // E o rodapé continua declarando o afiliado em todas elas.
    await expect(page.getByRole('contentinfo')).toContainText(/links são de afiliados/i)
  })
})

test.describe('saída instrumentada', () => {
  test('o link de compra diz de onde veio e por qual critério', async ({ page }) => {
    await page.goto('/produtos')
    const compra = page.locator('a[href^="/go/"]').first()
    await expect(compra).toHaveAttribute('href', /\/go\/\d+\?de=lista&por=(destaque|menor_preco)/)
  })

  test('na página de produto a superfície é produto', async ({ page }) => {
    await page.goto('/produto/whey-concentrado-growth')
    const compra = page.locator('a[href^="/go/"]').first()
    await expect(compra).toHaveAttribute('href', /de=produto/)
  })

  test('valor forjado na URL não vira evento', async ({ page }) => {
    // A rota descarta superfície e critério fora do vocabulário; o redirect
    // acontece do mesmo jeito, porque medir nunca pode impedir a saída.
    const r = await page.request.get('/go/101?de=inventado&por=qualquer', {
      maxRedirects: 0,
    })
    expect(r.status()).toBe(302)
  })

  test('a saída continua funcionando sem parâmetro nenhum', async ({ page }) => {
    const r = await page.request.get('/go/101', { maxRedirects: 0 })
    expect(r.status()).toBe(302)
    expect(r.headers()['location']).toContain('mercadolivre.com.br')
  })
})
