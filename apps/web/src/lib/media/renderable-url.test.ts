import assert from 'node:assert/strict'
import test from 'node:test'
import { filterRenderableMediaUrlSources, isRenderableMediaUrl } from './renderable-url'

test('allows only the local asset file proxy as a relative media URL', () => {
  const assetUrl = '/api/assets/asset-123/file'

  assert.equal(isRenderableMediaUrl(assetUrl, { source: 'resultImageUrl' }).ok, true)
  assert.deepEqual(
    filterRenderableMediaUrlSources([
      { source: 'resultImageUrl', url: assetUrl },
      { source: 'resultImageUrl', url: '/api/projects/project-123/canvas' },
    ]),
    [{ source: 'resultImageUrl', url: assetUrl }],
  )
})
