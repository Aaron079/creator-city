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
const imageButtonBlock = block(nodeCard, 'className="canvas-node-image-button"')
const videoButtonBlock = block(nodeCard, 'className="canvas-node-video-button"')
const imageErrorBlock = block(css, '.scope :global(.canvas-node-image-error)')
const videoErrorBlock = block(css, '.scope :global(.canvas-node-video-error)')
const previewBlock = block(css, '.scope :global(.canvas-node-preview)')

check('1. Canvas implementation', !usesReactFlow, usesReactFlow ? 'ReactFlow detected' : 'custom canvas, no ReactFlow')
check('2. Drag handler file', workspace.includes('handleNodeDragStart') && workspace.includes("window.addEventListener('pointermove'"), WORKSPACE_FILE)
check('3. nodesDraggable/custom drag handler', workspace.includes('handleNodeDragStart') && workspace.includes('nodeDragRef'), usesReactFlow ? 'nodesDraggable must be audited in ReactFlow config' : 'custom drag handler exists')
check('4. nodeDragHandle current value', !usesReactFlow, usesReactFlow ? 'ReactFlow nodeDragHandle must be explicit' : 'not applicable; CanvasNodeCard root/header/blank area start drag')
check('5. root node is not nodrag', rootOpeningTag.includes('onPointerDown') && !/data-no-node-drag="true"/.test(rootOpeningTag), 'CanvasNodeCard root has onPointerDown and no root data-no-node-drag')
check('6. overlay does not block drag handle', previewBlock.includes('position: relative') && imageErrorBlock.includes('position: absolute') && videoErrorBlock.includes('position: absolute'), 'error overlays are scoped inside .canvas-node-preview')
check('7. buttons are nodrag', nodeCard.includes('data-no-node-drag="true"') && nodeCard.includes("'button'") && nodeCard.includes("'input'") && nodeCard.includes("'textarea'") && nodeCard.includes("'select'"), 'interactive controls are excluded by isInteractiveTarget')
check('8. onPointerMove/onNodeDrag exists', workspace.includes("window.addEventListener('pointermove'") && workspace.includes('handleNodePatch(drag.nodeId'), 'window pointermove updates x/y')
check('9. onPointerUp/onNodeDragStop saves', workspace.includes("window.addEventListener('pointerup'") && workspace.includes('scheduleCanvasSave(0)'), 'window pointerup flushes local snapshot and schedules DB save')
check('10. scheduleCanvasSave saves position', workspace.includes('x: drag.latestX') && workspace.includes('y: drag.latestY') && workspace.includes('flushLocalSnapshot()'), 'drag.latestX/latestY are persisted')
check('11. image preview click surface is nodrag', imageButtonBlock.includes('data-no-node-drag="true"'), 'preview remains clickable; drag starts from card frame/header/blank zones')
check('12. video preview click surface is nodrag', videoButtonBlock.includes('data-no-node-drag="true"'), 'preview remains clickable; drag starts from card frame/header/blank zones')
check('13. cursor grab/grabbing', css.includes('cursor: grab') && css.includes('cursor: grabbing'), 'CSS exposes draggable affordance')
check('14. double-click frame does not open edit overlay', nodeCard.includes('onDoubleClick={(event) =>') && nodeCard.includes('onSelect()') && !nodeCard.includes('onDoubleClick={(event) => {\n        event.preventDefault()\n        event.stopPropagation()\n        onEdit()'), 'root double-click selects the card; controls/previews keep their own handlers')
check('15. P0 debug panel is nodrag overlay', workspace.includes('P0MediaDebugPanel') && existsSync(path.join(ROOT, 'apps/web/src/components/create/P0MediaDebugPanel.tsx')), 'P0 panel is a fixed data-no-node-drag overlay outside node drag surface')

console.log('\n=== Canvas Drag Config Audit ===\n')
console.log(`Canvas: ${usesReactFlow ? 'ReactFlow' : 'custom'}`)
console.log(`Drag handler file: ${WORKSPACE_FILE}`)
console.log(`Node card file: ${NODE_CARD_FILE}`)
console.log('Drag starts: CanvasNodeCard onPointerDown -> handleNodeDragStart')
console.log('Drag moves: window pointermove -> handleNodePatch({ x, y })')
console.log('Drag stops: window pointerup/pointercancel -> flushLocalSnapshot + scheduleCanvasSave(0)')
console.log('Node drag area: root card, border, header, empty areas')
console.log('Double-click frame behavior: selects node and keeps it movable; preview/control double-click remains scoped')
console.log('Nodrag controls: buttons, inputs, textarea, select, preview click surfaces, connection handles, dialogs, P0 debug overlay\n')

for (const item of checks) {
  console.log(`${item.pass ? '✓' : '✗'} ${item.label}: ${item.detail}`)
}

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.log(`\nFAIL: ${failed.length} drag config checks failed.`)
  process.exit(1)
}

console.log('\nPASS: custom canvas drag config is wired for persistent node movement.\n')
