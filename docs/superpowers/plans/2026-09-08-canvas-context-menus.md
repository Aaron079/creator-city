# Canvas Context Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver compact translucent single-right-click node and blank-Canvas menus with only actionable controls.

**Architecture:** Keep all transient menu state in `VisualCanvasWorkspace.tsx`, adding a Canvas-level context-menu state beside the existing node context menu. Reuse existing upload, duplicate, clipboard, node-task, viewport, and asset capabilities without changing node or task-dialog layout.

**Tech Stack:** Next.js, React, TypeScript, CSS modules, Node test runner, Playwright.

---

### Task 1: Direct context-menu triggers

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Test: `apps/web/src/components/create/canvas/secondaryClickSequence.test.ts`

- [ ] **Step 1: Write a failing right-click behavior test.**

```ts
test('opens node and blank-canvas menus on one right-click', () => {
  assert.match(nodeHandler, /openNodeContextMenu\(nodeId, event\.clientX, event\.clientY\)/)
  assert.match(canvasHandler, /setCanvasContextMenu\(/)
  assert.doesNotMatch(nodeHandler, /registerSecondaryClick/)
  assert.doesNotMatch(canvasHandler, /registerSecondaryClick/)
})
```

- [ ] **Step 2: Run the test.**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/secondaryClickSequence.test.ts`

Expected: FAIL because the current handlers require two right-clicks and there is no Canvas-menu state.

- [ ] **Step 3: Add the minimal state and handlers.**

```ts
const [canvasContextMenu, setCanvasContextMenu] = useState<{
  x: number; y: number; worldX: number; worldY: number
} | null>(null)

const handleNodeSecondaryClick = useCallback((nodeId, event) => {
  event.preventDefault()
  openNodeContextMenu(nodeId, event.clientX, event.clientY)
}, [openNodeContextMenu])
```

The Canvas handler clamps the menu position, records the Canvas world point, opens `canvasContextMenu`, and closes existing node/create/add menus.

- [ ] **Step 4: Re-run the test.**

Expected: PASS.

### Task 2: Actionable rows only

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Test: `apps/web/src/components/create/canvas/secondaryClickSequence.test.ts`

- [ ] **Step 1: Write failing handler-wiring assertions.**

```ts
assert.match(workspaceSource, /focusPromptForNode\(menuNode\)/)
assert.match(workspaceSource, /copyNodeToClipboard\(menuNode\)/)
assert.match(workspaceSource, /duplicateNode\(menuNode\)/)
assert.match(workspaceSource, /fitCanvasView\(\)/)
assert.match(workspaceSource, /resetCanvasView\(\)/)
assert.match(workspaceSource, /window\.confirm\('删除此节点？此操作无法撤销。'\)/)
```

- [ ] **Step 2: Run the test.**

Expected: FAIL because the compact Canvas menu and direct task/viewport calls are not yet wired.

- [ ] **Step 3: Implement only real operations.**

```ts
const canPasteNode = Boolean(clipboardNode)
const canOpenAsset = Boolean(menuNode?.assetId)
const deleteFromContextMenu = (nodeId: string) => {
  if (!window.confirm('删除此节点？此操作无法撤销。')) return
  deleteNode(nodeId)
}
```

Use existing upload input, node clipboard, duplicate-node, fit/reset view, and persisted asset resolution. Disabled rows must use the native `disabled` attribute plus a title; remove the old simulated save and feedback actions.

- [ ] **Step 4: Re-run the test.**

Expected: PASS.

### Task 3: Approved glass presentation

**Files:**
- Modify: `apps/web/src/components/create/canvas.module.css`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Test: `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx`
- Test: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`

- [ ] **Step 1: Write failing rendered assertions.**

```ts
assert.equal(styles.width, '216px')
assert.match(styles.backdropFilter, /blur/)
assert.equal(styles.pointerEvents, 'auto')
assert.equal(blurStyles.pointerEvents, 'none')
```

- [ ] **Step 2: Run the rendered test.**

Expected: FAIL because the current menu uses the old opaque 214px surface and has no backdrop helper.

- [ ] **Step 3: Implement the approved style.**

```css
.scope :global(.canvas-context-menu),
.scope :global(.canvas-canvas-context-menu) {
  width: 216px;
  border-radius: 16px;
  background: rgba(14, 19, 27, 0.12);
  backdrop-filter: blur(22px) saturate(125%);
}
```

Add a non-interactive blur backing layer limited to the Canvas surface. Headers use 13px, rows use 14px with 38px height. Do not change task dialogs, nodes, or navigation CSS.

- [ ] **Step 4: Re-run rendered tests.**

Expected: PASS.

### Task 4: Verification and Preview deployment

**Files:**
- Modify: only files from Tasks 1-3

- [ ] **Step 1: Run focused tests, production build, and whitespace check.**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/secondaryClickSequence.test.ts src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx src/components/create/canvas/canvasWorkspaceLayout.test.ts && pnpm --filter web build && git diff --check`

Expected: all tests and build pass with no new errors.

- [ ] **Step 2: Commit and push Preview branch.**

Run: `git add apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/canvas.module.css apps/web/src/components/create/canvas/secondaryClickSequence.test.ts apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts && git commit -m "feat: add compact canvas context menus" && git push origin codex/video-gate-qa`

Expected: the branch's Vercel Preview is Ready. Do not push `main` or deploy Production.
