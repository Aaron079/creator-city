/**
 * Unit tests for storyboard grid split helpers.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/storyboardGridSplit.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCropMetadata,
  buildGridCells,
  detectGridLayoutFromImageData,
  validateGridLayout,
} from './storyboardGridDetect'
import { buildStoryboardGridUploadFormData } from './storyboardGridCrop'

function makeImageData(width: number, height: number, draw?: (data: Uint8ClampedArray) => void) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = 255
  }
  draw?.(data)
  return { width, height, data }
}

function drawBlackLine(data: Uint8ClampedArray, width: number, height: number, axis: 'x' | 'y', pos: number) {
  for (let offset = -1; offset <= 1; offset += 1) {
    const line = pos + offset
    if (axis === 'x') {
      for (let y = 0; y < height; y += 1) {
        const idx = (y * width + line) * 4
        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
      }
    } else {
      for (let x = 0; x < width; x += 1) {
        const idx = (line * width + x) * 4
        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
      }
    }
  }
}

function drawBlackBoundarySegment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  axis: 'x' | 'y',
  position: number,
  startRatio: number,
  endRatio: number,
) {
  const start = Math.round((axis === 'x' ? height : width) * startRatio)
  const end = Math.round((axis === 'x' ? height : width) * endRatio)
  for (let offset = start; offset < end; offset += 1) {
    const x = axis === 'x' ? position : offset
    const y = axis === 'x' ? offset : position
    const index = (y * width + x) * 4
    data[index] = 0
    data[index + 1] = 0
    data[index + 2] = 0
  }
}

function drawConfirmedGrid(data: Uint8ClampedArray, width: number, height: number, layout: '2x2' | '3x3') {
  const boundaries = layout === '2x2' ? [0.5] : [1 / 3, 2 / 3]
  for (const ratio of boundaries) {
    drawBlackLine(data, width, height, 'x', Math.round(width * ratio))
    drawBlackLine(data, width, height, 'y', Math.round(height * ratio))
  }
}

describe('validateGridLayout', () => {
  test('accepts all V1 layouts and rejects invalid layouts', () => {
    for (const id of ['1x2', '2x1', '2x2', '3x2', '2x3', '3x3', '4x3']) {
      assert.equal(validateGridLayout(id).ok, true, id)
    }
    assert.equal(validateGridLayout('4x4').ok, false)
    assert.equal(validateGridLayout('bad').ok, false)
  })
})

describe('buildGridCells', () => {
  test('builds stable cells for each V1 layout', () => {
    const cases = [
      ['1x2', 2],
      ['2x1', 2],
      ['2x2', 4],
      ['3x2', 6],
      ['2x3', 6],
      ['3x3', 9],
      ['4x3', 12],
    ] as const
    for (const [layoutId, count] of cases) {
      const cells = buildGridCells(layoutId, 1200, 800)
      assert.equal(cells.length, count)
      const first = cells[0]
      assert.ok(first)
      assert.equal(first.index, 0)
      assert.equal(first.row, 0)
      assert.equal(first.col, 0)
      assert.equal(cells.at(-1)?.index, count - 1)
    }
  })

  test('normalizes crop metadata with source lineage', () => {
    const cell = buildGridCells('2x2', 1000, 500)[1]
    assert.ok(cell)
    const metadata = buildCropMetadata({
      cell,
      sourceWidth: 1000,
      sourceHeight: 500,
      sourceNodeId: 'node-source',
      sourceAssetId: 'asset-source',
      parentAssetId: 'asset-parent',
      gridSessionId: 'grid-session-1',
    })
    assert.deepEqual(metadata.cropBox, { x: 0.5, y: 0, width: 0.5, height: 0.5 })
    assert.equal(metadata.toolId, 'storyboard-grid-split')
    assert.equal(metadata.sourceNodeId, 'node-source')
    assert.equal(metadata.sourceAssetId, 'asset-source')
    assert.equal(metadata.parentAssetId, 'asset-parent')
    assert.equal(metadata.row, 0)
    assert.equal(metadata.col, 1)
    assert.equal(metadata.index, 1)
  })
})

describe('detectGridLayoutFromImageData', () => {
  test('confirms a clean 2x2 bordered storyboard image', () => {
    const image = makeImageData(240, 240, (data) => drawConfirmedGrid(data, 240, 240, '2x2'))
    const result = detectGridLayoutFromImageData(image)
    assert.equal(result.layoutId, '2x2')
    assert.equal(result.selectionMode, 'confirmed')
    assert.equal(result.reason, 'confirmed-grid')
  })

  test('does not confirm a logo-like interrupted 3x3 signal', () => {
    const image = makeImageData(240, 240, (data) => {
      for (const ratio of [1 / 3, 2 / 3]) {
        drawBlackBoundarySegment(data, 240, 240, 'x', Math.round(240 * ratio), 0.1, 0.85)
        drawBlackBoundarySegment(data, 240, 240, 'y', Math.round(240 * ratio), 0.15, 0.9)
      }
    })
    const result = detectGridLayoutFromImageData(image)
    assert.notEqual(result.selectionMode, 'confirmed')
    assert.notEqual(result.layoutId, '3x3')
  })

  test('returns needs-confirmation for one-axis evidence', () => {
    const image = makeImageData(240, 240, (data) => drawBlackLine(data, 240, 240, 'x', 120))
    const result = detectGridLayoutFromImageData(image)
    assert.equal(result.selectionMode, 'needs-confirmation')
    assert.equal(result.layoutId, '1x2')
    assert.equal(result.reason, 'ambiguous-grid')
  })

  test('returns manual when image has no grid evidence', () => {
    const result = detectGridLayoutFromImageData(makeImageData(240, 240))
    assert.equal(result.layoutId, null)
    assert.equal(result.selectionMode, 'manual')
    assert.equal(result.reason, 'manual-fallback')
  })
})

describe('buildStoryboardGridUploadFormData', () => {
  test('includes the required projectId and allowlisted storyboard metadata only', () => {
    const cell = buildGridCells('2x2', 1000, 500)[0]
    assert.ok(cell)
    const metadata = buildCropMetadata({
      cell,
      sourceWidth: 1000,
      sourceHeight: 500,
      sourceNodeId: 'node-source',
      sourceAssetId: 'asset-source',
      parentAssetId: 'asset-parent',
      gridSessionId: 'grid-session-1',
    })

    const fd = buildStoryboardGridUploadFormData({
      blob: new Blob(['cell'], { type: 'image/png' }),
      projectId: 'project-1',
      workflowId: 'workflow-1',
      sourceNodeId: 'node-source',
      title: 'cell-1',
      metadata,
    })

    assert.equal(fd.get('projectId'), 'project-1')
    assert.equal(fd.get('workflowId'), 'workflow-1')
    assert.equal(fd.get('type'), 'image')
    assert.equal(fd.get('toolId'), 'storyboard-grid-split')
    assert.equal(fd.get('sourceNodeId'), 'node-source')
    assert.equal(fd.get('sourceAssetId'), 'asset-source')
    assert.equal(fd.get('parentAssetId'), 'asset-parent')
    assert.equal(fd.get('gridSessionId'), 'grid-session-1')
    assert.equal(fd.get('row'), '0')
    assert.equal(fd.get('col'), '0')
    assert.equal(fd.get('index'), '0')
    assert.equal(fd.has('metadataJson'), false)
    assert.equal(fd.has('storageProvider'), false)
    assert.equal(fd.has('bucket'), false)
    assert.equal(fd.has('key'), false)
    assert.equal(fd.has('storageKey'), false)
  })

  test('names crop upload files according to the blob mime type', () => {
    const cell = buildGridCells('2x2', 1000, 500)[0]
    assert.ok(cell)
    const metadata = buildCropMetadata({
      cell,
      sourceWidth: 1000,
      sourceHeight: 500,
      sourceNodeId: 'node-source',
      sourceAssetId: 'asset-source',
      parentAssetId: 'asset-parent',
      gridSessionId: 'grid-session-1',
    })

    const fd = buildStoryboardGridUploadFormData({
      blob: new Blob(['cell'], { type: 'image/jpeg' }),
      projectId: 'project-1',
      sourceNodeId: 'node-source',
      title: 'cell-1',
      metadata,
    })

    const file = fd.get('file')
    assert.ok(file instanceof File)
    assert.equal(file.name, 'cell-1.jpg')
    assert.equal(file.type, 'image/jpeg')
  })
})
