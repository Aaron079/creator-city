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
  test('detects a simple 2x2 bordered storyboard image', () => {
    const image = makeImageData(200, 200, (data) => {
      drawBlackLine(data, 200, 200, 'x', 100)
      drawBlackLine(data, 200, 200, 'y', 100)
    })
    const result = detectGridLayoutFromImageData(image)
    assert.equal(result.layoutId, '2x2')
    assert.ok(result.confidence >= 0.7)
  })

  test('falls back when confidence is low or image is not a grid', () => {
    const image = makeImageData(200, 200)
    const result = detectGridLayoutFromImageData(image)
    assert.equal(result.layoutId, null)
    assert.ok(result.confidence < 0.7)
  })
})
