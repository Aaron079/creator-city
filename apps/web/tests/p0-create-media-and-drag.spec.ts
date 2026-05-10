import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'https://creator-city-vert.vercel.app'
const EMAIL = process.env.CREATOR_CITY_E2E_EMAIL
const PASSWORD = process.env.CREATOR_CITY_E2E_PASSWORD

test('P0 create media recovery and canvas dragging', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(`${BASE_URL}/create`, { waitUntil: 'domcontentloaded' })

  if (/\/auth\/login/.test(page.url())) {
    if (!EMAIL || !PASSWORD) {
      test.skip(true, 'Unable to auto-login: CREATOR_CITY_E2E_EMAIL and CREATOR_CITY_E2E_PASSWORD are not configured.')
      return
    }
    await page.getByPlaceholder('you@example.com').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL(/\/create/, { timeout: 30_000 })
  }

  await expect(page.locator('.canvas-viewport')).toBeVisible({ timeout: 30_000 })

  const mediaNodes = page.locator('.canvas-node-card.node-image, .canvas-node-card.node-video')
  const mediaCount = await mediaNodes.count()
  expect(mediaCount, 'Expected at least one image/video node on /create').toBeGreaterThan(0)

  const firstNode = mediaNodes.first()
  const beforeBox = await firstNode.boundingBox()
  expect(beforeBox, 'Expected first media node bounding box before drag').not.toBeNull()

  const badText = firstNode.getByText(/不可恢复|storageKey，无法恢复/)
  if (await badText.count()) {
    const recover = firstNode.getByRole('button', { name: '立即恢复资产' })
    if (await recover.count()) {
      await recover.click()
      await page.waitForTimeout(3000)
    }
    await expect(firstNode.getByText(/storageKey，无法恢复/)).toHaveCount(0)
  }

  const mediaSrc = firstNode.locator('img[src], video[src]')
  await expect(mediaSrc.first()).toBeVisible({ timeout: 20_000 })
  const src = await mediaSrc.first().getAttribute('src')
  expect(src && src.length > 0, 'Expected media node to render img/video src').toBeTruthy()

  await firstNode.dblclick({ position: { x: 12, y: 12 } })
  await page.mouse.move(beforeBox!.x + 12, beforeBox!.y + 12)
  await page.mouse.down()
  await page.mouse.move(beforeBox!.x + 92, beforeBox!.y + 72, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(1200)

  const afterBox = await firstNode.boundingBox()
  expect(afterBox, 'Expected first media node bounding box after drag').not.toBeNull()
  expect(Math.abs(afterBox!.x - beforeBox!.x) + Math.abs(afterBox!.y - beforeBox!.y), 'Expected node position to change after drag').toBeGreaterThan(20)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-viewport')).toBeVisible({ timeout: 30_000 })
  const reloadedBox = await page.locator('.canvas-node-card.node-image, .canvas-node-card.node-video').first().boundingBox()
  expect(reloadedBox, 'Expected media node bounding box after reload').not.toBeNull()
  expect(Math.abs(reloadedBox!.x - afterBox!.x) + Math.abs(reloadedBox!.y - afterBox!.y), 'Expected dragged position to persist after refresh').toBeLessThan(12)
})
