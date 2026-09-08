/**
 * Run: pnpm --filter web exec tsx --test src/components/create/canvas/canvasResizeGeometry.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  getEditorResizeOffset,
  resizeEditorRect,
  resizeNodeRect,
  type CanvasResizeRect,
} from './canvasResizeGeometry'

const nodeRect: CanvasResizeRect = { x: 100, y: 200, width: 400, height: 200 }
const editorRect: CanvasResizeRect = { x: 100, y: 200, width: 400, height: 200 }

describe('canvas resize geometry', () => {
  test('resizes a northwest node corner proportionally and pins the southeast corner', () => {
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'nw', deltaX: -40, deltaY: -5 }), {
      x: 60,
      y: 180,
      width: 440,
      height: 220,
    })
  })

  test('resizes a northeast node corner proportionally and pins the southwest corner', () => {
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'ne', deltaX: 40, deltaY: -5 }), {
      x: 100,
      y: 180,
      width: 440,
      height: 220,
    })
  })

  test('resizes a southeast node corner proportionally and pins the northwest corner', () => {
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'se', deltaX: 40, deltaY: 5 }), {
      x: 100,
      y: 200,
      width: 440,
      height: 220,
    })
  })

  test('resizes a southwest node corner proportionally and pins the northeast corner', () => {
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'sw', deltaX: -40, deltaY: 5 }), {
      x: 60,
      y: 200,
      width: 440,
      height: 220,
    })
  })

  test('uses the dominant vertical motion when resizing a node corner', () => {
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'se', deltaX: 5, deltaY: 30 }), {
      x: 100,
      y: 200,
      width: 460,
      height: 230,
    })
  })

  test('resizes a node from each edge proportionally without relying on a corner target', () => {
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'e', deltaX: 40, deltaY: 0 }), {
      x: 100,
      y: 190,
      width: 440,
      height: 220,
    })
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'n', deltaX: 0, deltaY: -20 }), {
      x: 80,
      y: 180,
      width: 440,
      height: 220,
    })
  })

  test('clamps node dimensions to the default minimum and maximum bounds', () => {
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'se', deltaX: -1000, deltaY: 0 }), {
      x: 100,
      y: 200,
      width: 240,
      height: 120,
    })
    assert.deepEqual(resizeNodeRect({ rect: nodeRect, handle: 'nw', deltaX: -1000, deltaY: 0 }), {
      x: -260,
      y: 20,
      width: 760,
      height: 380,
    })
  })

  test('keeps node corners inside supplied Canvas stage bounds', () => {
    assert.deepEqual(resizeNodeRect({
      rect: nodeRect,
      handle: 'nw',
      deltaX: -1_000,
      deltaY: -1_000,
      positionBounds: { minX: 32, minY: 80, maxX: 900, maxY: 700 },
    }), {
      x: 32,
      y: 166,
      width: 468,
      height: 234,
    })
    assert.deepEqual(resizeNodeRect({
      rect: nodeRect,
      handle: 'se',
      deltaX: 1_000,
      deltaY: 1_000,
      positionBounds: { minX: 32, minY: 80, maxX: 620, maxY: 420 },
    }), {
      x: 100,
      y: 200,
      width: 440,
      height: 220,
    })
  })

  test('returns a stage-bounded node even when its starting position is partly outside the stage', () => {
    assert.deepEqual(resizeNodeRect({
      rect: { x: -40, y: 120, width: 400, height: 200 },
      handle: 'se',
      deltaX: 20,
      deltaY: 20,
      positionBounds: { minX: 16, minY: 16, maxX: 720, maxY: 520 },
    }), {
      x: 16,
      y: 120,
      width: 420,
      height: 210,
    })
  })

  test('keeps a node within the stage when a partly outside node grows toward the southeast', () => {
    const result = resizeNodeRect({
      rect: { x: -40, y: 120, width: 400, height: 200 },
      handle: 'se',
      deltaX: 1_000,
      deltaY: 1_000,
      positionBounds: { minX: 16, minY: 16, maxX: 720, maxY: 520 },
    })

    assert.ok(result.x >= 16)
    assert.ok(result.y >= 16)
    assert.ok(result.x + result.width <= 720)
    assert.ok(result.y + result.height <= 520)
  })

  test('moves only the north edge vertically', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 'n', deltaX: 40, deltaY: -25 }), {
      x: 100,
      y: 175,
      width: 400,
      height: 225,
    })
  })

  test('moves only the east edge horizontally', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 'e', deltaX: 40, deltaY: -25 }), {
      x: 100,
      y: 200,
      width: 440,
      height: 200,
    })
  })

  test('moves only the south edge vertically', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 's', deltaX: 40, deltaY: 25 }), {
      x: 100,
      y: 200,
      width: 400,
      height: 225,
    })
  })

  test('moves only the west edge horizontally', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 'w', deltaX: -40, deltaY: 25 }), {
      x: 60,
      y: 200,
      width: 440,
      height: 200,
    })
  })

  test('resizes a northwest editor corner freely and pins the southeast corner', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 'nw', deltaX: -40, deltaY: -25 }), {
      x: 60,
      y: 175,
      width: 440,
      height: 225,
    })
  })

  test('resizes a northeast editor corner freely and pins the southwest corner', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 'ne', deltaX: 40, deltaY: -25 }), {
      x: 100,
      y: 175,
      width: 440,
      height: 225,
    })
  })

  test('resizes a southeast editor corner freely and pins the northwest corner', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 'se', deltaX: 40, deltaY: 25 }), {
      x: 100,
      y: 200,
      width: 440,
      height: 225,
    })
  })

  test('resizes a southwest editor corner freely and pins the northeast corner', () => {
    assert.deepEqual(resizeEditorRect({ rect: editorRect, handle: 'sw', deltaX: -40, deltaY: 25 }), {
      x: 60,
      y: 200,
      width: 440,
      height: 225,
    })
  })

  test('offsets a centered editor shell so its opposite edge stays pinned', () => {
    assert.deepEqual(getEditorResizeOffset({
      handle: 'w',
      offset: { x: 0, y: 0 },
      startSize: { width: 400, height: 240 },
      nextSize: { width: 440, height: 240 },
    }), { x: -20, y: 0 })
    assert.deepEqual(getEditorResizeOffset({
      handle: 'n',
      offset: { x: 0, y: 0 },
      startSize: { width: 400, height: 240 },
      nextSize: { width: 400, height: 280 },
    }), { x: 0, y: -20 })
    assert.deepEqual(getEditorResizeOffset({
      handle: 'se',
      offset: { x: 12, y: -8 },
      startSize: { width: 400, height: 240 },
      nextSize: { width: 440, height: 280 },
    }), { x: 32, y: 12 })
  })

  test('clamps editor dimensions to supplied bounds while preserving opposing edges', () => {
    assert.deepEqual(resizeEditorRect({
      rect: editorRect,
      handle: 'nw',
      deltaX: 1000,
      deltaY: 1000,
      bounds: { minWidth: 150, minHeight: 80, maxWidth: 300, maxHeight: 160 },
    }), {
      x: 350,
      y: 320,
      width: 150,
      height: 80,
    })
    assert.deepEqual(resizeEditorRect({
      rect: editorRect,
      handle: 'se',
      deltaX: 1000,
      deltaY: 1000,
      bounds: { minWidth: 150, minHeight: 80, maxWidth: 300, maxHeight: 160 },
    }), {
      x: 100,
      y: 200,
      width: 300,
      height: 160,
    })
  })

  test('preserves fractional editor geometry without rounding', () => {
    assert.deepEqual(resizeEditorRect({
      rect: editorRect,
      handle: 'se',
      deltaX: 0.123,
      deltaY: 0.456,
    }), {
      x: 100,
      y: 200,
      width: 400.123,
      height: 200.456,
    })
  })

  test('preserves fractional supplied editor width bounds', () => {
    const maxWidthBounds = { minWidth: 320, minHeight: 96, maxWidth: 400.06, maxHeight: 720 }
    const maxWidthResult = resizeEditorRect({
      rect: editorRect,
      handle: 'e',
      deltaX: 100,
      deltaY: 0,
      bounds: maxWidthBounds,
    })
    assert.equal(maxWidthResult.width, maxWidthBounds.maxWidth)
    assert.ok(maxWidthResult.width <= maxWidthBounds.maxWidth)

    const minWidthBounds = { minWidth: 400.04, minHeight: 96, maxWidth: 1120, maxHeight: 720 }
    const minWidthResult = resizeEditorRect({
      rect: editorRect,
      handle: 'w',
      deltaX: 100,
      deltaY: 0,
      bounds: minWidthBounds,
    })
    assert.equal(minWidthResult.width, minWidthBounds.minWidth)
    assert.ok(minWidthResult.width >= minWidthBounds.minWidth)
    assert.equal(minWidthResult.x + minWidthResult.width, editorRect.x + editorRect.width)
  })

  test('rejects zero, negative, and non-finite rect dimensions', () => {
    assert.throws(() => resizeEditorRect({
      rect: { ...editorRect, width: 0 },
      handle: 'e',
      deltaX: 0,
      deltaY: 0,
    }), RangeError)
    assert.throws(() => resizeNodeRect({
      rect: { ...nodeRect, height: -1 },
      handle: 'se',
      deltaX: 0,
      deltaY: 0,
    }), RangeError)
    assert.throws(() => resizeEditorRect({
      rect: { ...editorRect, width: Number.POSITIVE_INFINITY },
      handle: 'e',
      deltaX: 0,
      deltaY: 0,
    }), RangeError)
  })

  test('rejects non-positive, non-finite, and inverted bounds', () => {
    assert.throws(() => resizeEditorRect({
      rect: editorRect,
      handle: 'e',
      deltaX: 0,
      deltaY: 0,
      bounds: { minWidth: 0, minHeight: 96, maxWidth: 1120, maxHeight: 720 },
    }), RangeError)
    assert.throws(() => resizeEditorRect({
      rect: editorRect,
      handle: 'e',
      deltaX: 0,
      deltaY: 0,
      bounds: { minWidth: 320, minHeight: 96, maxWidth: Number.POSITIVE_INFINITY, maxHeight: 720 },
    }), RangeError)
    assert.throws(() => resizeEditorRect({
      rect: editorRect,
      handle: 'e',
      deltaX: 0,
      deltaY: 0,
      bounds: { minWidth: 500, minHeight: 96, maxWidth: 400, maxHeight: 720 },
    }), RangeError)
  })

  test('rejects node bounds incompatible with the original aspect ratio', () => {
    assert.throws(() => resizeNodeRect({
      rect: nodeRect,
      handle: 'se',
      deltaX: 0,
      deltaY: 0,
      bounds: { minWidth: 500, minHeight: 1, maxWidth: 1000, maxHeight: 200 },
    }), RangeError)
  })

  test('rejects non-finite rect positions and drag deltas', () => {
    assert.throws(() => resizeEditorRect({
      rect: { ...editorRect, x: Number.NaN },
      handle: 'e',
      deltaX: 0,
      deltaY: 0,
    }), RangeError)
    assert.throws(() => resizeNodeRect({
      rect: { ...nodeRect, y: Number.POSITIVE_INFINITY },
      handle: 'se',
      deltaX: 0,
      deltaY: 0,
    }), RangeError)
    assert.throws(() => resizeEditorRect({
      rect: editorRect,
      handle: 'e',
      deltaX: Number.NaN,
      deltaY: 0,
    }), RangeError)
    assert.throws(() => resizeNodeRect({
      rect: nodeRect,
      handle: 'se',
      deltaX: 0,
      deltaY: Number.NEGATIVE_INFINITY,
    }), RangeError)
  })

  test('rejects invalid runtime resize handles', () => {
    assert.throws(() => resizeEditorRect({
      rect: editorRect,
      handle: 'invalid' as unknown as 'e',
      deltaX: 0,
      deltaY: 0,
    }), RangeError)
  })
})
