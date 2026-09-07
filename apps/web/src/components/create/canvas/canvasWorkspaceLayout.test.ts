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
  getCanvasTaskDialogSizing,
  normalizeLegacyCanvasNodeSize,
} from './canvasWorkspaceLayout'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const visualCanvasWorkspaceSource = readFileSync(resolve(testDirectory, '../VisualCanvasWorkspace.tsx'), 'utf8')
const canvasModuleSource = readFileSync(resolve(testDirectory, '../canvas.module.css'), 'utf8')
const canvasWorkspaceLayoutSource = readFileSync(resolve(testDirectory, 'canvasWorkspaceLayout.ts'), 'utf8')

test('uses readable compact canvas node dimensions at 100% zoom', () => {
  assert.deepEqual(getCanvasNodeSize('text'), { width: 236, height: 208 })
  assert.deepEqual(getCanvasNodeSize('image'), { width: 248, height: 220 })
  assert.deepEqual(getCanvasNodeSize('video'), { width: 248, height: 220 })
})

test('anchors compact navigation above the selected display node and its dialog below', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1440, bottom: 720 },
  })

  assert.deepEqual(layout.navigation, { left: 349, top: 84, width: 350, height: 28 })
  assert.deepEqual(layout.dialog, { left: 174, top: 348, width: 700, height: 210 })
  assert.equal(layout.panDeltaY, 0)
})

test('supports a taller task dialog without moving its node navigation', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1440, bottom: 800 },
    dialogHeight: 282,
  })

  assert.deepEqual(layout.navigation, { left: 349, top: 84, width: 350, height: 28 })
  assert.deepEqual(layout.dialog, { left: 174, top: 348, width: 700, height: 282 })
  assert.equal(layout.panDeltaY, 0)
})

test('uses a taller task dialog height to calculate stage overflow', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1440, bottom: 600 },
    dialogHeight: 282,
  })

  assert.deepEqual(layout.navigation, { left: 349, top: 84, width: 350, height: 28 })
  assert.equal(layout.dialog.top, 348)
  assert.equal(layout.panDeltaY, -46)
})

test('exposes pure task dialog sizing as a layout behavior boundary', () => {
  assert.match(canvasWorkspaceLayoutSource, /export function getCanvasTaskDialogSizing\(/)
})

test('keeps the 282px task height when fixed controls and prompt allowance fit', () => {
  assert.deepEqual(
    getCanvasTaskDialogSizing({
      stageHeight: 800,
      fixedTopHeight: 20,
      fixedBottomHeight: 30,
      promptChromeHeight: 100,
    }),
    {
      height: 282,
      maxHeight: 732,
      compactFixedControls: false,
      promptBodyHeight: 132,
    },
  )
})

test('uses the smallest expanded task height that preserves fixed controls and prompt allowance', () => {
  assert.deepEqual(
    getCanvasTaskDialogSizing({
      stageHeight: 800,
      fixedTopHeight: 70,
      fixedBottomHeight: 110,
      promptChromeHeight: 90,
    }),
    {
      height: 328,
      maxHeight: 732,
      compactFixedControls: false,
      promptBodyHeight: 58,
    },
  )
})

test('reserves navigation height and gap while compacting fixed controls in a constrained stage', () => {
  const stage = { left: 0, top: 64, right: 1280, bottom: 484 }
  const sizing = getCanvasTaskDialogSizing({
    stageHeight: stage.bottom - stage.top,
    fixedTopHeight: 180,
    fixedBottomHeight: 194,
    promptChromeHeight: 100,
  })

  assert.deepEqual(sizing, {
    height: 352,
    maxHeight: 352,
    compactFixedControls: true,
    promptBodyHeight: 58,
  })

  const initialNode = { left: 300, top: 220, width: 248, height: 220 }
  const firstLayout = getCanvasNodeContextSurfaceLayout({
    node: initialNode,
    stage,
    dialogHeight: sizing.height,
  })
  const settledLayout = getCanvasNodeContextSurfaceLayout({
    node: { ...initialNode, top: initialNode.top + firstLayout.panDeltaY },
    stage,
    dialogHeight: sizing.height,
  })

  assert.equal(
    settledLayout.dialog.top,
    settledLayout.navigation.top + settledLayout.navigation.height + 8,
  )
})

test('keeps prompt chrome reachable with one local reference and billing controls in a 390x300 stage', () => {
  const stage = { left: 0, top: 0, right: 390, bottom: 300 }
  const sizing = getCanvasTaskDialogSizing({
    stageHeight: stage.bottom - stage.top,
    fixedTopHeight: 64,
    fixedBottomHeight: 72,
    promptChromeHeight: 96,
  })

  assert.deepEqual(sizing, {
    height: 232,
    maxHeight: 232,
    compactFixedControls: true,
    promptBodyHeight: 64,
  })

  const node = { left: 71, top: 64, width: 248, height: 220 }
  const firstLayout = getCanvasNodeContextSurfaceLayout({ node, stage, dialogHeight: sizing.height })
  const settledLayout = getCanvasNodeContextSurfaceLayout({
    node: { ...node, top: node.top + firstLayout.panDeltaY },
    stage,
    dialogHeight: sizing.height,
  })

  assert.deepEqual(
    { width: settledLayout.dialog.width, height: settledLayout.dialog.height },
    { width: 358, height: 232 },
  )
  assert.equal(
    settledLayout.dialog.top,
    settledLayout.navigation.top + settledLayout.navigation.height + 8,
  )
})

test('reports compact mode without promising prompt space when the stage is physically impossible', () => {
  assert.deepEqual(
    getCanvasTaskDialogSizing({
      stageHeight: 120,
      fixedTopHeight: 64,
      fixedBottomHeight: 72,
      promptChromeHeight: 96,
    }),
    {
      height: 52,
      maxHeight: 52,
      compactFixedControls: true,
      promptBodyHeight: 0,
    },
  )
})

test('requests an upward Canvas pan for a below-node dialog without moving navigation away from the node', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 300, top: 460, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1280, bottom: 720 },
  })

  assert.equal(layout.navigation.top, 424)
  assert.equal(layout.dialog.top, 688)
  assert.equal(layout.panDeltaY, -194)
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

test('reserves viewport margins, navigation height, and gap in the runtime task max height', () => {
  assert.match(visualCanvasWorkspaceSource, /maxHeight: 'calc\(100vh - 68px\)'/)
  assert.doesNotMatch(visualCanvasWorkspaceSource, /maxHeight: 'calc\(100vh - 32px\)'/)
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
  const toolbarStyleStart = visualCanvasWorkspaceSource.indexOf('const toolbarFixedStyle')
  const toolbarStyleEnd = visualCanvasWorkspaceSource.indexOf('// Resolve upstream image', toolbarStyleStart)
  const toolbarStyleSource = visualCanvasWorkspaceSource.slice(toolbarStyleStart, toolbarStyleEnd)
  assert.match(toolbarStyleSource, /position: 'fixed'/)
  assert.match(toolbarStyleSource, /zIndex: 92/)
})

test('normal generation entry restores both the editing node and Task category after reset', () => {
  const openPanelStart = visualCanvasWorkspaceSource.indexOf('const openCanvasPanel = useCallback')
  const openPanelEnd = visualCanvasWorkspaceSource.indexOf('const openGenerationDialog', openPanelStart)
  const openPanelSource = visualCanvasWorkspaceSource.slice(openPanelStart, openPanelEnd)
  const generationStart = openPanelSource.indexOf("case 'generation':")
  const generationEnd = openPanelSource.indexOf('break', generationStart)
  const generationSource = openPanelSource.slice(generationStart, generationEnd)

  assert.notEqual(generationStart, -1, 'missing generation modal case')
  assert.match(generationSource, /setEditingNodeId\(payload\.nodeId\)/)
  assert.match(generationSource, /setActiveNodeContextCategory\('task'\)/)
})

test('uses the taller fixed-surface height only for the task category', () => {
  const start = visualCanvasWorkspaceSource.indexOf('const nodeContextDialogHeight')
  const end = visualCanvasWorkspaceSource.indexOf('useEffect(() => {', start)
  const layoutSource = visualCanvasWorkspaceSource.slice(start, end)

  assert.notEqual(start, -1)
  assert.match(layoutSource, /activeNodeContextCategory === 'task' \? nodeTaskDialogHeight : 210/)
  assert.match(layoutSource, /dialogHeight: nodeContextDialogHeight/)
})

test('keeps node task shell static and assigns scrolling only to prompt content', () => {
  const marker = '/* Node task dialog fixed surfaces */'
  const markerIndex = canvasModuleSource.indexOf(marker)

  assert.notEqual(markerIndex, -1, 'missing final fixed-surface CSS marker')

  const finalRules = canvasModuleSource.slice(markerIndex)
  assert.match(finalRules, /\.canvas-node-dialog\.create-floating-console\) \{[\s\S]*?overflow: hidden;/)
  assert.match(finalRules, /\.canvas-node-dialog-scroll-content\) \{[\s\S]*?overflow-y: auto;/)
  assert.match(finalRules, /\.canvas-node-dialog-fixed-header\) \{[\s\S]*?flex: 0 0 auto;/)
  assert.match(finalRules, /\.canvas-node-dialog-fixed-footer\) \{[\s\S]*?flex: 0 0 auto;/)
  assert.match(
    finalRules,
    /\.canvas-node-dialog \.canvas-prompt-box\.is-node\) \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;/,
  )
  assert.doesNotMatch(
    finalRules,
    /\.canvas-node-dialog \.canvas-prompt-box\.is-node\) \{[^}]*height: 100%;/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog-fixed-controls\) \{[^}]*display: flex;[^}]*overflow-x: auto;/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog-billing-controls\) \{[^}]*display: flex;[^}]*overflow-x: auto;/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog\.is-compact-fixed-controls \.canvas-node-dialog-fixed-controls\.is-top > \[data-no-node-drag='true'\]\) \{[^}]*flex: 0 0 min\(340px, calc\(100vw - 32px\)\);[^}]*width: min\(340px, calc\(100vw - 32px\)\);/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog-account-list\) \{[^}]*overflow-x: auto;[^}]*overflow-y: hidden;/,
  )
  assert.match(finalRules, /\.canvas-node-dialog\.is-compact-fixed-controls/)
})

test('keeps reference and billing controls in fixed regions outside the prompt box', () => {
  const topControlsStart = visualCanvasWorkspaceSource.indexOf('className="canvas-node-dialog-fixed-controls is-top"')
  const promptStart = visualCanvasWorkspaceSource.indexOf('<CanvasPromptBox', topControlsStart)
  const bottomControlsStart = visualCanvasWorkspaceSource.indexOf('className="canvas-node-dialog-fixed-controls is-bottom"', promptStart)
  const topControlsSource = visualCanvasWorkspaceSource.slice(topControlsStart, promptStart)
  const bottomControlsSource = visualCanvasWorkspaceSource.slice(bottomControlsStart)

  assert.notEqual(topControlsStart, -1, 'missing fixed reference-controls wrapper')
  assert.ok(promptStart > topControlsStart, 'prompt box must follow fixed reference controls')
  assert.ok(bottomControlsStart > promptStart, 'fixed billing controls must follow the prompt box')
  assert.match(topControlsSource, /<UpstreamTaskStrip/)
  assert.match(topControlsSource, /<LocalReferenceStrip/)
  assert.match(bottomControlsSource, /SHOW_GENERATION_CONTEXT_CHIPS/)
  assert.match(bottomControlsSource, /API 费用来源/)
})

test('expands only the task surface from its measured fixed-control stack', () => {
  assert.match(
    visualCanvasWorkspaceSource,
    /const \[nodeTaskDialogHeight, setNodeTaskDialogHeight\] = useState\(282\)/,
  )
  assert.match(
    visualCanvasWorkspaceSource,
    /activeNodeContextCategory === 'task' \? nodeTaskDialogHeight : 210/,
  )
  assert.match(visualCanvasWorkspaceSource, /nodeTaskDialogFixedTopRef/)
  assert.match(visualCanvasWorkspaceSource, /nodeTaskDialogFixedBottomRef/)
  assert.match(visualCanvasWorkspaceSource, /new ResizeObserver\(measureTaskDialogHeight\)/)
  assert.match(visualCanvasWorkspaceSource, /getCanvasTaskDialogSizing\(/)
  assert.match(visualCanvasWorkspaceSource, /compactFixedControls/)
  assert.match(visualCanvasWorkspaceSource, /nodeTaskDialogCompactControls \? ' is-compact-fixed-controls' : ''/)
})

test('uses node-anchored geometry without zoom-scaled dialog placement', () => {
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
