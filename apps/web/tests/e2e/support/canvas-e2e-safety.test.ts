import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  findForbiddenMutationRequests,
  getCanvasE2EBaseUrl,
  getSafePreviewFixture,
  isProductionCanvasUrl,
} from './canvas-e2e-safety'

describe('canvas e2e safety', () => {
  test('uses a local base URL by default', () => {
    assert.equal(getCanvasE2EBaseUrl({}).origin, 'http://127.0.0.1:3000')
  })

  test('recognizes the production Canvas domain', () => {
    assert.equal(isProductionCanvasUrl('https://creator-city-vert.vercel.app'), true)
    assert.equal(isProductionCanvasUrl('https://preview.example.vercel.app'), false)
  })

  test('requires every isolated Preview fixture value before writes', () => {
    assert.equal(getSafePreviewFixture({}).ready, false)
    assert.equal(getSafePreviewFixture({
      PLAYWRIGHT_BASE_URL: 'https://preview.example.vercel.app',
      PLAYWRIGHT_STORAGE_STATE: '/tmp/state.json',
      PLAYWRIGHT_SAFE_PROJECT_ID: 'safe-project',
      PLAYWRIGHT_ALLOW_SAFE_WRITES: '1',
    }).ready, false)
  })

  test('rejects a production URL even when every other fixture value exists', () => {
    assert.equal(getSafePreviewFixture({
      PLAYWRIGHT_BASE_URL: 'https://creator-city-vert.vercel.app',
      PLAYWRIGHT_SAFE_ENV: 'preview',
      PLAYWRIGHT_STORAGE_STATE: '/tmp/state.json',
      PLAYWRIGHT_SAFE_PROJECT_ID: 'safe-project',
      PLAYWRIGHT_ALLOW_SAFE_WRITES: '1',
    }).ready, false)
  })

  test('accepts only a complete non-production Preview fixture', () => {
    const fixture = getSafePreviewFixture({
      PLAYWRIGHT_BASE_URL: 'https://preview.example.vercel.app',
      PLAYWRIGHT_SAFE_ENV: 'preview',
      PLAYWRIGHT_STORAGE_STATE: '/tmp/state.json',
      PLAYWRIGHT_SAFE_PROJECT_ID: 'safe-project',
      PLAYWRIGHT_ALLOW_SAFE_WRITES: '1',
    })

    assert.equal(fixture.ready, true)
    if (fixture.ready) {
      assert.equal(fixture.baseUrl.origin, 'https://preview.example.vercel.app')
      assert.equal(fixture.projectId, 'safe-project')
    }
  })

  test('flags forbidden mutations but permits read-only requests', () => {
    assert.deepEqual(findForbiddenMutationRequests([
      { method: 'POST', pathname: '/api/generate/image' },
      { method: 'GET', pathname: '/api/generate/image/status' },
      { method: 'HEAD', pathname: '/api/payment/china/status' },
      { method: 'POST', pathname: '/api/projects/example/canvas' },
      { method: 'POST', pathname: '/api/credits/manual-recharge' },
    ]), [
      { method: 'POST', pathname: '/api/generate/image' },
      { method: 'POST', pathname: '/api/credits/manual-recharge' },
    ])
  })
})
