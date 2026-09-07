# Canvas Task Dialog Fixed Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selected-node task dialog a compact, node-anchored surface with a fixed header and action footer, while only the prompt body can scroll.

**Architecture:** Preserve the 350 x 28 node navigation above the selected node and the dialog below it. Extend the pure surface-layout helper to allow a 282px task height without changing the existing 210px Tools and Assets surface. Refactor only the `layout="node"` prompt branch into header, scroll-body, and footer regions; retain callbacks, provider panels, references, chips, and billing logic.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules, Node built-in test runner, pnpm.

---

## File Structure

- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts` - category-specific dialog height.
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts` - geometry, workspace wiring, and final CSS contracts.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` - choose 282px only for Task and remove outer task scrolling.
- Modify: `apps/web/src/components/create/CanvasPromptBox.tsx` - explicit node header, prompt scroll body, and fixed footer wrappers.
- Create: `apps/web/src/components/create/CanvasPromptBox.task-layout.test.ts` - node task markup contracts.
- Modify: `apps/web/src/components/create/canvas.module.css` - final scoped fixed-surface rules.
- Modify: `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` - record QA only after verification and any authorized deployment.

## Boundaries

- No change to endpoints, provider adapters, BYOK semantics, billing behavior, schemas, environments, packages, payment, or executor code.
- Do not remove or hide `UpstreamTaskStrip`, `LocalReferenceStrip`, generation-context chips, or billing controls.
- Do not alter workspace-mode prompt UI.
- Do not push or deploy until separately authorized.

### Task 1: Add Task-Specific Geometry

**Files:**
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts`
- Test: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test after the existing compact-navigation test:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: FAIL because `getCanvasNodeContextSurfaceLayout` does not accept `dialogHeight`.

- [ ] **Step 3: Add the optional height argument**

Change the helper signature and its two height uses:

```ts
export function getCanvasNodeContextSurfaceLayout({
  node,
  stage,
  dialogHeight = CONTEXT_DIALOG.height,
}: {
  node: CanvasNodeScreenRect
  stage: CanvasStageRect
  dialogHeight?: number
}): CanvasContextSurfaceLayout {
  // existing calculations
  const overflow = dialogTop + dialogHeight - (stage.bottom - CONTEXT_STAGE_MARGIN)
  // existing result, with dialog.height: dialogHeight
}
```

- [ ] **Step 4: Run the focused test**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: PASS, including all existing 210px layout tests.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts && git commit -m "feat: size node task dialog for fixed surfaces"`

### Task 2: Wire the 282px Surface Into Task Context Only

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx:10103-10126`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx:12149-12155`
- Test: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`

- [ ] **Step 1: Write the failing source-contract test**

```ts
test('uses the taller fixed-surface height only for the task category', () => {
  const start = visualCanvasWorkspaceSource.indexOf('const nodeContextSurfaceLayout = useMemo')
  const end = visualCanvasWorkspaceSource.indexOf('useEffect(() => {', start)
  const layoutSource = visualCanvasWorkspaceSource.slice(start, end)

  assert.match(layoutSource, /activeNodeContextCategory === 'task' \? 282 : 210/)
  assert.match(layoutSource, /dialogHeight: nodeContextDialogHeight/)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: FAIL because workspace wiring does not choose a category-specific height.

- [ ] **Step 3: Add category-specific wiring**

Immediately before the layout memo, add:

```ts
const nodeContextDialogHeight = activeNodeContextCategory === 'task' ? 282 : 210
```

In the layout helper call, add `dialogHeight: nodeContextDialogHeight`. Add `activeNodeContextCategory` and `nodeContextDialogHeight` to the memo dependencies. Preserve the existing `createCanvasAutosaveSuppression` pan effect. In the task-dialog `style`, retain `maxHeight: 'calc(100vh - 32px)'` but remove `overflowY: 'auto'`.

- [ ] **Step 4: Run the focused test**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: PASS; the current auto-pan source contract still passes.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts && git commit -m "feat: anchor fixed task dialog below selected node"`

### Task 3: Separate Header, Prompt Body, and Footer in the Node Prompt

**Files:**
- Create: `apps/web/src/components/create/CanvasPromptBox.task-layout.test.ts`
- Modify: `apps/web/src/components/create/CanvasPromptBox.tsx:549-676`

- [ ] **Step 1: Write failing markup contracts**

Create `CanvasPromptBox.task-layout.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDirectory, 'CanvasPromptBox.tsx'), 'utf8')
const nodeStart = source.indexOf('return (\n    <div ref={boxRef} className="canvas-prompt-box is-node">')
const nodeSource = source.slice(nodeStart)

test('node task layout separates fixed header, scroll body, and fixed footer', () => {
  assert.match(nodeSource, /className="canvas-node-dialog-fixed-header"/)
  assert.match(nodeSource, /className="canvas-node-dialog-scroll-content"/)
  assert.match(nodeSource, /className="canvas-node-dialog-fixed-footer"/)
})

test('only the scroll body owns the prompt input', () => {
  const bodyStart = nodeSource.indexOf('className="canvas-node-dialog-scroll-content"')
  const footerStart = nodeSource.indexOf('className="canvas-node-dialog-fixed-footer"')
  const bodySource = nodeSource.slice(bodyStart, footerStart)

  assert.match(bodySource, /className="canvas-prompt-input-wrap"/)
  assert.match(nodeSource.slice(0, bodyStart), /canvas-node-dialog-expand/)
  assert.match(nodeSource.slice(footerStart), /canvas-prompt-footer-nav/)
})
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run: `pnpm --filter web exec tsx --test src/components/create/CanvasPromptBox.task-layout.test.ts`

Expected: FAIL because current node content has direct sibling controls.

- [ ] **Step 3: Refactor only the node branch**

Keep `renderFooterPanel()` at the root. Place the existing video-mode or `taskInputModeLabel` UI and existing close button in `canvas-node-dialog-fixed-header`. Put the existing `canvas-prompt-input-wrap`, `promptInput`, `resultSummary`, and `errorMessage` in `canvas-node-dialog-scroll-content`. Put the unchanged provider notice and `.canvas-prompt-footer-nav` in `canvas-node-dialog-fixed-footer`:

```tsx
<div ref={boxRef} className="canvas-prompt-box is-node">
  {renderFooterPanel()}
  <div className="canvas-node-dialog-fixed-header">
    <div className="canvas-node-dialog-mode">{/* current mode conditional */}</div>
    {/* current onClose button */}
  </div>
  <div className="canvas-node-dialog-scroll-content">
    <div className="canvas-prompt-input-wrap">{/* current prompt/result/error */}</div>
  </div>
  <div className="canvas-node-dialog-fixed-footer">
    {/* current provider notice and unchanged footer navigation */}
  </div>
</div>
```

Do not change generate labels, provider menus, credit calculations, or events.

- [ ] **Step 4: Run the node-layout test**

Run: `pnpm --filter web exec tsx --test src/components/create/CanvasPromptBox.task-layout.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/components/create/CanvasPromptBox.tsx apps/web/src/components/create/CanvasPromptBox.task-layout.test.ts && git commit -m "feat: structure node task dialog fixed surfaces"`

### Task 4: Add Final Fixed-Surface CSS

**Files:**
- Modify: `apps/web/src/components/create/canvas.module.css`
- Test: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`

- [ ] **Step 1: Write a failing CSS contract**

Append this test to `canvasWorkspaceLayout.test.ts`:

```ts
test('keeps node task shell static and assigns scrolling only to prompt content', () => {
  const marker = '/* Node task dialog fixed surfaces */'
  const finalRules = canvasModuleSource.slice(canvasModuleSource.indexOf(marker))

  assert.match(finalRules, /\.canvas-node-dialog\.create-floating-console\) \{[\s\S]*?overflow: hidden;/)
  assert.match(finalRules, /\.canvas-node-dialog-scroll-content\) \{[\s\S]*?overflow-y: auto;/)
  assert.match(finalRules, /\.canvas-node-dialog-fixed-header\) \{[\s\S]*?flex: 0 0 auto;/)
  assert.match(finalRules, /\.canvas-node-dialog-fixed-footer\) \{[\s\S]*?flex: 0 0 auto;/)
})
```

- [ ] **Step 2: Run focused tests and confirm the CSS contract fails**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts src/components/create/CanvasPromptBox.task-layout.test.ts`

Expected: FAIL because the final marked CSS block is absent.

- [ ] **Step 3: Append narrowly scoped final rules**

```css
/* Node task dialog fixed surfaces */
.scope :global(.canvas-node-dialog.create-floating-console) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.scope :global(.canvas-node-dialog .canvas-prompt-box.is-node) {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.scope :global(.canvas-node-dialog-fixed-header) {
  display: flex;
  flex: 0 0 auto;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 14px;
}

.scope :global(.canvas-node-dialog-mode) {
  min-width: 0;
  color: rgba(255, 255, 255, 0.48);
  font-size: 10px;
}

.scope :global(.canvas-node-dialog-scroll-content) {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 14px;
}

.scope :global(.canvas-node-dialog-scroll-content .canvas-prompt-input-wrap),
.scope :global(.canvas-node-dialog-scroll-content .canvas-prompt-input) {
  min-height: 100%;
  height: 100%;
}

.scope :global(.canvas-node-dialog-fixed-footer) {
  flex: 0 0 auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(20, 23, 29, 0.98);
  padding: 8px 14px 10px;
}

.scope :global(.canvas-node-dialog .canvas-node-dialog-fixed-footer .canvas-prompt-footer-nav) {
  margin-top: 0;
}
```

Verify optional `UpstreamTaskStrip`, `LocalReferenceStrip`, context chips, and billing controls remain reachable. Give their containers `flex: 0 0 auto` when visible; do not reintroduce outer vertical scrolling. When fixed controls need more than the 282px base, calculate a task-only height from the fixed-control stack and pass it into the same stage-aware helper so auto-pan keeps the whole surface visible.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts src/components/create/CanvasPromptBox.task-layout.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/components/create/canvas.module.css apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts && git commit -m "style: stabilize canvas node task dialog"`

### Task 5: Verify and Document

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run targeted tests**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts src/components/create/CanvasPromptBox.task-layout.test.ts`

Expected: PASS.

- [ ] **Step 2: Run repository quality gates**

Run: `pnpm type-check && pnpm lint && pnpm --filter web build && git diff --check`

Expected: type-check, build, and diff-check pass; separate existing lint warnings from new errors.

- [ ] **Step 3: Browser QA locally**

On text, image, and video nodes: confirm navigation is directly above the selected node; Task opens below it; long prompts scroll only in the prompt body; close, mode, model, parameters, credits, and generate remain visible; provider panels escape clipping; upstream/reference and billing controls remain reachable; closing/reopening on a second node relocates both surfaces; automatic pan does not trigger a canvas PUT.

Classify failures accurately as `PRODUCT_UI_ERROR`, `AUTH_BLOCKER`, or `QA_HARNESS_LIMITATION`; do not present local QA as Preview or Production QA.

- [ ] **Step 4: Update documentation and commit**

After successful local QA, record geometry, fixed-surface behavior, commands, and QA result in `docs/CURRENT_STATUS.md`; mark this task closed in `docs/NEXT_TASKS.md` and name the next unstarted task without beginning it.

Run: `git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md && git commit -m "docs: record fixed canvas task dialog QA"`

- [ ] **Step 5: Wait for explicit push/deploy authority**

Do not run `git push` or deploy. After explicit authorization, push the current branch, wait for Preview, run authenticated Preview browser QA, then commit and push the final deployment QA record.

## Plan Self-Review

- The plan implements the approved geometry, fixed header/footer, prompt-only scrolling, and node-relative placement.
- Existing optional controls are preserved and must be verified as reachable before completion.
- `dialogHeight`, `canvas-node-dialog-fixed-header`, `canvas-node-dialog-scroll-content`, and `canvas-node-dialog-fixed-footer` are consistent across tests, TypeScript, and CSS.
- It does not touch backend, accounts, billing semantics, providers, schemas, environments, or packages.

