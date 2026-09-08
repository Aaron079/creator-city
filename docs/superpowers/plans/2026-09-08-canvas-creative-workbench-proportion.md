# Canvas Creative Workbench Proportion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved 1:2 Canvas node-to-task-dialog composition with a single fixed top rail, a prompt-only scroll region, and compact one-line controls.

**Architecture:** Keep task behavior in `VisualCanvasWorkspace` and `CanvasPromptBox` unchanged. Update pure canvas sizing constants and CSS presentation only; tests validate placement and the real rendered component tree in Chromium.

**Tech Stack:** TypeScript, React, CSS Modules, Node test runner, Playwright/Chromium, pnpm.

---

### Task 1: Lock the approved geometry with pure layout tests

**Files:**
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts:15-16, 208-220`
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts:43-80`

- [ ] **Step 1: Write failing geometry assertions**

```ts
assert.deepEqual(getCanvasNodeSize('text'), { width: 380, height: 194 })
assert.deepEqual(layout.navigation, { left: 400, top: 84, width: 380, height: 28 })
assert.deepEqual(layout.dialog, { left: 210, top: 322, width: 760, height: 292 })
```

- [ ] **Step 2: Verify the assertions fail against the current 350px surface**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: the node size and context-surface width assertions fail because current values are compact.

- [ ] **Step 3: Implement only the approved constants**

```ts
const CONTEXT_NAVIGATION = { width: 380, height: 28, gap: 8 }
const CONTEXT_DIALOG = { width: 760, height: 292, gap: 8 }

const COMPACT_NODE_SIZES = {
  // text, image, and video task nodes use the approved 380 x 194 display surface
}
```

Keep stage clamping and pan calculation unchanged.

- [ ] **Step 4: Run the pure layout tests**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: PASS.

### Task 2: Make the task dialog match the approved rail composition

**Files:**
- Modify: `apps/web/src/components/create/canvas.module.css:8680-9145`
- Modify: `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx:460-700`

- [ ] **Step 1: Add failing rendered checks for the visual contract**

```ts
assert.equal(Math.round(dialog.width), 760)
assert.equal(Math.round(navigation.width), 380)
assert.equal(Math.round(topRail.height), 44)
assert.equal(Math.round(footer.height), 48)
assert.equal(Math.round(bottomRail.height), 38)
assert.equal(getComputedStyle(scrollContent).overflowY, 'hidden')
assert.equal(getComputedStyle(promptInput).overflowY, 'auto')
```

The test must assert that the source/upload/hint/close controls share one top row and that the prompt input, rather than its outer wrapper, owns vertical scrolling.

- [ ] **Step 2: Verify the rendered checks fail**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx`

Expected: FAIL because the current top surface is 52px, prompt wrapper scrolls, and footer controls occupy two rows.

- [ ] **Step 3: Implement the fixed rails without changing handlers**

```css
.canvas-node-dialog-fixed-controls.is-top > [data-no-node-drag='true'] { height: 44px; }
.canvas-node-dialog-scroll-content { overflow: hidden; }
.canvas-node-dialog-scroll-content .canvas-prompt-input { overflow-y: auto; }
.canvas-node-dialog-fixed-footer .canvas-prompt-footer-nav { flex-direction: row; }
.canvas-node-dialog-fixed-controls.is-bottom > .canvas-node-dialog-billing-controls { height: 38px; }
```

Retain all existing button elements, upload inputs, provider links, account selection, and generation callbacks. Use the existing prompt input placeholder for the creative-content label rather than adding a second header row.

- [ ] **Step 4: Run rendered component tests and save acceptance screenshots**

Run:

```bash
CANVAS_TASK_DIALOG_SCREENSHOT=/tmp/creator-city-workbench-desktop.png \
CANVAS_TASK_DIALOG_EMPTY_BYOK_SCREENSHOT=/tmp/creator-city-workbench-empty-byok.png \
pnpm --filter web exec tsx --test src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
```

Expected: PASS and screenshots show the 1:2 stack, single-line top rail, prompt-only scroll, one-line control rail, and contained No-Key state.

### Task 3: Perform the delivery gate

**Files:**
- Verify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Verify: `apps/web/src/components/create/CanvasPromptBox.tsx`
- Verify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts`
- Verify: `apps/web/src/components/create/canvas.module.css`

- [ ] **Step 1: Confirm behavioral boundaries by source diff**

Run: `git diff --check && git diff -- apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/CanvasPromptBox.tsx`

Expected: no handler, endpoint, persistence, generation, or provider-account behavior changes beyond the existing compact status copy.

- [ ] **Step 2: Run the full relevant quality gate**

Run:

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
pnpm type-check
pnpm lint
pnpm --filter web build
pnpm agent:check
git diff --check
```

Expected: tests, type checking, build, and agent boundary checks pass. Existing lint warnings may remain, but no new lint errors are permitted.

- [ ] **Step 3: Review screenshots before handoff**

Inspect `/tmp/creator-city-workbench-desktop.png` and `/tmp/creator-city-workbench-empty-byok.png` for rail containment, prompt legibility, no button overlap, and no clipped No-Key action.

- [ ] **Step 4: Commit the implementation only after acceptance**

```bash
git add apps/web/src/components/create/canvas.module.css \
  apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts \
  apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts \
  apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
git commit -m "fix: restore canvas creative workbench proportions"
```

Do not push or deploy without a fresh user confirmation.
