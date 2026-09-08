import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  clampCanvasDialogLeftToStage,
  clampCanvasDialogTopToStage,
  getCanvasNodeContextPanAdjustmentKey,
  getCanvasNodeContextSurfaceLayout,
  getCanvasNodeDialogSize,
  getCanvasNodeSize,
  getCanvasTaskDialogSizing,
  normalizeLegacyCanvasNodeSize,
  stabilizeCanvasTaskDialogSizing,
} from './canvasWorkspaceLayout'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const visualCanvasWorkspaceSource = readFileSync(resolve(testDirectory, '../VisualCanvasWorkspace.tsx'), 'utf8')
const canvasModuleSource = readFileSync(resolve(testDirectory, '../canvas.module.css'), 'utf8')
const canvasPromptBoxSource = readFileSync(resolve(testDirectory, '../CanvasPromptBox.tsx'), 'utf8')
const canvasWorkspaceLayoutSource = readFileSync(resolve(testDirectory, 'canvasWorkspaceLayout.ts'), 'utf8')
const renderedTaskDialogTestSource = readFileSync(
  resolve(testDirectory, 'canvasTaskDialog.rendered-layout.test.tsx'),
  'utf8',
)

function settleCanvasStack({
  node,
  stage,
  dialogHeight,
}: {
  node: { left: number; top: number; width: number; height: number }
  stage: { left: number; top: number; right: number; bottom: number }
  dialogHeight: number
}) {
  const first = getCanvasNodeContextSurfaceLayout({ node, stage, dialogHeight })
  const settledNode = { ...node, top: node.top + first.panDeltaY }
  const settled = getCanvasNodeContextSurfaceLayout({ node: settledNode, stage, dialogHeight })
  return { node: settledNode, layout: settled }
}

test('uses the approved creative-workbench node dimensions at 100% zoom', () => {
  assert.deepEqual(getCanvasNodeSize('text'), { width: 380, height: 194 })
  assert.deepEqual(getCanvasNodeSize('image'), { width: 380, height: 194 })
  assert.deepEqual(getCanvasNodeSize('video'), { width: 380, height: 194 })
})

test('anchors a 1:2 node-to-dialog creative-workbench stack on one centerline', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 380, height: 194 },
    stage: { left: 0, top: 64, right: 1440, bottom: 720 },
  })

  assert.deepEqual(layout.navigation, { left: 400, top: 84, width: 380, height: 28 })
  assert.deepEqual(layout.dialog, { left: 210, top: 322, width: 760, height: 292 })
  assert.equal(layout.navigation.left + layout.navigation.width / 2, layout.dialog.left + layout.dialog.width / 2)
  assert.equal(layout.dialog.width, layout.navigation.width * 2)
  assert.equal(layout.panDeltaY, 0)
})

test('uses a requested dialog size while preserving the shared node centerline', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 380, height: 194 },
    stage: { left: 0, top: 64, right: 1440, bottom: 900 },
    dialogSize: { width: 920, height: 388 },
  })

  assert.deepEqual(layout.dialog, { left: 130, top: 322, width: 920, height: 388 })
  assert.equal(layout.dialog.left + layout.dialog.width / 2, 590)
})

test('offsets a resized task dialog so an opposite edge can remain pinned', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 380, height: 194 },
    stage: { left: 0, top: 64, right: 1440, bottom: 900 },
    dialogSize: { width: 920, height: 388 },
    dialogOffset: { x: -20, y: 10 },
  })

  assert.deepEqual(layout.dialog, { left: 110, top: 332, width: 920, height: 388 })
})

test('clamps a requested dialog width without resizing navigation', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 380, height: 194 },
    stage: { left: 0, top: 64, right: 640, bottom: 900 },
    dialogSize: { width: 920, height: 388 },
  })

  assert.equal(layout.dialog.width, 608)
  assert.equal(layout.navigation.width, 380)
})

test('prefers dialogSize height over the legacy dialogHeight argument', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 380, height: 194 },
    stage: { left: 0, top: 64, right: 1440, bottom: 900 },
    dialogHeight: 282,
    dialogSize: { width: 920, height: 388 },
  })

  assert.equal(layout.dialog.height, 388)
})

test('keeps context surface geometry finite and nonnegative in zero and tiny stages', () => {
  for (const stage of [
    { left: 0, top: 0, right: 0, bottom: 0 },
    { left: 0, top: 0, right: 12, bottom: 20 },
  ]) {
    const layout = getCanvasNodeContextSurfaceLayout({
      node: { left: 0, top: 0, width: 380, height: 194 },
      stage,
      dialogSize: { width: 920, height: 388 },
    })

    for (const surface of [layout.navigation, layout.dialog]) {
      for (const value of Object.values(surface)) {
        assert.ok(Number.isFinite(value))
        assert.ok(value >= 0)
      }
    }
  }
})

test('falls back to default dimensions for invalid requested dialog sizes', () => {
  const node = { left: 400, top: 120, width: 380, height: 194 }
  const stage = { left: 0, top: 64, right: 1440, bottom: 900 }

  for (const dialogSize of [
    { width: 0, height: 0 },
    { width: -1, height: -1 },
    { width: Number.NaN, height: Number.NaN },
    { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY },
  ]) {
    const layout = getCanvasNodeContextSurfaceLayout({
      node,
      stage,
      dialogHeight: 282,
      dialogSize,
    })

    assert.deepEqual(layout.dialog, { left: 210, top: 322, width: 760, height: 282 })
  }
})

test('falls back zero requested dimensions independently from valid dimensions', () => {
  const node = { left: 400, top: 120, width: 380, height: 194 }
  const stage = { left: 0, top: 64, right: 1440, bottom: 900 }

  assert.deepEqual(
    getCanvasNodeContextSurfaceLayout({
      node,
      stage,
      dialogHeight: 282,
      dialogSize: { width: 0, height: 388 },
    }).dialog,
    { left: 210, top: 322, width: 760, height: 388 },
  )
  assert.deepEqual(
    getCanvasNodeContextSurfaceLayout({
      node,
      stage,
      dialogHeight: 282,
      dialogSize: { width: 920, height: 0 },
    }).dialog,
    { left: 130, top: 322, width: 920, height: 282 },
  )
})

test('preserves the legacy default dialog height when dialogSize is omitted', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 60, width: 380, height: 194 },
    stage: { left: 0, top: 0, right: 640, bottom: 300 },
  })

  assert.deepEqual(layout.dialog, { left: 16, top: 262, width: 608, height: 292 })
})

test('preserves a zero legacy dialogHeight when dialogSize is omitted', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 380, height: 194 },
    stage: { left: 0, top: 64, right: 1440, bottom: 900 },
    dialogHeight: 0,
  })

  assert.equal(layout.dialog.height, 0)
})

test('clamps oversized requested dialog dimensions to the available stage axes', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 60, width: 380, height: 194 },
    stage: { left: 0, top: 0, right: 640, bottom: 300 },
    dialogSize: { width: 920, height: 388 },
  })

  assert.deepEqual(layout.dialog, { left: 16, top: 262, width: 608, height: 268 })
  assert.equal(layout.minimumStageHeight, 538)
})

test('supports a taller task dialog without moving its node navigation', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1440, bottom: 800 },
    dialogHeight: 282,
  })

  assert.deepEqual(layout.navigation, { left: 334, top: 84, width: 380, height: 28 })
  assert.deepEqual(layout.dialog, { left: 144, top: 348, width: 760, height: 282 })
  assert.equal(layout.panDeltaY, 0)
})

test('uses a taller task dialog height to calculate stage overflow', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1440, bottom: 600 },
    dialogHeight: 282,
  })

  assert.deepEqual(layout.navigation, { left: 334, top: 84, width: 380, height: 28 })
  assert.equal(layout.dialog.top, 348)
  assert.equal(layout.panDeltaY, -46)
})

test('reapplies node context pan after a stage resize without looping on the pan itself', () => {
  const nodeId = 'image-node'
  const category = 'task'
  const dialogHeight = 282
  const canvasZoom = 1
  let node = { left: 71, top: 300, width: 248, height: 220 }
  let adjustmentKey: string | null = null

  const applyWorkspacePan = (stage: { left: number; top: number; right: number; bottom: number }) => {
    const layout = getCanvasNodeContextSurfaceLayout({ node, stage, dialogHeight })
    if (layout.panDeltaY === 0) return 0

    const nextKey = getCanvasNodeContextPanAdjustmentKey({
      nodeId,
      category,
      dialogHeight,
      stage,
      canvasZoom,
    })
    if (adjustmentKey === nextKey) return 0

    adjustmentKey = nextKey
    node = { ...node, top: node.top + layout.panDeltaY }
    return layout.panDeltaY
  }

  const supportedStage = { left: 0, top: 0, right: 390, bottom: 800 }
  assert.equal(applyWorkspacePan(supportedStage), -26)
  assert.equal(applyWorkspacePan(supportedStage), 0, 'auto-pan must not trigger another adjustment')

  const resizedStage = { ...supportedStage, bottom: 600 }
  assert.equal(applyWorkspacePan(resizedStage), -200, 'new stage bounds must permit a new adjustment')
  assert.equal(applyWorkspacePan(resizedStage), 0, 'settled resized geometry must remain deduplicated')
})

test('keys node context pan by vertical stage bounds and zoom, never canvas pan', () => {
  const geometry = {
    nodeId: 'image-node',
    category: 'task',
    dialogHeight: 282,
    stage: { left: 0, top: 0, right: 390, bottom: 800 },
    canvasZoom: 1,
  }
  const initialKey = getCanvasNodeContextPanAdjustmentKey(geometry)

  assert.equal(
    getCanvasNodeContextPanAdjustmentKey({ ...geometry }),
    initialKey,
    'unchanged geometry, including a canvas-pan-only rerender, must retain one key',
  )
  assert.notEqual(
    getCanvasNodeContextPanAdjustmentKey({
      ...geometry,
      stage: { ...geometry.stage, bottom: 600 },
    }),
    initialKey,
  )
  assert.notEqual(
    getCanvasNodeContextPanAdjustmentKey({ ...geometry, canvasZoom: 0.8 }),
    initialKey,
  )
})

test('keys task context pan by the resolved dialog width as well as height', () => {
  const geometry = {
    nodeId: 'image-node',
    category: 'task',
    dialogHeight: 292,
    dialogSize: { width: 760, height: 292 },
    stage: { left: 0, top: 0, right: 1440, bottom: 900 },
    canvasZoom: 1,
  }

  assert.notEqual(
    getCanvasNodeContextPanAdjustmentKey({
      ...geometry,
      dialogSize: { width: 920, height: 292 },
    }),
    getCanvasNodeContextPanAdjustmentKey(geometry),
  )
})

test('settles navigation, node, and dialog as a rigid stack inside a supported stage', () => {
  const stage = { left: 0, top: 0, right: 390, bottom: 800 }
  const { node, layout } = settleCanvasStack({
    node: { left: 71, top: 460, width: 248, height: 220 },
    stage,
    dialogHeight: 282,
  })
  const constraint = layout as typeof layout & {
    isVerticallyConstrained?: boolean
    minimumStageHeight?: number
  }

  assert.equal(constraint.isVerticallyConstrained, false)
  assert.equal(constraint.minimumStageHeight, 578)
  assert.ok(layout.navigation.top >= stage.top + 16)
  assert.ok(layout.navigation.top + layout.navigation.height <= node.top)
  assert.ok(node.top + node.height <= layout.dialog.top)
  assert.ok(layout.dialog.top + layout.dialog.height <= stage.bottom - 16)
  assert.equal(layout.panDeltaY, 0)
})

test('keeps constrained 390x300 stack ordered while prioritizing the usable dialog', () => {
  const stage = { left: 0, top: 0, right: 390, bottom: 300 }
  const { node, layout } = settleCanvasStack({
    node: { left: 71, top: 64, width: 248, height: 220 },
    stage,
    dialogHeight: 232,
  })
  const constraint = layout as typeof layout & {
    isVerticallyConstrained?: boolean
    minimumStageHeight?: number
  }

  assert.equal(constraint.isVerticallyConstrained, true)
  assert.equal(constraint.minimumStageHeight, 528)
  assert.equal(layout.dialog.top, 52)
  assert.equal(layout.dialog.top + layout.dialog.height, stage.bottom - 16)
  assert.ok(layout.navigation.top + layout.navigation.height <= node.top)
  assert.ok(node.top + node.height <= layout.dialog.top)
  assert.ok(layout.navigation.top < stage.top, 'upper constrained stack should remain offscreen')
  assert.equal(layout.panDeltaY, 0)
})

test('exposes pure task dialog sizing as a layout behavior boundary', () => {
  assert.match(canvasWorkspaceLayoutSource, /export function getCanvasTaskDialogSizing\(/)
})

test('keeps the 292px task height when fixed controls and prompt allowance fit', () => {
  assert.deepEqual(
    getCanvasTaskDialogSizing({
      stageHeight: 800,
      fixedTopHeight: 20,
      fixedBottomHeight: 30,
      promptChromeHeight: 100,
    }),
    {
      height: 292,
      maxHeight: 732,
      compactFixedControls: false,
      promptBodyHeight: 142,
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

test('caps an uncollapsed task dialog while preserving its navigation and stage bounds', () => {
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
    promptBodyHeight: 0,
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
    initialNode.top + firstLayout.panDeltaY,
    settledLayout.navigation.top + settledLayout.navigation.height + 8,
  )
  assert.equal(
    settledLayout.dialog.top,
    initialNode.top + firstLayout.panDeltaY + initialNode.height + 8,
  )
  assert.equal(settledLayout.isVerticallyConstrained, true)
})

test('keeps prompt chrome reachable with one local reference and billing controls in a 390x300 stage', () => {
  const stage = { left: 0, top: 0, right: 390, bottom: 300 }
  const sizing = getCanvasTaskDialogSizing({
    stageHeight: stage.bottom - stage.top,
    fixedTopHeight: 52,
    fixedBottomHeight: 52,
    promptChromeHeight: 90,
  })

  assert.deepEqual(sizing, {
    height: 232,
    maxHeight: 232,
    compactFixedControls: true,
    promptBodyHeight: 38,
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
    node.top + firstLayout.panDeltaY,
    settledLayout.navigation.top + settledLayout.navigation.height + 8,
  )
  assert.equal(
    settledLayout.dialog.top,
    node.top + firstLayout.panDeltaY + node.height + 8,
  )
  assert.equal(settledLayout.isVerticallyConstrained, true)
})

test('reports compact mode without promising prompt space when the stage is physically impossible', () => {
  assert.deepEqual(
    getCanvasTaskDialogSizing({
      stageHeight: 120,
      fixedTopHeight: 70,
      fixedBottomHeight: 72,
      promptChromeHeight: 123,
    }),
    {
      height: 52,
      maxHeight: 52,
      compactFixedControls: true,
      promptBodyHeight: 0,
    },
  )
})

test('retains compact task sizing across compact remeasurement until noncompact controls fit', () => {
  const expandedMeasurements = {
    fixedTopHeight: 160,
    fixedBottomHeight: 131,
    promptChromeHeight: 145,
  }
  const first = stabilizeCanvasTaskDialogSizing({
    stageHeight: 420,
    measurements: expandedMeasurements,
    compactFixedControls: false,
    noncompactMeasurements: null,
  })

  assert.equal(first.compactFixedControls, true)
  assert.equal(first.height, 352)
  assert.deepEqual(first.noncompactMeasurements, expandedMeasurements)

  const compactRemeasurement = stabilizeCanvasTaskDialogSizing({
    stageHeight: 420,
    measurements: {
      fixedTopHeight: 52,
      fixedBottomHeight: 52,
      promptChromeHeight: 90,
    },
    compactFixedControls: first.compactFixedControls,
    noncompactMeasurements: first.noncompactMeasurements,
  })

  assert.equal(compactRemeasurement.compactFixedControls, true)
  assert.equal(compactRemeasurement.height, 292)
  assert.deepEqual(compactRemeasurement.noncompactMeasurements, expandedMeasurements)

  const largerStage = stabilizeCanvasTaskDialogSizing({
    stageHeight: 570,
    measurements: {
      fixedTopHeight: 52,
      fixedBottomHeight: 52,
      promptChromeHeight: 90,
    },
    compactFixedControls: compactRemeasurement.compactFixedControls,
    noncompactMeasurements: compactRemeasurement.noncompactMeasurements,
  })

  assert.equal(largerStage.compactFixedControls, false)
  assert.equal(largerStage.height, 494)
})

test('requests an upward Canvas pan for a below-node dialog without moving navigation away from the node', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 300, top: 460, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1280, bottom: 720 },
  })

  assert.equal(layout.navigation.top, 424)
  assert.equal(layout.dialog.top, 688)
  assert.equal(layout.panDeltaY, -276)
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
  assert.match(
    visualCanvasWorkspaceSource,
    /getCanvasNodeContextPanAdjustmentKey\(\{[\s\S]*?stage: canvasStageBounds,[\s\S]*?canvasZoom,[\s\S]*?\}\)/,
  )
  assert.doesNotMatch(
    visualCanvasWorkspaceSource,
    /const adjustmentKey = `\$\{activeNode\.id\}:\$\{activeNodeContextCategory\}:\$\{nodeContextDialogHeight\}`/,
  )
  assert.match(visualCanvasWorkspaceSource, /window\.requestAnimationFrame/)
  const toolbarStyleStart = visualCanvasWorkspaceSource.indexOf('const toolbarFixedStyle')
  const toolbarStyleEnd = visualCanvasWorkspaceSource.indexOf('// Resolve upstream image', toolbarStyleStart)
  const toolbarStyleSource = visualCanvasWorkspaceSource.slice(toolbarStyleStart, toolbarStyleEnd)
  assert.match(toolbarStyleSource, /position: 'fixed'/)
  assert.match(toolbarStyleSource, /zIndex: 92/)
})

test('keeps an open node context attached while the node card is dragged from its surface', () => {
  const dragStart = visualCanvasWorkspaceSource.indexOf('const handleNodeDragStart = useCallback')
  const dragEnd = visualCanvasWorkspaceSource.indexOf('const pendingCommentCount', dragStart)
  const dragSource = visualCanvasWorkspaceSource.slice(dragStart, dragEnd)

  assert.notEqual(dragStart, -1, 'missing node drag handler')
  assert.match(dragSource, /setActiveNodeId\(nodeId\)/)
  assert.doesNotMatch(dragSource, /setEditingNodeId\(null\)/)
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

test('resizes the task editor with eight handles while retaining fixed dialog rails', () => {
  const resizeStart = visualCanvasWorkspaceSource.indexOf('const handleTaskEditorResizeStart')
  const resizeEnd = visualCanvasWorkspaceSource.indexOf('const toolbarFixedStyle', resizeStart)
  const resizeSource = visualCanvasWorkspaceSource.slice(resizeStart, resizeEnd)

  assert.notEqual(resizeStart, -1, 'missing task editor resize handler')
  assert.match(visualCanvasWorkspaceSource, /metadataJson: \{[\s\S]*?taskEditorSize/)
  assert.match(visualCanvasWorkspaceSource, /metadataJson: \{[\s\S]*?taskEditorOffset/)
  assert.match(visualCanvasWorkspaceSource, /resizeEditorRect\(\{/)
  assert.match(visualCanvasWorkspaceSource, /getEditorResizeOffset\(\{/)
  assert.match(visualCanvasWorkspaceSource, /dialogSize: nodeTaskDialogSize/)
  assert.match(visualCanvasWorkspaceSource, /dialogOffset: activeNodeContextCategory === 'task' \? taskEditorOffset : undefined/)
  assert.match(resizeSource, /const startOuterSize = \{[\s\S]*?width: nodeContextSurfaceLayout\.dialog\.width/)
  assert.match(resizeSource, /const startOffset = \{[\s\S]*?nodeContextSurfaceLayout\.dialog\.left - nodeContextSurfaceLayout\.baseDialog\.left/)
  assert.match(visualCanvasWorkspaceSource, /nodeTaskEditorContentHeight/)
  assert.match(canvasPromptBoxSource, /data-canvas-task-editor-resize-handle=\{handle\}/)
  assert.match(canvasPromptBoxSource, /\['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'\]/)
  assert.match(canvasModuleSource, /\.canvas-task-editor-resize-handle\) \{[\s\S]*?pointer-events: auto;/)
  assert.match(canvasModuleSource, /\.canvas-task-editor-resize-handle\) \{[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/)
  assert.match(resizeSource, /flushLocalSnapshot\(\)/)
  assert.match(resizeSource, /scheduleCanvasSave\(0, \{ snapshot: 'already-flushed' \}\)/)
  assert.match(canvasModuleSource, /canvas-task-editor-resize-handle/)
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
    /\.canvas-node-dialog\.is-compact-fixed-controls \.canvas-node-dialog-fixed-controls\.is-top\),[\s\S]*?\.canvas-node-dialog\.is-compact-fixed-controls \.canvas-node-dialog-fixed-controls\.is-bottom\) \{[^}]*width: 100%;[^}]*max-width: 100%;/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog-account-list\) \{[^}]*overflow-x: auto;[^}]*overflow-y: hidden;/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog\.is-compact-fixed-controls \.canvas-node-dialog-fixed-header\) \{[^}]*padding: 2px 8px;/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog\.is-compact-fixed-controls \.canvas-video-mode-bar\) \{[^}]*padding: 2px 6px;[^}]*margin-bottom: 0;/,
  )
  assert.match(
    finalRules,
    /\.canvas-node-dialog\.is-compact-fixed-controls \.canvas-node-dialog-fixed-footer\) \{[^}]*padding: 3px 8px 4px;/,
  )
  assert.match(finalRules, /\.canvas-node-dialog\.is-compact-fixed-controls/)
})

test('keeps compact task controls in one vertical column', () => {
  const marker = '/* Node task dialog fixed surfaces */'
  const finalRules = canvasModuleSource.slice(canvasModuleSource.lastIndexOf(marker))

  assert.match(
    finalRules,
    /\.canvas-node-dialog\.is-compact-fixed-controls\) \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/,
  )
  assert.doesNotMatch(finalRules, /\.canvas-node-dialog\.is-compact-fixed-controls\) \{\s*display:\s*grid;/)
  assert.doesNotMatch(finalRules, /grid-column:\s*2;/)
  assert.match(
    canvasWorkspaceLayoutSource,
    /const fixedHeight = measurements\.fixedTopHeight\s*\+ measurements\.fixedBottomHeight\s*\+ measurements\.promptChromeHeight/,
  )
})

test('keeps reference and billing controls in fixed regions outside the prompt box', () => {
  const topControlsStart = visualCanvasWorkspaceSource.indexOf('canvas-node-dialog-fixed-controls is-top')
  const promptStart = visualCanvasWorkspaceSource.indexOf('<CanvasPromptBox', topControlsStart)
  const bottomControlsStart = visualCanvasWorkspaceSource.indexOf('canvas-node-dialog-fixed-controls is-bottom', promptStart)
  const topControlsSource = visualCanvasWorkspaceSource.slice(topControlsStart, promptStart)
  const bottomControlsSource = visualCanvasWorkspaceSource.slice(bottomControlsStart)

  assert.notEqual(topControlsStart, -1, 'missing fixed reference-controls wrapper')
  assert.ok(promptStart > topControlsStart, 'prompt box must follow fixed reference controls')
  assert.ok(bottomControlsStart > promptStart, 'fixed billing controls must follow the prompt box')
  assert.match(topControlsSource, /<UpstreamTaskStrip/)
  assert.match(topControlsSource, /<LocalReferenceStrip/)
  assert.match(topControlsSource, /nodeTaskDialogCompactControls \? ' is-compact-fixed-controls' : ''/)
  assert.match(bottomControlsSource, /SHOW_GENERATION_CONTEXT_CHIPS/)
  assert.match(bottomControlsSource, /API 费用来源/)
})

test('uses a concise actionable status when the selected BYOK provider has no account', () => {
  assert.match(
    visualCanvasWorkspaceSource,
    /未配置匹配 API 账户。[\s\S]{0,240}前往添加/,
  )
})

test('renders the real CanvasPromptBox and image-to-video mode in the Chromium matrix', () => {
  assert.match(renderedTaskDialogTestSource, /createRequire\(import\.meta\.url\)/)
  assert.match(renderedTaskDialogTestSource, /require\.resolve\('esbuild\/bin\/esbuild'\)/)
  assert.doesNotMatch(renderedTaskDialogTestSource, /node_modules\/\.pnpm/)
  assert.match(renderedTaskDialogTestSource, /import \{ CanvasPromptBox \} from/)
  assert.match(renderedTaskDialogTestSource, /stabilizeCanvasTaskDialogSizing \} from/)
  assert.match(renderedTaskDialogTestSource, /React\.createElement\(CanvasPromptBox,/)
  assert.match(renderedTaskDialogTestSource, /mode: 'image-to-video'/)
  assert.match(renderedTaskDialogTestSource, /sourceNodeTitle: 'Upstream portrait'/)
  assert.match(renderedTaskDialogTestSource, /\.canvas-video-mode-bar\.is-image-to-video/)
  assert.doesNotMatch(
    renderedTaskDialogTestSource,
    /className: 'canvas-node-dialog create-floating-console is-compact-fixed-controls'/,
  )
  assert.doesNotMatch(renderedTaskDialogTestSource, /style: \{ width: 358, height: 232 \}/)
})

test('renders navigation, node, and task dialog as a complete Chromium stack', () => {
  assert.match(renderedTaskDialogTestSource, /import \{ getCanvasNodeContextSurfaceLayout,/)
  assert.match(renderedTaskDialogTestSource, /id: 'canvas-stage'/)
  assert.match(renderedTaskDialogTestSource, /id: 'node-navigation'/)
  assert.match(renderedTaskDialogTestSource, /id: 'representative-node'/)
  assert.match(renderedTaskDialogTestSource, /function assertStackOrdering/)
})

test('expands only the task surface from its measured fixed-control stack', () => {
  assert.match(
    visualCanvasWorkspaceSource,
    /const \[nodeTaskDialogHeight, setNodeTaskDialogHeight\] = useState\(292\)/,
  )
  assert.match(
    visualCanvasWorkspaceSource,
    /activeNodeContextCategory === 'task' \? nodeTaskDialogHeight : 210/,
  )
  assert.match(visualCanvasWorkspaceSource, /nodeTaskDialogFixedTopRef/)
  assert.match(visualCanvasWorkspaceSource, /nodeTaskDialogFixedBottomRef/)
  assert.match(visualCanvasWorkspaceSource, /nodeTaskDialogNoncompactMeasurementsRef/)
  assert.match(visualCanvasWorkspaceSource, /nodeTaskDialogMeasurementKey/)
  assert.match(visualCanvasWorkspaceSource, /new ResizeObserver\(measureTaskDialogHeight\)/)
  assert.match(visualCanvasWorkspaceSource, /stabilizeCanvasTaskDialogSizing\(/)
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

test('migrates legacy default node dimensions to the creative-workbench scale', () => {
  assert.deepEqual(
    normalizeLegacyCanvasNodeSize({ id: 'video-1', kind: 'video', width: 380, height: 320 }),
    { id: 'video-1', kind: 'video', width: 380, height: 194 },
  )
})

test('migrates prior compact display node dimensions to the approved workbench scale', () => {
  assert.deepEqual(
    normalizeLegacyCanvasNodeSize({ id: 'text-1', kind: 'text', width: 236, height: 208 }),
    { id: 'text-1', kind: 'text', width: 380, height: 194 },
  )
})

test('preserves a node with a non-default custom size', () => {
  assert.deepEqual(
    normalizeLegacyCanvasNodeSize({ id: 'image-1', kind: 'image', width: 512, height: 288 }),
    { id: 'image-1', kind: 'image', width: 512, height: 288 },
  )
})
