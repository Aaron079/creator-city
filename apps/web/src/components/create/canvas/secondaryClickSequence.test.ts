import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  SECONDARY_CLICK_INTERVAL_MS,
  registerSecondaryClick,
} from './secondaryClickSequence'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, '../VisualCanvasWorkspace.tsx'), 'utf8')
const nodeCardSource = readFileSync(resolve(testDirectory, '../CanvasNodeCard.tsx'), 'utf8')
const nodeLayerSource = readFileSync(resolve(testDirectory, 'CanvasNodeLayer.tsx'), 'utf8')

test('waits for a second right-click on the same target before opening a picker', () => {
  const first = registerSecondaryClick(null, {
    target: 'canvas',
    occurredAt: 1_000,
  })

  assert.deepEqual(first, {
    shouldOpenPicker: false,
    next: { target: 'canvas', occurredAt: 1_000 },
  })

  const second = registerSecondaryClick(first.next, {
    target: 'canvas',
    occurredAt: 1_000 + SECONDARY_CLICK_INTERVAL_MS - 1,
  })

  assert.deepEqual(second, {
    shouldOpenPicker: true,
    next: null,
  })
})

test('treats a delayed or differently targeted right-click as a new first click', () => {
  const first = { target: 'node:source', occurredAt: 2_000 }

  assert.deepEqual(
    registerSecondaryClick(first, {
      target: 'node:source',
      occurredAt: 2_000 + SECONDARY_CLICK_INTERVAL_MS + 1,
    }),
    {
      shouldOpenPicker: false,
      next: {
        target: 'node:source',
        occurredAt: 2_000 + SECONDARY_CLICK_INTERVAL_MS + 1,
      },
    },
  )

  assert.deepEqual(
    registerSecondaryClick(first, {
      target: 'node:other',
      occurredAt: 2_050,
    }),
    {
      shouldOpenPicker: false,
      next: { target: 'node:other', occurredAt: 2_050 },
    },
  )
})

test('routes Canvas and node-card secondary clicks to creation pickers while retaining explicit node management', () => {
  assert.match(workspaceSource, /onContextMenu=\{handleCanvasSecondaryClick\}/)
  assert.match(workspaceSource, /target: 'canvas'/)
  assert.match(workspaceSource, /setNodeCreateMenu\(\{ \.\.\.position, worldX: worldPoint\.x, worldY: worldPoint\.y \}\)/)
  assert.match(workspaceSource, /onSecondaryClick: \(event\) => handleNodeSecondaryClick\(node\.id, event\)/)
  assert.match(workspaceSource, /target: `node:\$\{nodeId\}`/)
  assert.match(workspaceSource, /openNodeAddMenu\(nodeId, 'out'\)/)

  assert.match(nodeCardSource, /onContextMenu=\{\(event\) => \{[\s\S]*?onSecondaryClick\(event\)/)
  assert.match(nodeCardSource, /onClick=\{\(event\) => \{[\s\S]*?onOpenContextMenu\(event\)[\s\S]*?className="canvas-node-more"/)
  assert.match(nodeLayerSource, /onSecondaryClick=\{\(event\) => latestCardProps\(\)\.onSecondaryClick\(event\)\}/)
})

test('opens the Canvas task picker on double-click instead of immediately creating a video node', () => {
  const handlerStart = workspaceSource.indexOf('const handleCanvasDoubleClick = useCallback')
  const handlerEnd = workspaceSource.indexOf('const handleCanvasSecondaryClick', handlerStart)
  const handlerSource = workspaceSource.slice(handlerStart, handlerEnd)

  assert.notEqual(handlerStart, -1, 'missing Canvas double-click handler')
  assert.match(handlerSource, /setNodeCreateMenu\(\{ \.\.\.position, worldX: worldPoint\.x, worldY: worldPoint\.y \}\)/)
  assert.doesNotMatch(handlerSource, /createNode\('video'/)
  assert.doesNotMatch(handlerSource, /focusPromptForNode\(/)
})

test('wires active node edge and corner handles to proportional resizing without replacing existing Canvas interactions', () => {
  assert.match(nodeCardSource, /data-canvas-node-resize-handle=\{handle\}/)
  assert.match(nodeCardSource, /onResizeStart: \(event: React\.PointerEvent<HTMLButtonElement>, handle: CanvasNodeResizeHandle\) => void/)
  for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    assert.match(nodeCardSource, new RegExp(`handle: '${handle}'`))
  }
  assert.match(nodeLayerSource, /onResizeStart=\{\(event, handle\) => latestCardProps\(\)\.onResizeStart\(event, handle\)\}/)
  assert.match(workspaceSource, /import \{[\s\S]*?resizeNodeRect,[\s\S]*?type CanvasResizeHandle,[\s\S]*?\} from '@\/components\/create\/canvas\/canvasResizeGeometry'/)
  assert.match(workspaceSource, /const handleNodeResizeStart = useCallback/)
  assert.match(workspaceSource, /!event\.isPrimary[\s\S]*?nodeDragRef\.current[\s\S]*?nodeResizeRef\.current[\s\S]*?connectionDragRef\.current/)
  assert.match(workspaceSource, /resizeNodeRect\(\{[\s\S]*?handle: resize\.handle/)

  const pointerUpStart = workspaceSource.indexOf('const handlePointerUp = (event: PointerEvent) => {')
  const pointerUpSource = workspaceSource.slice(pointerUpStart, pointerUpStart + 1_800)
  assert.notEqual(pointerUpStart, -1, 'missing Canvas pointer release handler')
  assert.match(pointerUpSource, /nodeResizeRef\.current = null/)
  assert.match(pointerUpSource, /flushLocalSnapshot\(\)[\s\S]*?scheduleCanvasSave\(0\)/)

  const pointerCancelStart = workspaceSource.indexOf('const handlePointerCancel = (event: PointerEvent) => {')
  const pointerCancelSource = workspaceSource.slice(pointerCancelStart, pointerCancelStart + 1_000)
  assert.notEqual(pointerCancelStart, -1, 'missing Canvas pointer cancellation handler')
  assert.match(pointerCancelSource, /discardNodeResizePreview\(resize\.nodeId, resize\.startRect\)/)
  assert.doesNotMatch(pointerCancelSource, /scheduleCanvasSave\(0\)/)
  assert.match(workspaceSource, /window\.addEventListener\('lostpointercapture', handlePointerCancel, true\)/)
  assert.match(workspaceSource, /event\.key !== 'Escape'[\s\S]*?discardNodeResizePreview\(resize\.nodeId, resize\.startRect\)/)
})

test('keeps canvas pan mutually exclusive with node, connection, and editor resize gestures', () => {
  for (const handlerName of [
    'handleNodeDragStart',
    'handleNodeResizeStart',
    'startConnectionDrag',
    'handleCanvasPointerDown',
    'handleTaskEditorResizeStart',
  ]) {
    const handlerStart = workspaceSource.indexOf(`const ${handlerName} = useCallback`)
    const handlerSource = workspaceSource.slice(handlerStart, handlerStart + 1_100)

    assert.notEqual(handlerStart, -1, `missing ${handlerName}`)
    assert.match(handlerSource, /!event\.isPrimary[\s\S]*?\|\| isPanning/)
  }
})
