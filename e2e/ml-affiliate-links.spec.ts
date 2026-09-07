import { expect, test } from '@playwright/test'
import { reviewedAffiliateUrl } from './fixture'

test.use({ userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' })

type Tracking = {
  writes: { table: string; row: Record<string, unknown> }[]
  offerReads: number
}

test('TestPublicBuyFlows_ShouldUseGoRouteAcrossAllFourSurfaces', async ({ page, context, request }) => {
  const trackingUrl = `http://127.0.0.1:${process.env.E2E_STUB_PORT ?? '54321'}/__test/affiliate-tracking`
  await context.route('https://www.mercadolivre.com.br/**', route => route.abort())

  for (const [surface, path] of [
    ['home', '/'],
    ['lista', '/produtos'],
    ['produto', '/produto/whey-concentrado-growth'],
    ['comparador', '/comparar?ids=1,2'],
  ]) {
    await test.step(surface, async () => {
      await page.goto(path)
      const buy = page.locator('a[href^="/go/"]').first()
      await expect(buy).toBeVisible()
      const href = await buy.getAttribute('href')
      expect(href).toMatch(new RegExp(`^/go/\\d+\\?de=${surface}&por=`))
      const offerId = Number(href!.match(/^\/go\/(\d+)/)![1])
      const destination = reviewedAffiliateUrl(offerId)
      const before: Tracking = await (await request.get(trackingUrl)).json()
      const goResponse = context.waitForEvent('response', {
        predicate: response => new URL(response.url()).pathname === `/go/${offerId}`,
      })
      await buy.click()
      const response = await goResponse
      expect(response.status()).toBe(302)
      expect(response.headers()['location']).toBe(destination)
      expect(response.request().isNavigationRequest()).toBe(true)
      const after: Tracking = await (await request.get(trackingUrl)).json()
      expect(after.offerReads - before.offerReads).toBe(1)
      const written = after.writes.slice(before.writes.length)
      expect(written).toHaveLength(2)
      expect(written.filter(write => write.table === 'click_event')).toEqual([
        { table: 'click_event', row: expect.objectContaining({ offer_id: offerId }) },
      ])
      expect(written.filter(write => write.row.evento === 'saida_para_loja')).toEqual([
        { table: 'ui_event', row: expect.objectContaining({ evento: 'saida_para_loja', superficie: surface }) },
      ])
      for (const popup of context.pages()) if (popup !== page) await popup.close()
    })
  }
})
