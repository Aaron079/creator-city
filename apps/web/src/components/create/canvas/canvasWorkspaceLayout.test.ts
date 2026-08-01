import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getCanvasNodeDialogSize,
  getCanvasNodeSize,
  normalizeLegacyCanvasNodeSize,
} from './canvasWorkspaceLayout'

test('uses readable compact canvas node dimensions at 100% zoom', () => {
  assert.deepEqual(getCanvasNodeSize('text'), { width: 236, height: 208 })
  assert.deepEqual(getCanvasNodeSize('image'), { width: 248, height: 220 })
  assert.deepEqual(getCanvasNodeSize('video'), { width: 248, height: 220 })
})

test('uses a compact desktop task dialog without reducing its controls below usable size', () => {
  assert.deepEqual(getCanvasNodeDialogSize(1440), { width: 480, height: 420 })
})

test('keeps the task dialog inside narrow viewports', () => {
  assert.deepEqual(getCanvasNodeDialogSize(390), { width: 342, height: 320 })
})

test('migrates legacy default node dimensions to the compact canvas scale', () => {
  assert.deepEqual(
    normalizeLegacyCanvasNodeSize({ id: 'video-1', kind: 'video', width: 380, height: 320 }),
    { id: 'video-1', kind: 'video', width: 248, height: 220 },
  )
})

test('preserves a node with a non-default custom size', () => {
  assert.deepEqual(
    normalizeLegacyCanvasNodeSize({ id: 'image-1', kind: 'image', width: 512, height: 288 }),
    { id: 'image-1', kind: 'image', width: 512, height: 288 },
  )
})
