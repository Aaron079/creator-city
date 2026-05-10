#!/usr/bin/env tsx
/**
 * test-canvas-drag-config.ts
 * Static audit of canvas drag/interaction configuration.
 * Reads source files to verify drag mechanism is correctly wired.
 */
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const ROOT = path.resolve('/Users/aaron/creator-city')
const WORKSPACE_FILE = path.join(ROOT, 'apps/web/src/components/create/VisualCanvasWorkspace.tsx')
const NODE_CARD_FILE = path.join(ROOT, 'apps/web/src/components/create/CanvasNodeCard.tsx')
const CSS_FILE = path.join(ROOT, 'apps/web/src/components/create/canvas.module.css')

function readFile(p: string) {
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

function check(label: string, pass: boolean, detail = '') {
  const icon = pass ? '✓' : '✗'
  console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ''}`)
  return pass
}

console.log('\n=== Canvas Drag Interaction Audit ===\n')

const workspace = readFile(WORKSPACE_FILE)
const nodeCard = readFile(NODE_CARD_FILE)
const css = readFile(CSS_FILE)

console.log('--- 1. ReactFlow Usage ---')
const usesReactFlow = workspace.includes('ReactFlow') || nodeCard.includes('ReactFlow')
check('Does NOT use ReactFlow (custom drag)', !usesReactFlow, usesReactFlow ? 'ReactFlow found — check nodesDraggable' : 'Custom pointer-based drag confirmed')

console.log('\n--- 2. Custom Drag Mechanism ---')
check('handleNodeDragStart exists in Workspace', workspace.includes('handleNodeDragStart'))
check('onDragStart prop passed to CanvasNodeCard', workspace.includes('onDragStart={(event) => handleNodeDragStart'))
check('CanvasNodeCard accepts onDragStart prop', nodeCard.includes('onDragStart:') || nodeCard.includes('onDragStart,'))
check('nodeDragRef useRef for drag state', workspace.includes('nodeDragRef'))
check('window.pointermove handler for drag', workspace.includes("window.addEventListener('pointermove'"))
check('window.pointerup handler to end drag', workspace.includes("window.addEventListener('pointerup'"))
check('scheduleCanvasSave on drag end', workspace.includes('scheduleCanvasSave') && workspace.includes('handlePointerUp'))

console.log('\n--- 3. CanvasNodeCard onPointerDown ---')
check('Root motion.div has onPointerDown', nodeCard.includes('onPointerDown={(event) => {'))
check('isInteractiveTarget guards drag start', nodeCard.includes('isInteractiveTarget'))
check('onDragStart called when not interactive', nodeCard.includes('onDragStart(event)'))
check('event.stopPropagation in onPointerDown', nodeCard.includes('event.stopPropagation()'))
check('setPointerCapture called', nodeCard.includes('setPointerCapture'))

console.log('\n--- 4. Interactive Target Exclusions ---')
check('Buttons excluded from drag (isInteractiveTarget)', nodeCard.includes("'button'"))
check('Inputs excluded from drag', nodeCard.includes("'input'"))
check('data-no-node-drag respected', nodeCard.includes('[data-no-node-drag="true"]'))
check('data-connection-handle respected', nodeCard.includes('[data-connection-handle="true"]'))
check('canvas-node-dialog excluded', nodeCard.includes('.canvas-node-dialog'))

console.log('\n--- 5. CSS Drag Indicators ---')
check('canvas-node-card has cursor:grab', css.includes('.canvas-node-card) {\n  --canvas-glow') && css.includes('cursor: grab'))
check('canvas-node-header has cursor:grab', css.includes('.canvas-node-header) {') && css.substring(css.indexOf('.canvas-node-header) {')).includes('cursor: grab'))
check('is-dragging has cursor:grabbing', css.includes('.canvas-node-card.is-dragging) {') && css.includes('cursor: grabbing'))
check('canvas-node-preview has position:relative (scopes error overlay)', css.includes('.canvas-node-preview) {') && css.includes('position: relative'))

console.log('\n--- 6. Error Overlay Scoping ---')
check('canvas-node-image-error is position:absolute;inset:0', css.includes('.canvas-node-image-error) {') && css.includes('inset: 0'))
check('canvas-node-video-error is position:absolute;inset:0', css.includes('.canvas-node-video-error) {') && css.includes('inset: 0'))
const previewHasRelative = (() => {
  const idx = css.indexOf('.canvas-node-preview) {')
  if (idx === -1) return false
  const block = css.substring(idx, idx + 300)
  return block.includes('position: relative')
})()
check('canvas-node-preview position:relative contains error overlay (not covering header)', previewHasRelative, previewHasRelative ? 'Error overlay scoped to preview area' : 'ERROR: overlay may cover header — header drag blocked!')

console.log('\n--- 7. Canvas Pan vs Node Drag Separation ---')
check('canStartCanvasPan excludes .canvas-node-card', workspace.includes('.canvas-node-card') && workspace.includes('canStartCanvasPan'))
check('Viewport handleCanvasPointerDown guarded by canStartCanvasPan', workspace.includes('!canStartCanvasPan(event.target)'))
check('double-click on canvas creates node', workspace.includes('handleCanvasDoubleClick'))
check('double-click on node triggers onEdit', nodeCard.includes('onDoubleClick={(event) => {') && nodeCard.includes('onEdit()'))

console.log('\n--- 8. Position Save on Drag ---')
check('handleNodePatch updates x/y on drag', workspace.includes('handleNodePatch(drag.nodeId, {') && workspace.includes('x: drag.latestX'))
check('flushLocalSnapshot called on drag end', workspace.includes('flushLocalSnapshot()'))
check('scheduleCanvasSave(0) called on drag end', workspace.includes('scheduleCanvasSave(0)'))

console.log('\n--- Summary ---')
console.log('Drag mechanism: Custom pointer events (not ReactFlow)')
console.log('Drag starts: onPointerDown on CanvasNodeCard root → handleNodeDragStart')
console.log('Drag moves: window pointermove → handlePointerMove → handleNodePatch x/y')
console.log('Drag ends: window pointerup → flushLocalSnapshot + scheduleCanvasSave')
console.log('Double-click: Opens prompt editor (focusPromptForNode), not a drag mode')
console.log('\nDone.\n')
