import { expect, test } from '@playwright/test'
import {
  findForbiddenMutationRequests,
  getSafePreviewFixture,
  type RequestEvidence,
} from './support/canvas-e2e-safety'

const fixture = getSafePreviewFixture(process.env)

test.use({ storageState: fixture.ready ? fixture.storageState : undefined })

test('isolated Preview canvas loads, selects a node, saves once, and reloads', async ({ page }) => {
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []
  page.on('request', (request) => {
    requests.push({
      method: request.method(),
      pathname: new URL(request.url()).pathname,
    })
  })
  page.on('pageerror', (error) => pageErrors.push(error.name))

  const canvasUrl = new URL('/create', fixture.baseUrl)
  canvasUrl.searchParams.set('projectId', fixture.projectId)
  await page.goto(canvasUrl.toString(), { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.canvas-viewport')).toBeVisible()
  const saveButton = page.getByRole('button', { name: '保存到云端' })
  await expect(saveButton).toBeVisible()

  const nodes = page.locator('.canvas-node-card')
  await expect(nodes).not.toHaveCount(0)
  await nodes.first().click()

  await saveButton.click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-viewport')).toBeVisible()

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})
