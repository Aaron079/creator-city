import assert from 'node:assert/strict'
import test from 'node:test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  getReferenceSelectionAction,
  processStoryboardReferenceSelection,
  StoryboardReferenceExtractorPanel,
  appendReferenceSelection,
  type ReferenceSelection,
} from './StoryboardReferenceExtractorPanel'

const sourceNode = {
  id: 'image-node-1',
  title: '角色构图参考',
  prompt: '雨夜街头',
  mediaUrl: 'https://assets.example.test/reference.jpg',
  assetId: 'asset-source-1',
}

test('does not expose a confirmation action before an explicit freeform selection exists', () => {
  const markup = renderToStaticMarkup(createElement(StoryboardReferenceExtractorPanel, {
    projectId: 'project-1',
    sourceNode,
    onCreateReferenceNode: () => null,
    onUpdateSourceSession: () => {},
    onClose: () => {},
  }))

  assert.match(markup, /请选择或拖拽参考区域/)
  assert.match(markup, /<button[^>]*disabled=""[^>]*>确认提取<\/button>/)
})

test('keeps user-confirmed selections in a stable ordered label sequence', () => {
  const first = appendReferenceSelection([], {
    id: 'selection-1',
    label: '参考图 1',
    crop: { x: 10, y: 20, width: 120, height: 80 },
  })
  const second = appendReferenceSelection(first, {
    id: 'selection-2',
    label: '参考图 2',
    crop: { x: 160, y: 30, width: 90, height: 110 },
  })

  assert.deepEqual(second.map((item: ReferenceSelection) => item.label), ['参考图 1', '参考图 2'])
  assert.deepEqual(second.map((item: ReferenceSelection) => item.order), [0, 1])
})

test('retries only node creation for an uploaded reference without duplicating the upload', () => {
  const ready: ReferenceSelection = {
    id: 'selection-1',
    label: '参考图 1',
    order: 0,
    crop: { x: 10, y: 20, width: 120, height: 80 },
    status: 'ready',
  }
  const uploadedWithoutNode: ReferenceSelection = {
    ...ready,
    id: 'selection-1',
    status: 'uploaded',
    assetId: 'asset-reference-1',
    assetUrl: 'https://assets.example.test/reference-1.jpg',
  }
  const created: ReferenceSelection = { ...uploadedWithoutNode, createdNodeId: 'node-reference-1' }
  let uploadCount = 0
  let nodeCreateCount = 0

  for (const selection of [ready, uploadedWithoutNode, created]) {
    const action = getReferenceSelectionAction(selection)
    if (action === 'upload-and-create') uploadCount += 1
    if (action === 'create-node-retry') nodeCreateCount += 1
  }

  assert.equal(uploadCount, 1)
  assert.equal(nodeCreateCount, 1)
})

test('confirmation retry reuses the uploaded reference without cropping or uploading again', async () => {
  const uploadedWithoutNode: ReferenceSelection = {
    id: 'selection-1',
    label: '参考图 1',
    order: 0,
    crop: { x: 10, y: 20, width: 120, height: 80 },
    status: 'uploaded',
    assetId: 'asset-reference-1',
    assetUrl: 'https://assets.example.test/reference-1.jpg',
  }
  let cropCount = 0
  let uploadFetchCount = 0
  let nodeCreateCount = 0

  const result = await processStoryboardReferenceSelection({
    selection: uploadedWithoutNode,
    sourceAssetId: 'asset-source-1',
    sourceNodeId: 'image-node-1',
    extractionSessionId: 'session-1',
    image: {} as HTMLImageElement,
    imageSize: { width: 320, height: 180 },
    projectId: 'project-1',
    total: 1,
    onCreateReferenceNode: (reference, placementIndex, total) => {
      nodeCreateCount += 1
      assert.equal(reference.assetId, 'asset-reference-1')
      assert.equal(placementIndex, 0)
      assert.equal(total, 1)
      return 'node-reference-1'
    },
    cropToBlob: async () => {
      cropCount += 1
      return new Blob()
    },
    fetchImpl: async () => {
      uploadFetchCount += 1
      return new Response(null, { status: 500 })
    },
  })

  assert.equal(cropCount, 0)
  assert.equal(uploadFetchCount, 0)
  assert.equal(nodeCreateCount, 1)
  assert.equal(result.createdNodeId, 'node-reference-1')
  assert.equal(result.status, 'uploaded')
})
