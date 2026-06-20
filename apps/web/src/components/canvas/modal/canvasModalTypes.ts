/**
 * Canvas Modal Manager — type definitions.
 *
 * CanvasModalId: the set of mutually-exclusive panels managed by the canvas
 * modal coordinator in VisualCanvasWorkspace. At most ONE of these may be open
 * at any time. Opening a new panel closes the current one.
 *
 * Not included here (managed independently):
 *   - Right Inspector (real flex layout, not a floating modal)
 *   - Bottom Dock (real flex layout)
 *   - Selected-node toolbar (inline UI)
 *   - Context menus / add menus (short-lived popovers)
 *   - Toast / global notifications
 *   - Storyboard Director / Storyboard Preview (rarely open, managed separately)
 *   - New Project dialog (always standalone)
 */
export type CanvasModalId =
  | 'generation'
  | 'camera-control'
  | 'scene-lighting'
  | 'camera-lexicon'
  | 'prompt-booster'
  | 'character-bible'
  | 'scene-bible'
  | 'shot-list-builder'
  | 'look-package'
  | 'color-grade'
  | 'variant-planner'
  | 'character-lock'
  | 'ab-compare'
  | 'keyframe-extractor'
  | 'continuity-checker'
  | 'batch-rewriter'

export type ModalCloseReason =
  | 'close-button'
  | 'backdrop'
  | 'escape'
  | 'replace'
  | 'action-complete'
  | 'node-deleted'
  | 'project-change'

export type CanvasModalPayload = {
  nodeId?: string
  sourceNodeId?: string
}
