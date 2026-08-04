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
  const email = `canvas-tool-${suffix}@example.test`
  const password = `${randomUUID()}Aa1!`

  await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.getByPlaceholder('Alice Chen').fill('Canvas Tool Preview QA')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('最少 8 位字符').fill(password)
  await page.getByPlaceholder('再次输入密码').fill(password)
  await page.getByRole('button', { name: '创建账号' }).click()
  await expect(page).toHaveURL(/\/create\?projectId=[^&]+/, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.canvas-viewport').last()).toBeVisible()
}

async function importFixtureImage(page: Page) {
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
    value.items.add(new File([blob], 'preview-tool-source.png', { type: 'image/png' }))
    return value
  })
  const viewport = page.locator('.canvas-viewport').last()
  await viewport.dispatchEvent('dragenter', { dataTransfer: transfer })
  await viewport.dispatchEvent('dragover', { dataTransfer: transfer })
  await viewport.dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByTestId('media-preview-image')).toBeVisible({ timeout: 70_000 })
}

function recordRequests(page: Page) {
  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []
  page.on('request', (request) => requests.push({
    method: request.method(),
    pathname: new URL(request.url()).pathname,
  }))
  page.on('pageerror', (error) => pageErrors.push(error.name))
  return { requests, pageErrors }
}

function canvasPutCount(requests: readonly RequestEvidence[]) {
  return requests.filter((request) => (
    request.method === 'PUT' && /^\/api\/projects\/[^/]+\/canvas$/.test(request.pathname)
  )).length
}

async function selectImportedImage(page: Page) {
  const image = page.getByTestId('media-preview-image')
  await expect(image).toHaveCount(1)
  await image.click()
  await expect(page.locator('button.asset-agent-btn[title="工具"]')).toHaveCount(1)
}

async function openDirectorTool(page: Page, label: string) {
  await page.getByLabel('导演工具').click()
  await page.getByRole('button', { name: label }).click()
}

async function addTextNodes(page: Page, target: number) {
  const nodes = page.locator('.canvas-node-card')
  while (await nodes.count() < target) {
    await page.getByLabel('添加节点').click()
    await expect(page.locator('.canvas-add-menu')).toBeVisible()
    await page.locator('.canvas-add-menu').getByRole('button', { name: /^文本/ }).click()
  }
  await expect(nodes).toHaveCount(target)
}

test('isolated Preview creates, saves, and restores Camera and Lighting draft nodes without generation', async ({ page }) => {
  test.setTimeout(180_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const { requests, pageErrors } = recordRequests(page)
  await registerIsolatedPreviewUser(page)
  await importFixtureImage(page)
  await selectImportedImage(page)

  await page.locator('button.asset-agent-btn[title="工具"]').click()
  await page.getByRole('button', { name: /摄影机控制/ }).last().click()
  const cameraPanel = page.getByRole('dialog', { name: '摄影机控制 / Camera Control' })
  await expect(cameraPanel).toBeVisible()
  await expect(cameraPanel.getByText('来源素材')).toBeVisible()
  await cameraPanel.getByLabel('下一项').first().click()
  await expect(cameraPanel.getByText('1 项已设定')).toBeVisible()
  await cameraPanel.getByRole('button', { name: '创建摄影版本' }).click()
  await expect(page.locator('.canvas-node-card')).toHaveCount(2)
  await page.getByRole('button', { name: '关闭节点面板' }).click()

  await selectImportedImage(page)
  await page.locator('button.asset-agent-btn[title="工具"]').click()
  await page.getByRole('button', { name: /场景光线/ }).click()
  const lightingPanel = page.getByRole('dialog', { name: '场景光线控制 / Lighting & Atmosphere' })
  await expect(lightingPanel).toBeVisible()
  await expect(lightingPanel.getByText('来源素材')).toBeVisible()
  await lightingPanel.getByLabel('下一项').first().click()
  await expect(lightingPanel.getByText('1 项已设定')).toBeVisible()
  await lightingPanel.getByRole('button', { name: '创建光线版本' }).click()
  await expect(page.locator('.canvas-node-card')).toHaveCount(3)
  await page.getByRole('button', { name: '关闭节点面板' }).click()

  const putsBeforeSave = canvasPutCount(requests)
  await page.getByRole('button', { name: '保存到云端' }).click()
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })
  expect(canvasPutCount(requests) - putsBeforeSave).toBe(1)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-node-card')).toHaveCount(3, { timeout: 30_000 })

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})

test('isolated Preview keeps the node toolbar and director menu navigable at the viewport boundary', async ({ page }) => {
  test.setTimeout(120_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const { requests, pageErrors } = recordRequests(page)
  await registerIsolatedPreviewUser(page)
  await importFixtureImage(page)
  await selectImportedImage(page)

  const toolbarButtons = page.locator('button.asset-agent-btn')
  await expect(toolbarButtons).toHaveCount(3)
  for (const button of [
    page.locator('button.asset-agent-btn[title="打开任务面板"]'),
    page.locator('button.asset-agent-btn[title="工具"]'),
    page.locator('button.asset-agent-btn[title="资产"]'),
  ]) {
    await expect(button).toBeVisible()
    const box = await button.boundingBox()
    if (!box) throw new Error('Node toolbar button is unavailable')
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(1280)
    expect(box.y + box.height).toBeLessThanOrEqual(720)
  }

  await page.locator('button.asset-agent-btn[title="工具"]').click()
  await expect(page.getByText('推荐下一步')).toBeVisible()
  await expect(page.getByText('提示词与导演参数')).toBeVisible()
  await expect(page.getByText('画面编辑')).toBeVisible()
  await expect(page.getByText('分析与预览')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('推荐下一步')).toHaveCount(0)

  await page.locator('button.asset-agent-btn[title="资产"]').click()
  await expect(page.getByText('重构图')).toBeVisible()
  await expect(page.getByText('分镜工具')).toBeVisible()
  await expect(page.getByText('资产记录')).toBeVisible()
  await page.keyboard.press('Escape')

  await openDirectorTool(page, '镜头编排器')
  const sequencer = page.getByRole('dialog', { name: /镜头编排器/ })
  await expect(sequencer).toBeVisible()
  await expect(sequencer.getByText('暂无镜头')).toBeVisible()
  await sequencer.getByRole('button', { name: '取消' }).click()
  await expect(sequencer).toHaveCount(0)

  expect(canvasPutCount(requests)).toBe(0)
  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})

test('isolated Preview Shot Sequencer persists through an independent authenticated browser context', async ({ page, browser }) => {
  test.setTimeout(180_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const first = recordRequests(page)
  await registerIsolatedPreviewUser(page)
  await importFixtureImage(page)
  await page.getByRole('button', { name: '保存到云端' }).click()
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })

  await openDirectorTool(page, '镜头编排器')
  let sequencer = page.getByRole('dialog', { name: /镜头编排器/ })
  await sequencer.getByRole('button', { name: '从画布添加' }).click()
  const availableNode = sequencer.locator('[role="button"]')
  await expect(availableNode).toHaveCount(1)
  await availableNode.click()
  await sequencer.getByRole('button', { name: /完成选择/ }).click()
  const putsBeforeSequenceSave = canvasPutCount(first.requests)
  await sequencer.getByRole('button', { name: '保存顺序' }).click()
  await expect(sequencer).toHaveCount(0)
  expect(canvasPutCount(first.requests) - putsBeforeSequenceSave).toBe(1)

  const projectUrl = page.url()
  const storageState = await page.context().storageState()
  const independentContext = await browser.newContext({ storageState: { ...storageState, origins: [] } })
  const secondPage = await independentContext.newPage()
  const second = recordRequests(secondPage)

  try {
    await secondPage.goto(projectUrl, { waitUntil: 'domcontentloaded' })
    await expect(secondPage.locator('.canvas-viewport').last()).toBeVisible({ timeout: 30_000 })
    await openDirectorTool(secondPage, '镜头编排器')
    sequencer = secondPage.getByRole('dialog', { name: /镜头编排器/ })
    await expect(sequencer.getByText('1 个镜头')).toBeVisible()
    await sequencer.getByLabel('移除').click()
    const putsBeforeRemovalSave = canvasPutCount(second.requests)
    await sequencer.getByRole('button', { name: '保存顺序' }).click()
    await expect(sequencer).toHaveCount(0)
    expect(canvasPutCount(second.requests) - putsBeforeRemovalSave).toBe(1)
  } finally {
    await independentContext.close()
  }

  await page.reload({ waitUntil: 'domcontentloaded' })
  await openDirectorTool(page, '镜头编排器')
  sequencer = page.getByRole('dialog', { name: /镜头编排器/ })
  await expect(sequencer.getByText('暂无镜头')).toBeVisible()
  await sequencer.getByRole('button', { name: '取消' }).click()

  expect(findForbiddenMutationRequests(first.requests)).toEqual([])
  expect(first.pageErrors).toEqual([])
  expect(findForbiddenMutationRequests(second.requests)).toEqual([])
  expect(second.pageErrors).toEqual([])
})

test('isolated Preview handles 20, 50, and 100 nodes without automatic Canvas PUTs', async ({ page }) => {
  test.setTimeout(240_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const { requests, pageErrors } = recordRequests(page)
  await registerIsolatedPreviewUser(page)

  const startedAt = Date.now()
  const checkpoints: Array<{ nodes: number; elapsedMs: number }> = []
  for (const nodeCount of [20, 50, 100]) {
    await addTextNodes(page, nodeCount)
    checkpoints.push({ nodes: nodeCount, elapsedMs: Date.now() - startedAt })
    expect(canvasPutCount(requests)).toBe(0)
  }
  console.info(`[canvas-scale-preview] ${JSON.stringify(checkpoints)}`)

  const putsBeforeSave = canvasPutCount(requests)
  await page.getByRole('button', { name: '保存到云端' }).click()
  await expect(page.getByRole('button', { name: '已同步到云端' })).toBeVisible({ timeout: 30_000 })
  expect(canvasPutCount(requests) - putsBeforeSave).toBe(1)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-node-card')).toHaveCount(100, { timeout: 30_000 })

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})
