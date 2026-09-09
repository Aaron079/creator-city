import { expect, test, type Page } from '@playwright/test'
import { getSafePreviewFixture } from './support/canvas-e2e-safety'

const projectId = 'e2e-spatial-previs-project'
const workflowId = 'e2e-spatial-previs-workflow'
const initialServerVersion = '2026-09-09T00:00:00.000Z'
const reloadedServerVersion = '2026-09-09T00:02:00.000Z'
const fixture = getSafePreviewFixture(process.env)

test.use({ storageState: fixture.ready ? fixture.storageState : undefined })

type SpatialPrevisPayload = {
  version?: unknown
  masterTake?: {
    id?: unknown
    cameraTrack?: {
      keyframes?: Array<{ intent?: unknown }>
    }
  }
}

type CanvasSaveRequest = {
  baseUpdatedAt?: unknown
  workflowMetadata?: {
    spatialPrevis?: SpatialPrevisPayload
  }
}

type SaveOutcome = 'success' | 'conflict' | 'pending-success'

type CanvasApiOptions = {
  initialMetadata?: unknown
  reloadMetadata?: unknown
  nodes?: unknown[]
  saveOutcomes?: SaveOutcome[]
}

function reloadedSpatialPrevis() {
  return {
    spatialPrevis: {
      version: 1,
      projectId,
      scene: {
        sourceMode: 'manual',
        coverage: {
          mode: 'constrained',
          cameraFreedom: 'corridor-only',
          corridor: {
            min: { x: -12, y: 0, z: -12 },
            max: { x: 12, y: 12, z: 12 },
          },
        },
      },
      masterTake: {
        id: 'server-reloaded-take',
        durationSec: 30,
        aspectRatio: '16:9',
        actorTracks: [],
        cameraTrack: {
          id: 'server-reloaded-camera',
          keyframes: [
            { id: 'server-camera-start', timeSec: 0, position: { x: 0, y: 1.6, z: 8 }, target: { x: 0, y: 1.6, z: 0 }, focalLengthMm: 35, intent: 'static' },
            { id: 'server-camera-mid', timeSec: 15, position: { x: 0, y: 1.6, z: 8 }, target: { x: 0, y: 1.6, z: 0 }, focalLengthMm: 35, intent: 'static' },
            { id: 'server-camera-end', timeSec: 30, position: { x: 0, y: 1.6, z: 8 }, target: { x: 0, y: 1.6, z: 0 }, focalLengthMm: 35, intent: 'static' },
          ],
        },
        beats: [{ id: 'server-beat', label: '服务器节拍', startSec: 0, endSec: 30 }],
      },
      editorMode: 'beats',
      updatedAt: reloadedServerVersion,
    },
  }
}

function mediaNode() {
  return {
    id: 'e2e-media-node',
    type: 'image',
    kind: 'image',
    title: 'E2E Floating Review',
    subtitle: 'E2E source image',
    prompt: 'E2E source image',
    model: 'test-model',
    providerId: 'test-provider',
    stage: 'image',
    ratio: '16:9',
    status: 'done',
    resultImageUrl: 'https://example.test/e2e-floating-review.png',
    x: 80,
    y: 120,
    width: 320,
    height: 220,
    createdAt: 1,
  }
}

async function stubCanvasApis(page: Page, options: CanvasApiOptions = {}) {
  const saveRequests: CanvasSaveRequest[] = []
  let getCount = 0
  let releasePendingSave: (() => void) | null = null
  let markPendingSaveReady: (() => void) | null = null
  const pendingSaveReady = new Promise<void>((resolve) => { markPendingSaveReady = resolve })

  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname !== `/api/projects/${projectId}/canvas`) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, accounts: [], providers: [] }),
      })
      return
    }

    if (route.request().method() === 'GET') {
      getCount += 1
      const isReload = getCount > 1
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          project: { id: projectId, title: 'Spatial Previs E2E' },
          workflow: {
            id: workflowId,
            metadataJson: isReload ? (options.reloadMetadata ?? options.initialMetadata ?? {}) : (options.initialMetadata ?? {}),
            updatedAt: isReload ? reloadedServerVersion : initialServerVersion,
          },
          nodes: options.nodes ?? [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          serverUpdatedAt: isReload ? reloadedServerVersion : initialServerVersion,
        }),
      })
      return
    }

    if (route.request().method() !== 'PUT') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
      return
    }

    saveRequests.push(route.request().postDataJSON() as CanvasSaveRequest)
    const outcome = options.saveOutcomes?.[saveRequests.length - 1] ?? 'success'
    if (outcome === 'conflict') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          errorCode: 'CANVAS_SAVE_CONFLICT',
          details: { serverUpdatedAt: reloadedServerVersion },
        }),
      })
      return
    }
    if (outcome === 'pending-success') {
      await new Promise<void>((resolve) => {
        releasePendingSave = resolve
        markPendingSaveReady?.()
      })
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        savedAt: reloadedServerVersion,
        serverUpdatedAt: reloadedServerVersion,
      }),
    })
  })

  return {
    saveRequests,
    getCount: () => getCount,
    waitForPendingSave: () => pendingSaveReady,
    releasePendingSave: () => releasePendingSave?.(),
  }
}

async function openSpatialPrevis(page: Page) {
  await page.getByLabel('导演工具').click()
  await page.getByRole('button', { name: '空间预演' }).click()
  const viewport = page.locator('[data-spatial-previs-viewport="true"]')
  await expect(viewport).toBeVisible()
  return viewport
}

async function openFloatingMediaReview(page: Page) {
  await page.locator('[data-node-drag-root="true"][data-node-id="e2e-media-node"]').press('Enter')
  await page.getByRole('button', { name: '⊕ 资产', exact: true }).click()
  await page.getByRole('button', { name: '全屏预览', exact: true }).click()
  const review = page.locator('[data-node-preview-overlay="true"][aria-label="Image Preview"]')
  await expect(review).toBeVisible()
  return review
}

function canvasUrl() {
  const url = new URL('/create', fixture.baseUrl)
  url.searchParams.set('projectId', projectId)
  return url.toString()
}

test('spatial previs remains clickable above a floating review, receives wheel, and saves its accepted snapshot', async ({ page }) => {
  test.setTimeout(120_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }
  const canvasApi = await stubCanvasApis(page, {
    nodes: [mediaNode()],
    saveOutcomes: ['pending-success'],
  })

  await page.goto(canvasUrl(), { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-viewport')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })

  const review = await openFloatingMediaReview(page)
  const reviewZIndex = await review.evaluate((element) => Number(getComputedStyle(element).zIndex))
  expect(reviewZIndex).toBeGreaterThanOrEqual(2700)

  const viewport = await openSpatialPrevis(page)
  const overlay = page.locator('[data-spatial-previs-overlay="true"]')
  await expect(overlay).toHaveCSS('z-index', '3000')
  expect(await overlay.evaluate((element) => Number(getComputedStyle(element).zIndex))).toBeGreaterThan(reviewZIndex)

  const sceneCanvas = viewport.locator('canvas').first()
  await expect(sceneCanvas).toBeVisible()
  const wheelReachedCanvas = await sceneCanvas.evaluate((element) => new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (reachedCanvas: boolean) => {
      if (settled) return
      settled = true
      resolve(reachedCanvas)
    }
    element.addEventListener('wheel', () => finish(true), { once: true })
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -80 }))
    window.requestAnimationFrame(() => finish(false))
  }))
  expect(wheelReachedCanvas).toBe(true)

  await viewport.getByLabel('跟拍').click()
  await page.getByRole('tab', { name: '剧情节拍' }).click()
  expect(canvasApi.saveRequests).toHaveLength(0)
  await page.getByRole('button', { name: '保存预演' }).click()

  const editor = page.locator('[data-master-take-id="master-take"][aria-busy]')
  await expect(editor).toHaveAttribute('aria-busy', 'true')
  await expect(viewport.getByLabel('跟拍')).toBeDisabled()
  await expect(page.getByRole('tab', { name: '连续走位' })).toBeDisabled()
  await expect(page.getByLabel('相机位置 X')).toHaveAttribute('readonly', '')
  expect(canvasApi.saveRequests).toHaveLength(1)
  expect(canvasApi.saveRequests[0]?.workflowMetadata?.spatialPrevis?.version).toBe(1)
  expect(canvasApi.saveRequests[0]?.workflowMetadata?.spatialPrevis?.masterTake?.cameraTrack?.keyframes?.[0]?.intent).toBe('follow')

  await canvasApi.waitForPendingSave()
  canvasApi.releasePendingSave()
  await expect(page.getByRole('status')).toHaveText('预演已保存')
})

test('spatial previs exposes reload after a save conflict and rehydrates from the authenticated canvas GET', async ({ page }) => {
  test.setTimeout(120_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }
  const canvasApi = await stubCanvasApis(page, {
    reloadMetadata: reloadedSpatialPrevis(),
    saveOutcomes: ['conflict', 'success'],
  })

  await page.goto(canvasUrl(), { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-viewport')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })

  const viewport = await openSpatialPrevis(page)
  await viewport.getByLabel('跟拍').click()
  await page.getByRole('button', { name: '保存预演' }).click()

  await expect(page.getByText('保存冲突：服务器预演已更新，未覆盖服务器数据。')).toBeVisible()
  await expect(page.getByRole('button', { name: '重新加载预演' })).toBeVisible()
  expect(canvasApi.saveRequests).toHaveLength(1)
  await expect(page.getByRole('status', { name: '预演已保存' })).toHaveCount(0)

  await page.getByRole('button', { name: '重新加载预演' }).click()
  await expect(page.locator('[data-master-take-id="server-reloaded-take"][aria-busy]')).toBeVisible()
  await expect(page.getByText('保存冲突：服务器预演已更新，未覆盖服务器数据。')).toHaveCount(0)
  expect(canvasApi.getCount()).toBe(2)

  await viewport.getByLabel('跟拍').click()
  await page.getByRole('button', { name: '保存预演' }).click()
  await expect(page.getByRole('status')).toHaveText('预演已保存')
  expect(canvasApi.saveRequests).toHaveLength(2)
  expect(canvasApi.saveRequests[1]?.baseUpdatedAt).toBe(reloadedServerVersion)
  expect(canvasApi.saveRequests[1]?.workflowMetadata?.spatialPrevis?.masterTake?.id).toBe('server-reloaded-take')
})
