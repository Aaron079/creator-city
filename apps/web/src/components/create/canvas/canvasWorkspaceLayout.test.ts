import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  getCanvasNodeDialogSize,
  getCanvasNodeSize,
  normalizeLegacyCanvasNodeSize,
} from './canvasWorkspaceLayout'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const visualCanvasWorkspaceSource = readFileSync(resolve(testDirectory, '../VisualCanvasWorkspace.tsx'), 'utf8')
const canvasModuleSource = readFileSync(resolve(testDirectory, '../canvas.module.css'), 'utf8')

test('uses readable compact canvas node dimensions at 100% zoom', () => {
  assert.deepEqual(getCanvasNodeSize('text'), { width: 236, height: 208 })
  assert.deepEqual(getCanvasNodeSize('image'), { width: 248, height: 220 })
  assert.deepEqual(getCanvasNodeSize('video'), { width: 248, height: 220 })
})

test('uses a compact desktop task dialog without reducing its controls below usable size', () => {
  assert.deepEqual(getCanvasNodeDialogSize(1440, 720), { width: 480, height: 420 })
})

test('keeps the task dialog inside narrow viewports', () => {
  assert.deepEqual(getCanvasNodeDialogSize(390, 300), { width: 358, height: 268 })
})

test('keeps the runtime task dialog max height within 16px viewport margins', () => {
  assert.match(visualCanvasWorkspaceSource, /maxHeight: 'calc\(100vh - 32px\)'/)
  assert.doesNotMatch(visualCanvasWorkspaceSource, /maxHeight: 'calc\(100vh - 80px\)'/)
})

test('keeps the runtime task dialog max width within 16px viewport margins', () => {
  const dialogRule = /\.scope :global\(\.canvas-node-dialog\) \{[^}]*max-width: calc\(100vw - (\d+)px\);/g
  const dialogMaxWidths = Array.from(canvasModuleSource.matchAll(dialogRule), (match) => match[1])

  assert.ok(dialogMaxWidths.includes('32'))
  assert.ok(dialogMaxWidths.every((maxWidth) => maxWidth !== '48'))
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
