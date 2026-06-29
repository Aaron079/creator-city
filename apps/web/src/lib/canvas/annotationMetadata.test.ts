/**
 * Unit tests for image node annotation metadata.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/annotationMetadata.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendAnnotationItem,
  clearAnnotationItems,
  denormalizePoint,
  hasAnnotationItems,
  mergeAnnotationMetadata,
  normalizeAnnotationItem,
  normalizePoint,
  undoAnnotationItem,
  type CanvasAnnotationState,
} from './annotationMetadata'

const baseState: CanvasAnnotationState = {
  version: 1,
  updatedAt: '2026-06-29T00:00:00.000Z',
  imageSize: { width: 1000, height: 500 },
  items: [],
}

describe('annotation point normalization', () => {
  test('normalizes pen path coordinates to 0..1', () => {
    const a = normalizePoint({ clientX: 150, clientY: 240 }, { left: 50, top: 40, width: 200, height: 400 })
    assert.deepEqual(a, { x: 0.5, y: 0.5 })

    const b = normalizePoint({ clientX: -20, clientY: 999 }, { left: 50, top: 40, width: 200, height: 400 })
    assert.deepEqual(b, { x: 0, y: 1 })
  })

  test('denormalizes points for rendering', () => {
    assert.deepEqual(denormalizePoint({ x: 0.25, y: 0.75 }, { width: 400, height: 200 }), { x: 100, y: 150 })
  })
})

describe('annotation item normalization', () => {
  test('keeps arrow start and end normalized', () => {
    const item = normalizeAnnotationItem({
      id: 'arrow-1',
      type: 'arrow',
      color: '#ffcc00',
      strokeWidth: 3,
      points: [{ x: -1, y: 0.1 }, { x: 1.5, y: 0.9 }],
      createdAt: '2026-06-29T00:00:00.000Z',
    })
    assert.equal(item?.type, 'arrow')
    assert.deepEqual(item?.points, [{ x: 0, y: 0.1 }, { x: 1, y: 0.9 }])
  })

  test('keeps rect and ellipse coordinates valid', () => {
    const rect = normalizeAnnotationItem({
      id: 'rect-1',
      type: 'rect',
      color: '#00d2ff',
      strokeWidth: 2,
      points: [{ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.3 }],
      createdAt: '2026-06-29T00:00:00.000Z',
    })
    const ellipse = normalizeAnnotationItem({
      id: 'ellipse-1',
      type: 'ellipse',
      color: '#00d2ff',
      strokeWidth: 2,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.8 }],
      createdAt: '2026-06-29T00:00:00.000Z',
    })
    assert.deepEqual(rect?.points, [{ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.3 }])
    assert.deepEqual(ellipse?.points, [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.8 }])
  })

  test('saves text content and position', () => {
    const item = normalizeAnnotationItem({
      id: 'text-1',
      type: 'text',
      color: '#ffffff',
      strokeWidth: 2,
      points: [{ x: 0.42, y: 0.64 }],
      text: '走位提示',
      createdAt: '2026-06-29T00:00:00.000Z',
    })
    assert.equal(item?.type, 'text')
    assert.equal(item?.text, '走位提示')
    assert.deepEqual(item?.points, [{ x: 0.42, y: 0.64 }])
  })

  test('rejects invalid annotation type', () => {
    const item = normalizeAnnotationItem({
      id: 'bad-1',
      type: 'provider-call',
      color: '#ffffff',
      strokeWidth: 2,
      points: [{ x: 0.5, y: 0.5 }],
      createdAt: '2026-06-29T00:00:00.000Z',
    })
    assert.equal(item, null)
  })
})

describe('annotation state operations', () => {
  test('append, undo, and clear update only annotation items', () => {
    const item = normalizeAnnotationItem({
      id: 'pen-1',
      type: 'pen',
      color: '#ffffff',
      strokeWidth: 4,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
      createdAt: '2026-06-29T00:00:00.000Z',
    })
    assert.ok(item)
    const appended = appendAnnotationItem(baseState, item, '2026-06-29T01:00:00.000Z')
    assert.equal(appended.items.length, 1)
    assert.equal(hasAnnotationItems(appended), true)

    const undone = undoAnnotationItem(appended, '2026-06-29T02:00:00.000Z')
    assert.equal(undone.items.length, 0)
    assert.equal(hasAnnotationItems(undone), false)

    const cleared = clearAnnotationItems(appended, '2026-06-29T03:00:00.000Z')
    assert.equal(cleared.items.length, 0)
  })

  test('merges annotation metadata without overwriting existing metadata', () => {
    const item = normalizeAnnotationItem({
      id: 'path-1',
      type: 'path',
      color: '#ff5a5a',
      strokeWidth: 3,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }],
      createdAt: '2026-06-29T00:00:00.000Z',
    })
    assert.ok(item)
    const next = mergeAnnotationMetadata({
      metadataJson: {
        cropLineage: { sourceNodeId: 'source-1' },
        gridCropSession: { id: 'grid-1' },
        taskInputs: { version: 1, references: [{ id: 'ref-1' }] },
        assetId: 'asset-1',
      },
      annotations: appendAnnotationItem(baseState, item),
    })

    assert.deepEqual(next.cropLineage, { sourceNodeId: 'source-1' })
    assert.deepEqual(next.gridCropSession, { id: 'grid-1' })
    assert.deepEqual(next.taskInputs, { version: 1, references: [{ id: 'ref-1' }] })
    assert.equal(next.assetId, 'asset-1')
    assert.equal((next.annotations as CanvasAnnotationState).items.length, 1)
  })

  test('leaves source result and asset fields unchanged when merging on a node-like object', () => {
    const sourceNode = {
      resultImageUrl: 'https://assets.example.com/image.png',
      assetId: 'asset-source',
      metadataJson: { assetId: 'asset-source' },
    }
    const nextMetadata = mergeAnnotationMetadata({
      metadataJson: sourceNode.metadataJson,
      annotations: baseState,
    })
    assert.equal(sourceNode.resultImageUrl, 'https://assets.example.com/image.png')
    assert.equal(sourceNode.assetId, 'asset-source')
    assert.equal(nextMetadata.assetId, 'asset-source')
  })
})
