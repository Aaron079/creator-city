/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  addSpatialSceneReference,
  removeSpatialSceneReference,
  spatialSceneReferenceFromProjectAsset,
  SpatialPrevisSceneAssets,
} from './SpatialPrevisSceneAssets'

Object.assign(globalThis, { React })

const props = {
  projectId: 'project-previs-01',
  references: [],
  disabled: false,
  onReferencesChange: () => undefined,
  onUpload: async () => ({
    id: 'scene-upload-01',
    assetId: 'asset-upload-01',
    title: 'Scene upload',
    mediaType: 'image' as const,
    url: '/api/assets/asset-upload-01/file',
    source: 'upload' as const,
  }),
}

test('renders one compact scene-assets entry instead of a persistent asset panel', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisSceneAssets, props))

  assert.equal((markup.match(/aria-label="添加场景资产"/g) ?? []).length, 1)
  assert.match(markup, /data-scene-asset-dropzone="true"/)
  assert.doesNotMatch(markup, /项目素材\s*<\/h2>/)
})

test('maps safe project media assets and updates selected references without duplicates', () => {
  const reference = spatialSceneReferenceFromProjectAsset({
    id: 'asset-video-01',
    title: '  Establishing take  ',
    type: 'video',
    url: 'storage://creator-city-assets/project-previs-01/establishing.mp4',
  })

  assert.deepEqual(reference, {
    id: 'scene-project-asset-video-01',
    assetId: 'asset-video-01',
    title: 'Establishing take',
    mediaType: 'video',
    url: '/api/assets/asset-video-01/file',
    source: 'project',
  })
  assert.equal(spatialSceneReferenceFromProjectAsset({
    id: 'asset-audio-01',
    title: 'Room tone',
    type: 'audio',
    url: 'https://cdn.example.test/room-tone.mp3',
  }), null)

  assert.ok(reference)
  const selected = addSpatialSceneReference([], reference)
  assert.equal(addSpatialSceneReference(selected, reference), selected)
  assert.deepEqual(removeSpatialSceneReference(selected, reference.id), [])
})
