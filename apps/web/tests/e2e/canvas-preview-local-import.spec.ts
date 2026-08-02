import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import {
  findForbiddenMutationRequests,
  getSafePreviewRegistrationFixture,
  type RequestEvidence,
} from './support/canvas-e2e-safety'

const fixture = getSafePreviewRegistrationFixture(process.env)

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
  await expect(page).toHaveURL(/\/create/)
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
  await dropCanvasFixtureImage(page)

  const imagePreview = page.getByTestId('media-preview-image')
  await expect(imagePreview).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '保存到云端' }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('media-preview-image')).toBeVisible({ timeout: 30_000 })

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})
