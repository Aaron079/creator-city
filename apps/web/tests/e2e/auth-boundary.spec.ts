import { expect, test } from '@playwright/test'
import {
  findForbiddenMutationRequests,
  type RequestEvidence,
} from './support/canvas-e2e-safety'

test('unauthenticated Canvas preflight redirects without forbidden mutations', async ({ page }) => {
  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []

  page.on('request', (request) => {
    requests.push({
      method: request.method(),
      pathname: new URL(request.url()).pathname,
    })
  })
  page.on('pageerror', (error) => pageErrors.push(error.name))

  await page.goto('/create', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/auth\/login/)
  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})
