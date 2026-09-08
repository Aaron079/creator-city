/**
 * Run: pnpm --filter web exec tsx --test src/components/create/canvas/canvasResizeGeometry.test.ts
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
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

  test('rounds editor results to one decimal place', () => {
    assert.deepEqual(resizeEditorRect({
      rect: editorRect,
      handle: 'se',
      deltaX: 0.123,
      deltaY: 0.456,
    }), {
      x: 100,
      y: 200,
      width: 400.1,
      height: 200.5,
    })
  })
})
