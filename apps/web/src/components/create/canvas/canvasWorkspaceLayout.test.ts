import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  clampCanvasDialogLeftToStage,
  clampCanvasDialogTopToStage,
  getCanvasNodeContextSurfaceLayout,
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

test('lays out selected-node navigation and dialog below its display node', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1440, bottom: 720 },
  })

  assert.deepEqual(layout.navigation, { left: 174, top: 358, width: 700, height: 48 })
  assert.deepEqual(layout.dialog, { left: 174, top: 412, width: 700, height: 210 })
  assert.equal(layout.panDeltaY, 0)
})

test('requests an upward Canvas pan instead of flipping the dialog above the node', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 300, top: 460, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1280, bottom: 720 },
  })

  assert.equal(layout.navigation.top, 698)
  assert.equal(layout.dialog.top, 752)
  assert.equal(layout.panDeltaY, -258)
})

test('uses a compact desktop task dialog without reducing its controls below usable size', () => {
  assert.deepEqual(getCanvasNodeDialogSize(1440, 720), { width: 480, height: 420 })
})

test('keeps the task dialog inside narrow viewports', () => {
  assert.deepEqual(getCanvasNodeDialogSize(390, 300), { width: 358, height: 268 })
})

test('clamps a task dialog to the visible canvas stage instead of the browser viewport', () => {
  const stageLeft = 80
  const stageRight = 940
  const dialogWidth = 480
  const margin = 16

  assert.equal(
    clampCanvasDialogLeftToStage(800, dialogWidth, stageLeft, stageRight, margin),
    444,
  )
  assert.equal(
    clampCanvasDialogLeftToStage(0, dialogWidth, stageLeft, stageRight, margin),
    96,
  )
})

test('clamps a task dialog vertically to the visible canvas stage', () => {
  const stageTop = 64
  const stageBottom = 580
  const dialogHeight = 420
  const margin = 16

  assert.equal(
    clampCanvasDialogTopToStage(700, dialogHeight, stageTop, stageBottom, margin),
    144,
  )
  assert.equal(
    clampCanvasDialogTopToStage(0, dialogHeight, stageTop, stageBottom, margin),
    80,
  )
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

test('uses the shared stage-aware layout helper and retains inspector dismissal', () => {
  assert.match(visualCanvasWorkspaceSource, /getCanvasNodeContextSurfaceLayout\(\{[\s\S]*?stage,/)
  assert.match(
    visualCanvasWorkspaceSource,
    /onDismissRightInspector=\{\(\) => setIsRightInspectorOpen\(false\)\}/,
  )
  assert.match(visualCanvasWorkspaceSource, /const \[canvasStageBounds, setCanvasStageBounds\] = useState<CanvasStageRect \| undefined>\(undefined\)/)
  assert.match(visualCanvasWorkspaceSource, /const rect = viewport\.getBoundingClientRect\(\)/)
  assert.match(visualCanvasWorkspaceSource, /new ResizeObserver\(/)
  assert.match(visualCanvasWorkspaceSource, /setCanvasStageBounds\(\(current\) =>/)
  assert.match(visualCanvasWorkspaceSource, /nodeContextPanAdjustmentKeyRef/)
  assert.match(visualCanvasWorkspaceSource, /window\.requestAnimationFrame/)
})

test('uses anchored below-node geometry without zoom-scaled or above-node dialog placement', () => {
  assert.match(visualCanvasWorkspaceSource, /getCanvasNodeContextSurfaceLayout\(/)
  assert.doesNotMatch(visualCanvasWorkspaceSource, /const dialogScale = clampNumber\(canvasZoom, 0\.56, 1\)/)
  assert.doesNotMatch(visualCanvasWorkspaceSource, /const aboveTop = nodeTop - NODE_DIALOG_GAP/)
})

test('suppresses persistence for the automatic lower-viewport pan', () => {
  const autoPanStart = visualCanvasWorkspaceSource.indexOf('const adjustmentKey =')
  const autoPanEnd = visualCanvasWorkspaceSource.indexOf('const nodeDialogStyle = useMemo', autoPanStart)
  const autoPanSource = visualCanvasWorkspaceSource.slice(autoPanStart, autoPanEnd)

  assert.match(autoPanSource, /createCanvasAutosaveSuppression/)
  assert.doesNotMatch(autoPanSource, /scheduleCanvasSave\(/)
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
