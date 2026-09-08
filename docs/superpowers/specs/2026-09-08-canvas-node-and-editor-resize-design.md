# Canvas Node and Editor Resize Design

**Status:** Founder-approved direction, pending specification review

## Goal

Add precise resizing to the existing Canvas selected-node workbench without
changing its approved navigation, node, dialog, control rail, typography, or
generation behavior.

## Scope

The feature has two independent resize targets.

### Display node

- The selected Canvas node exposes four small corner handles on hover or
  selection.
- Dragging any node corner resizes the node proportionally from the opposite
  corner. Its current aspect ratio is preserved.
- The node's minimum and maximum dimensions prevent unusable previews and
  oversized cards.
- Dragging the node body continues to move the node and its open task dialog
  together. Resizing never begins from the body, connector, control, preview,
  or dialog.

### Dialog content editor

- The editable content region exposes four corner handles and four edge
  handles when the task dialog is open.
- Corner drags may change both width and height freely. Edge drags may change
  only their corresponding axis. The editor does not preserve an aspect ratio.
- The task dialog outer shell follows the editor region's resulting width and
  height in real time, remains centered on the selected node, and respects the
  existing Canvas stage bounds.
- The fixed header, model and parameter rail, account state, credits, and
  generate control retain their existing dimensions and font sizes. They are
  repositioned by the expanded or contracted shell; they are never scaled.
- The editable region remains the only prompt scroll container. Its typography
  stays unchanged and content scrolls only after its available content area is
  exhausted.

## Interaction Rules

- Handles are deliberately compact and only visible for the active selected
  surface so the Canvas remains visually quiet.
- Pointer capture is used during a resize to avoid Canvas panning and node
  dragging conflicts.
- Resizing is clamped to documented minimums, maximums, and stage margins.
- Escape or pointer release ends a resize cleanly. Existing close, upload,
  prompt editing, BYOK selection, asset upload, script application, saving,
  and generation interactions remain unchanged.
- Node size and task-editor size are persisted with the Canvas node data so
  they survive reopening and cloud synchronization. Existing nodes receive
  the current approved dimensions until first resized.

## Implementation Boundaries

- Reuse the existing Canvas coordinate transform and selected-node layout
  helper. Add a small pure resize-geometry helper rather than embedding corner
  math inside React pointer handlers.
- Add a node-card resize callback through `CanvasNodeLayer` to the workspace.
- Store editor dimensions per node and feed them to the existing
  `getNodeContextSurfaceLayout` calculation as the dialog's preferred size.
- Do not add APIs, database migrations, third-party dependencies, new
  navigation, billing, Provider, wallet, payment, or Production changes.

## Validation

### Automated

- Test every node corner preserves the initial aspect ratio and pins the
  opposing corner.
- Test each editor edge changes only its allowed axis; test each editor corner
  changes both axes without changing typography constants.
- Test clamping at the minimum, maximum, and stage bounds.
- Test that node and editor dimension updates are included in the existing
  Canvas persistence path.
- Retain the existing tests for the anchored navigation, node/dialog stack,
  fixed dialog rails, and prompt-only scrolling.

### Browser acceptance

1. Select a Text, Image, and Video node at normal Canvas zoom.
2. Resize every node corner and confirm proportional display-node scaling.
3. Drag each editor edge and corner; confirm the outer dialog follows while
   fixed controls and all text retain their size.
4. Enter a long prompt and confirm only the editor contents scroll.
5. Drag a node by its body and confirm the dialog remains anchored below it.
6. Save, reload, and confirm the chosen sizes are restored.
