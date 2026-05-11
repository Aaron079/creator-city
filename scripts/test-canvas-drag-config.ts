#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const ROOT = '/Users/aaron/creator-city'
const WORKSPACE_FILE = path.join(ROOT, 'apps/web/src/components/create/VisualCanvasWorkspace.tsx')
const NODE_CARD_FILE = path.join(ROOT, 'apps/web/src/components/create/CanvasNodeCard.tsx')
const CSS_FILE = path.join(ROOT, 'apps/web/src/components/create/canvas.module.css')

function read(file: string) {
  if (!existsSync(file)) throw new Error(`Missing file: ${file}`)
  return readFileSync(file, 'utf8')
}

function block(source: string, selector: string) {
  const index = source.indexOf(selector)
  if (index < 0) return ''
  const end = source.indexOf('\n}', index)
  return end < 0 ? source.slice(index) : source.slice(index, end + 2)
}

function openingTag(source: string, selector: string) {
  const index = source.indexOf(selector)
  if (index < 0) return ''
  const start = source.lastIndexOf('<', index)
  const end = source.indexOf('>', index)
  return start < 0 || end < 0 ? '' : source.slice(start, end)
}

const workspace = read(WORKSPACE_FILE)
const nodeCard = read(NODE_CARD_FILE)
const css = read(CSS_FILE)

const checks: Array<{ label: string; pass: boolean; detail: string }> = []
function check(label: string, pass: boolean, detail: string) {
  checks.push({ label, pass, detail })
}

const usesReactFlow = /\bReactFlow\b|reactflow|@xyflow/i.test(workspace + nodeCard)
const rootStart = nodeCard.indexOf('<motion.div')
const rootOpenEnd = rootStart >= 0 ? nodeCard.indexOf('>', rootStart) : -1
const rootOpeningTag = rootStart >= 0 && rootOpenEnd >= 0 ? nodeCard.slice(rootStart, rootOpenEnd) : ''
const imagePreviewOpeningTag = openingTag(nodeCard, 'className="canvas-node-image-button"')
const videoPreviewOpeningTag = openingTag(nodeCard, 'className="canvas-node-video-button"')
const imageErrorBlock = block(css, '.scope :global(.canvas-node-image-error)')
const videoErrorBlock = block(css, '.scope :global(.canvas-node-video-error)')
const previewBlock = block(css, '.scope :global(.canvas-node-preview)')

check('1. Canvas is custom canvas', !usesReactFlow, usesReactFlow ? 'ReactFlow detected' : 'custom canvas, no ReactFlow')
check('2. CanvasNodeCard root supports pointerdown', rootOpeningTag.includes('data-node-drag-root="true"') && rootOpeningTag.includes('onPointerDown'), 'root drag surface starts node drag')
check('3. interactive controls are excluded from drag', nodeCard.includes('function isInteractiveTarget') && ['button', 'input', 'textarea', 'select', 'a', '[data-no-node-drag="true"]', '.canvas-node-dialog'].every((token) => nodeCard.includes(token)), 'buttons, inputs, links, data-no-node-drag and dialogs are excluded')
check('4. error display area no longer blocks dragging', !imagePreviewOpeningTag.includes('data-no-node-drag="true"') && !videoPreviewOpeningTag.includes('data-no-node-drag="true"'), 'image/video preview and error surfaces are drag surfaces; nested buttons remain excluded')
check('5. error overlay does not cover drag root', previewBlock.includes('position: relative') && imageErrorBlock.includes('position: absolute') && videoErrorBlock.includes('position: absolute') && !imageErrorBlock.includes('position: fixed') && !videoErrorBlock.includes('position: fixed'), 'error overlays are scoped inside preview, not across the card root')
check('6. onPointerMove exists', workspace.includes("window.addEventListener('pointermove'") && workspace.includes('handleNodePatch(drag.nodeId'), 'window pointermove updates node x/y')
check('7. onPointerUp exists', workspace.includes("window.addEventListener('pointerup'") && workspace.includes("window.addEventListener('pointercancel'"), 'window pointerup/pointercancel stop node drag')
check('8. scheduleCanvasSave saves position', workspace.includes('x: drag.latestX') && workspace.includes('y: drag.latestY') && workspace.includes('flushLocalSnapshot()') && workspace.includes('scheduleCanvasSave(0)'), 'pointerup flushes local snapshot and schedules save')
check('9. double click frame does not open edit modal', nodeCard.includes('onDoubleClick={(event) =>') && nodeCard.includes('onSelect()') && !rootOpeningTag.includes('onEdit') && !nodeCard.includes('onDoubleClick={(event) => {\n        event.preventDefault()\n        event.stopPropagation()\n        onEdit()'), 'root double-click only selects; edit is not opened by double-click')
check('10. node position is refresh-persistent', workspace.includes('writeUnifiedLocalSnapshot({ nodes: nextNodes })') && workspace.includes('saveCanvas') && workspace.includes('scheduleCanvasSave(0)') && workspace.includes('left: node.x') && workspace.includes('top: node.y'), 'dragged x/y are rendered from node state and persisted through canvas save')

check('11. cursor grab/grabbing', css.includes('cursor: grab') && css.includes('cursor: grabbing'), 'CSS exposes draggable affordance')
check('12. button move threshold suppresses accidental click', nodeCard.includes('suppressInteractiveClickRef') && nodeCard.includes('movedBeyondClickThreshold'), 'button press/move beyond threshold suppresses click')

console.log('\n=== Canvas Drag Config Audit ===\n')
console.log(`Canvas: ${usesReactFlow ? 'ReactFlow' : 'custom'}`)
console.log(`Drag handler file: ${WORKSPACE_FILE}`)
console.log(`Node card file: ${NODE_CARD_FILE}`)
console.log('Drag starts: CanvasNodeCard root onPointerDown -> handleNodeDragStart')
console.log('Drag moves: window pointermove -> handleNodePatch({ x, y })')
console.log('Drag stops: window pointerup/pointercancel -> flushLocalSnapshot + scheduleCanvasSave(0)')
console.log('Node drag area: card root, border, header, blank, preview, and error surfaces')
console.log('Nodrag controls: buttons, inputs, textarea, select, links, connection handles, dialogs, and data-no-node-drag overlays\n')

for (const item of checks) {
  console.log(`${item.pass ? '✓' : '✗'} ${item.label}: ${item.detail}`)
}

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.log(`\nFAIL: ${failed.length} drag config checks failed.`)
  process.exit(1)
}

console.log('\nPASS: custom canvas drag config is wired for persistent full-card node movement.\n')
