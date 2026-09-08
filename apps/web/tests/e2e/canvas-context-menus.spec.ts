import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { getSafePreviewRegistrationFixture } from './support/canvas-e2e-safety'

const fixture = getSafePreviewRegistrationFixture(process.env)

async function registerIsolatedPreviewUser(page: Page) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const email = `canvas-context-${suffix}@example.test`
  const password = `${randomUUID()}Aa1!`

  await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.getByPlaceholder('Alice Chen').fill('Canvas Context Menu QA')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('最少 8 位字符').fill(password)
  await page.getByPlaceholder('再次输入密码').fill(password)
  await page.getByRole('button', { name: '创建账号' }).click()
  await expect(page).toHaveURL(/\/create\?projectId=[^&]+/, { timeout: 30_000 })
  await expect(page.locator('.canvas-viewport').last()).toBeVisible({ timeout: 30_000 })
}

async function findBlankCanvasPoint(page: Page) {
  return page.locator('.canvas-viewport').last().evaluate((viewport) => {
    const rect = viewport.getBoundingClientRect()
    const excluded = [
      '.canvas-node-card',
      '.canvas-node-dialog',
      '.canvas-context-menu',
      '.canvas-canvas-context-menu',
      '.canvas-node-add-menu',
      '.canvas-node-create-menu',
      '.canvas-topbar',
      '.canvas-toolbar-shell',
      '.canvas-zoom-controls',
      '[aria-label="打开 Creator City Agent"]',
    ].join(', ')

    for (const yRatio of [0.22, 0.42, 0.62, 0.78]) {
      for (const xRatio of [0.2, 0.4, 0.6, 0.78]) {
        const x = rect.left + rect.width * xRatio
        const y = rect.top + rect.height * yRatio
        const target = document.elementFromPoint(x, y) as HTMLElement | null
        if (target?.closest('.canvas-viewport') && !target.closest(excluded)) {
          return { x, y }
        }
      }
    }

    throw new Error('Unable to locate an unobstructed blank canvas point')
  })
}

async function createTextNode(page: Page) {
  await page.getByLabel('添加节点').click()
  await expect(page.locator('.canvas-add-menu')).toBeVisible()
  await page.locator('.canvas-add-menu').getByRole('button', { name: /^文本/ }).click()
  const node = page.locator('.canvas-node-card').first()
  await expect(node).toBeVisible()
  return node
}

test('right-clicking a node opens a usable node context menu', async ({ page }) => {
  test.setTimeout(90_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  await registerIsolatedPreviewUser(page)
  const node = await createTextNode(page)
  await node.click({ button: 'right', position: { x: 24, y: 24 } })

  const nodeMenu = page.locator('.canvas-context-menu')
  await expect(nodeMenu).toBeVisible()
  await expect(nodeMenu.getByRole('button', { name: '打开任务' })).toBeVisible()
  await nodeMenu.getByRole('button', { name: '复制节点' }).click()

  await node.click({ button: 'right', position: { x: 24, y: 24 } })
  await nodeMenu.getByRole('button', { name: '打开任务' }).click()
  await expect(page.locator('.canvas-node-dialog')).toBeVisible()
})

test('right-clicking blank Canvas opens a usable canvas context menu', async ({ page }) => {
  test.setTimeout(90_000)
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  await registerIsolatedPreviewUser(page)
  const node = await createTextNode(page)
  await node.click({ button: 'right', position: { x: 24, y: 24 } })
  const nodeMenu = page.locator('.canvas-context-menu')
  await nodeMenu.getByRole('button', { name: '复制节点' }).click()

  const blankPoint = await findBlankCanvasPoint(page)
  await page.mouse.click(blankPoint.x, blankPoint.y, { button: 'right' })

  const canvasMenu = page.locator('.canvas-canvas-context-menu')
  await expect(canvasMenu).toBeVisible()
  const upload = canvasMenu.getByRole('button', { name: '上传素材' })
  await expect(upload).toBeVisible()
  const fileChooserPromise = page.waitForEvent('filechooser')
  await upload.click()
  await fileChooserPromise

  await page.mouse.click(blankPoint.x, blankPoint.y, { button: 'right' })
  await expect(canvasMenu).toBeVisible()
  const paste = canvasMenu.getByRole('button', { name: '粘贴节点' })
  await expect(paste).toBeEnabled()
  const countBeforePaste = await page.locator('.canvas-node-card').count()
  await paste.click()
  await expect(page.locator('.canvas-node-card')).toHaveCount(countBeforePaste + 1)
})
