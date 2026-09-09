import { expect, test, type Page } from '@playwright/test'
import { getSafePreviewFixture } from './support/canvas-e2e-safety'

const projectId = 'e2e-spatial-previs-project'
const workflowId = 'e2e-spatial-previs-workflow'
const fixture = getSafePreviewFixture(process.env)

test.use({ storageState: fixture.ready ? fixture.storageState : undefined })

type CanvasSaveRequest = {
  workflowMetadata?: {
    spatialPrevis?: {
      version?: unknown
    }
  }
}

async function stubCanvasApis(page: Page) {
  const saveRequests: CanvasSaveRequest[] = []

  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname !== `/api/projects/${projectId}/canvas`) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, accounts: [], providers: [] }),
      })
      return
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          project: { id: projectId, title: 'Spatial Previs E2E' },
          workflow: { id: workflowId, metadataJson: {}, updatedAt: '2026-09-09T00:00:00.000Z' },
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          serverUpdatedAt: '2026-09-09T00:00:00.000Z',
        }),
      })
      return
    }

    saveRequests.push(route.request().postDataJSON() as CanvasSaveRequest)
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        savedAt: '2026-09-09T00:01:00.000Z',
        serverUpdatedAt: '2026-09-09T00:01:00.000Z',
      }),
    })
  })

  return saveRequests
}

test('spatial previs opens from director tools and explicitly saves its spatial metadata', async ({ page }) => {
  test.setTimeout(120_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }
  const saveRequests = await stubCanvasApis(page)
  const canvasUrl = new URL('/create', fixture.baseUrl)
  canvasUrl.searchParams.set('projectId', projectId)

  await page.goto(canvasUrl.toString(), { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-viewport')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('导演工具').click()
  await page.getByRole('button', { name: '空间预演' }).click()
  const viewport = page.locator('[data-spatial-previs-viewport="true"]')
  await expect(viewport).toBeVisible()
  expect(saveRequests).toHaveLength(0)

  await viewport.getByLabel('跟拍').click()
  await page.getByRole('tab', { name: '剧情节拍' }).click()
  await page.getByRole('button', { name: '保存预演' }).click()

  await expect(page.getByRole('status')).toHaveText('预演已保存')
  expect(saveRequests).toHaveLength(1)
  expect(saveRequests[0]?.workflowMetadata?.spatialPrevis?.version).toBe(1)
})
