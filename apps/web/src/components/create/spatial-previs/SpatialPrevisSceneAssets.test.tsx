/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SpatialSceneReference } from '@/lib/spatial-previs/types'
import * as sceneAssetsModule from './SpatialPrevisSceneAssets'
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

test('summarizes the first selected scene asset and asset count in its compact control', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisSceneAssets, {
    ...props,
    references: [
      {
        id: 'scene-project-01',
        assetId: 'asset-01',
        title: 'Rain-soaked alley',
        mediaType: 'image',
        url: '/api/assets/asset-01/file',
        source: 'project',
      },
      {
        id: 'scene-project-02',
        assetId: 'asset-02',
        title: 'Close-up reference',
        mediaType: 'video',
        url: '/api/assets/asset-02/file',
        source: 'project',
      },
    ],
  }))
  const compactControl = markup.match(/<button[^>]*aria-label="添加场景资产"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? ''

  assert.match(compactControl, /Rain-soaked alley/)
  assert.match(compactControl, /2 assets/)
  assert.doesNotMatch(compactControl, /Scene assets|Close-up reference/)
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

test('merges a completed upload into references current after the upload starts', () => {
  type UploadMerge = (references: readonly SpatialSceneReference[], reference: SpatialSceneReference) => SpatialSceneReference[]
  const mergeUploadedSpatialSceneReference = (sceneAssetsModule as unknown as {
    mergeUploadedSpatialSceneReference?: UploadMerge
  }).mergeUploadedSpatialSceneReference
  const referencesAtUploadStart: SpatialSceneReference[] = [{
    id: 'scene-project-removed',
    assetId: 'asset-removed',
    title: 'Removed while uploading',
    mediaType: 'image',
    url: '/api/assets/asset-removed/file',
    source: 'project',
  }]
  const latestReferences: SpatialSceneReference[] = [{
    id: 'scene-project-added',
    assetId: 'asset-added',
    title: 'Added while uploading',
    mediaType: 'video',
    url: '/api/assets/asset-added/file',
    source: 'project',
  }]
  const uploadedReference: SpatialSceneReference = {
    id: 'scene-upload-finished',
    assetId: 'asset-upload-finished',
    title: 'Completed upload',
    mediaType: 'image',
    url: '/api/assets/asset-upload-finished/file',
    source: 'upload',
  }

  assert.notDeepEqual(latestReferences, referencesAtUploadStart)
  assert.equal(typeof mergeUploadedSpatialSceneReference, 'function')
  assert.deepEqual(mergeUploadedSpatialSceneReference?.(latestReferences, uploadedReference), [
    latestReferences[0],
    uploadedReference,
  ])
})

test('closes scene-asset interactions while an upload is in progress', () => {
  type InteractionGate = (disabled: boolean, isUploading: boolean) => boolean
  const isSceneAssetInteractionDisabled = (sceneAssetsModule as unknown as {
    isSceneAssetInteractionDisabled?: InteractionGate
  }).isSceneAssetInteractionDisabled

  assert.equal(typeof isSceneAssetInteractionDisabled, 'function')
  assert.equal(isSceneAssetInteractionDisabled?.(false, false), false)
  assert.equal(isSceneAssetInteractionDisabled?.(true, false), true)
  assert.equal(isSceneAssetInteractionDisabled?.(false, true), true)
})
