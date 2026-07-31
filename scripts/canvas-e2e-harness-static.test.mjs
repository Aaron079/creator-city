import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const configPath = new URL('../apps/web/playwright.canvas.config.ts', import.meta.url)
const preflightPath = new URL('../apps/web/tests/e2e/auth-boundary.spec.ts', import.meta.url)
const previewPath = new URL('../apps/web/tests/e2e/canvas-safe-preview.spec.ts', import.meta.url)

test('canvas e2e config isolates browser discovery from unit tests', async () => {
  const config = await readFile(configPath, 'utf8')

  assert.match(config, /testDir: '\.\/tests\/e2e'/)
  assert.match(config, /outputDir: '\/tmp\/creator-city-canvas-e2e'/)
  assert.doesNotMatch(config, /tests\/p0-create-media-and-drag/)
})

test('credential-free preflight records only safe network evidence', async () => {
  const preflight = await readFile(preflightPath, 'utf8')

  assert.match(preflight, /findForbiddenMutationRequests/)
  assert.match(preflight, /pathname: new URL\(request\.url\(\)\)\.pathname/)
  assert.doesNotMatch(preflight, /CREATOR_CITY_E2E_EMAIL|CREATOR_CITY_E2E_PASSWORD/)
  assert.doesNotMatch(preflight, /\.fill\(|\.type\(/)
})

test('Preview save coverage fails closed before any navigation', async () => {
  const preview = await readFile(previewPath, 'utf8')

  assert.match(preview, /getSafePreviewFixture/)
  assert.match(preview, /if \(!fixture\.ready\)/)
  assert.match(preview, /test\.skip\(true, fixture\.reason\)/)
  assert.match(preview, /storageState: fixture\.ready \? fixture\.storageState : undefined/)
  assert.match(preview, /findForbiddenMutationRequests/)
  assert.doesNotMatch(preview, /CREATOR_CITY_E2E_EMAIL|CREATOR_CITY_E2E_PASSWORD/)
})
