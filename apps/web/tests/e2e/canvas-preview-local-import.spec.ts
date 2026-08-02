import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import {
  findForbiddenMutationRequests,
  getSafePreviewRegistrationFixture,
  type RequestEvidence,
} from './support/canvas-e2e-safety'

const fixture = getSafePreviewRegistrationFixture(process.env)

test.describe.configure({ mode: 'serial' })

async function registerIsolatedPreviewUser(page: Page) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const email = `canvas-import-${suffix}@example.test`
  const password = `${randomUUID()}Aa1!`

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      break
    } catch (error) {
      if (attempt === 1) throw error
      await page.waitForTimeout(1_000)
    }
  }
  await page.getByPlaceholder('Alice Chen').fill('Canvas Preview QA')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('最少 8 位字符').fill(password)
  await page.getByPlaceholder('再次输入密码').fill(password)
  await page.getByRole('button', { name: '创建账号' }).click()
  await expect(page).toHaveURL(/\/create\?projectId=[^&]+/, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })
}

async function dropCanvasFixtureImage(page: Page) {
  const transfer = await page.evaluateHandle(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas fixture context unavailable')
    context.fillStyle = '#171a24'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#65d8ff'
    context.fillRect(48, 48, 250, 180)
    context.fillStyle = '#f1b95c'
    context.fillRect(342, 132, 250, 180)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Canvas fixture serialization failed')), 'image/png')
    })
    const value = new DataTransfer()
    value.items.add(new File([blob], 'preview-canvas-source.png', { type: 'image/png' }))
    return value
  })
  const viewport = page.locator('.canvas-viewport').last()
  await viewport.dispatchEvent('dragenter', { dataTransfer: transfer })
  await viewport.dispatchEvent('dragover', { dataTransfer: transfer })
  await viewport.dispatchEvent('drop', { dataTransfer: transfer })
}

async function openStoryboardReferenceExtractor(page: Page) {
  const imagePreview = page.getByTestId('media-preview-image')
  await imagePreview.click()
  const toolsButton = page.locator('button.asset-agent-btn[title="工具"]')
  await expect(toolsButton).toHaveCount(1)
  await expect(toolsButton).toBeVisible()
  const toolsButtonBox = await toolsButton.boundingBox()
  if (!toolsButtonBox) throw new Error('Asset tool button is unavailable')
  expect(toolsButtonBox.x).toBeGreaterThanOrEqual(0)
  expect(toolsButtonBox.y).toBeGreaterThanOrEqual(0)
  expect(toolsButtonBox.x + toolsButtonBox.width).toBeLessThanOrEqual(1280)
  expect(toolsButtonBox.y + toolsButtonBox.height).toBeLessThanOrEqual(720)
  await toolsButton.click({ timeout: 10_000 })
  const extractorButton = page.getByRole('button', { name: '分镜参考提取' })
  await expect(extractorButton).toBeVisible()
  await extractorButton.click()
  await expect(page.getByTestId('storyboard-reference-extractor-panel')).toBeVisible()
}

async function selectStoryboardReferenceRegion(page: Page) {
  const canvas = page.getByTestId('storyboard-reference-selection-canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Storyboard reference selection canvas is unavailable')
  await page.mouse.move(box.x + box.width * 0.14, box.y + box.height * 0.18)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.72)
  await page.mouse.up()
}

async function importVisibleFixtureImage(page: Page) {
  const imagePreview = page.getByTestId('media-preview-image')
  await dropCanvasFixtureImage(page)
  await expect(imagePreview).toBeVisible({ timeout: 70_000 })
}

async function createLocalStoryboardSource(page: Page) {
  const nodes = page.locator('.canvas-node-card')
  const initialNodeCount = await nodes.count()
  await page.getByRole('button', { name: '添加节点' }).click()
  await page.locator('.canvas-add-menu').getByRole('button', { name: /^文本/ }).click()
  await expect(nodes).toHaveCount(initialNodeCount + 1)

  const sourceNode = nodes.last()
  await sourceNode.locator('.canvas-node-empty.empty-text').click()
  await page.getByPlaceholder('描述这个节点要生成的内容').fill(
    '雨夜的城市天桥上，主角停下脚步，远处列车穿过霓虹灯。镜头从远景缓慢推进到近景，最后定格在她的表情。',
  )
  await page.getByRole('button', { name: '关闭节点面板' }).click()
  return sourceNode
}

async function openLocalStoryboardDirector(page: Page, sourceNode: ReturnType<Page['locator']>) {
  const toolsButton = page.locator('button.asset-agent-btn[title="工具"]')
  if (await toolsButton.count() === 0) {
    await sourceNode.click()
    await expect(page.getByRole('button', { name: '关闭节点面板' })).toBeVisible()
    await page.getByRole('button', { name: '关闭节点面板' }).click()
  }
  await expect(toolsButton).toHaveCount(1)
  await toolsButton.click()
  await page.getByRole('button', { name: '分镜导演' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Storyboard Director' })).toBeVisible()
}

test('isolated Preview imports a local image into a persistent source asset node', async ({ page }) => {
  test.setTimeout(90_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []
  page.on('request', (request) => requests.push({ method: request.method(), pathname: new URL(request.url()).pathname }))
  page.on('pageerror', (error) => pageErrors.push(error.name))

  await registerIsolatedPreviewUser(page)
  await expect(page.getByText('正在打开项目...')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('.canvas-viewport').last()).toBeVisible()
  await importVisibleFixtureImage(page)

  await page.getByRole('button', { name: '保存到云端' }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('media-preview-image')).toBeVisible({ timeout: 30_000 })

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})

test('isolated Preview extracts a freeform reference into a visible persisted node', async ({ page }) => {
  test.setTimeout(180_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []
  page.on('request', (request) => requests.push({ method: request.method(), pathname: new URL(request.url()).pathname }))
  page.on('pageerror', (error) => pageErrors.push(error.name))

  await registerIsolatedPreviewUser(page)
  await expect(page.locator('.canvas-viewport').last()).toBeVisible({ timeout: 30_000 })
  await importVisibleFixtureImage(page)
  await openStoryboardReferenceExtractor(page)
  await selectStoryboardReferenceRegion(page)
  await page.getByRole('button', { name: '确认提取' }).click()
  await expect(page.getByText('参考图已按顺序保存。')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('media-preview-image')).toHaveCount(2, { timeout: 30_000 })
  await page.getByRole('button', { name: '关闭分镜参考提取' }).click()
  await expect(page.getByTestId('storyboard-reference-extractor-panel')).toHaveCount(0)
  await page.getByRole('button', { name: '保存到云端' }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('media-preview-image')).toHaveCount(2, { timeout: 30_000 })

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})

test('isolated Preview persists a local storyboard sketch board through refresh', async ({ page }) => {
  test.setTimeout(180_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []
  page.on('request', (request) => requests.push({ method: request.method(), pathname: new URL(request.url()).pathname }))
  page.on('pageerror', (error) => pageErrors.push(error.name))

  await registerIsolatedPreviewUser(page)
  await expect(page.locator('.canvas-viewport').last()).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => (
    window.localStorage.getItem('creator-city:last-workflow-id')
  ))).not.toBeNull()
  const sourceNode = await createLocalStoryboardSource(page)
  await openLocalStoryboardDirector(page, sourceNode)

  const approveCurrentStage = page.getByRole('button', { name: '批准当前阶段' })
  await approveCurrentStage.click()
  await approveCurrentStage.click()
  await approveCurrentStage.click()

  await page.getByRole('button', { name: '生成本地草图分镜' }).click()
  await expect(page.getByRole('heading', { name: '本地草图分镜' })).toBeVisible()
  await page.getByLabel('镜头 1 运镜').selectOption('dolly')
  await page.getByRole('button', { name: '恢复本地推演镜头 1' }).click()
  await page.getByRole('button', { name: '关闭分镜导演' }).click()

  await page.getByRole('button', { name: '保存到云端' }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-viewport').last()).toBeVisible({ timeout: 30_000 })

  const restoredSource = page.locator('.canvas-node-card').filter({ hasText: '雨夜的城市天桥上' }).first()
  await expect(restoredSource).toBeVisible()
  await openLocalStoryboardDirector(page, restoredSource)
  await expect(page.getByRole('heading', { name: '本地草图分镜' })).toBeVisible()

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})
