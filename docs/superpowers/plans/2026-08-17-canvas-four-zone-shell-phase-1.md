# Canvas Four-Zone Shell Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate Creator City's existing four-zone Canvas shell with a bounded selected-node Inspector, while preserving every existing generation, Provider, BYOK, billing, persistence, and tool behavior.

**Architecture:** `VisualCanvasWorkspace` remains the only owner of selected-node state and keeps its existing `openNodeScopedTool` source-lock path. `CanvasWorkspaceShell` becomes responsible only for presenting an existing Inspector slot as a desktop aside or mobile sheet; `CanvasRightInspector` remains presentation-only and receives callbacks for existing node-scoped actions. No new persisted state, API request, or tool semantic is introduced.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Tailwind utility classes, Node `node:test`, `tsx`, Playwright, pnpm.

---

## Scope and file map

This plan is deliberately one independently shippable migration batch. It proves the layout contract before the later Camera, Lighting, Prompt, Storyboard, Reference Extractor, Keyframe Extractor, and Annotation entry-point migrations.

| File | Responsibility |
| --- | --- |
| `apps/web/src/components/canvas/shell/CanvasWorkspaceShell.tsx` | Owns responsive Inspector frame and dismiss callback, without learning node or generation state. |
| `apps/web/src/components/canvas/shell/canvasWorkspaceShell.module.css` | Gives desktop Inspector its 320–420px width and renders the existing Inspector as a 16px-bounded narrow sheet. |
| `apps/web/src/components/canvas/inspector/CanvasRightInspector.tsx` | Shows one selected node's existing identity, source, prompt, lineage, advisory metadata, media, and safe node-scoped shortcuts. |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | Supplies the selected node, adjacent edges, title map, and existing callbacks to the shell; it remains the single selection/source-lock owner. |
| `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts` | Calculates a dialog size that never exceeds the viewport after the approved 16px margin is reserved. |
| `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts` | Locks the 100%-zoom node dimensions and viewport-bounded dialog geometry. |
| `apps/web/src/components/canvas/shell/CanvasWorkspaceShell.test.tsx` | Browser-rendered regression harness for desktop aside, mobile sheet, close/backdrop/Escape behavior, and viewport bounds. |
| `apps/web/src/components/canvas/inspector/CanvasRightInspector.test.tsx` | Browser-rendered node A/B isolation, source navigation, click-to-load video, and shortcut callback regression tests. |
| `scripts/canvas-performance-request-storm-static.test.mjs` | Keeps an explicit static boundary that Inspector presentation imports do not own fetch or save scheduling. |
| `docs/CURRENT_STATUS.md`, `docs/NEXT_TASKS.md` | Updated only after the implementation and its local/Preview verification gates pass. |

### Task 1: Make the shell able to dismiss a responsive Inspector

**Files:**
- Modify: `apps/web/src/components/canvas/shell/CanvasWorkspaceShell.tsx`
- Modify: `apps/web/src/components/canvas/shell/canvasWorkspaceShell.module.css`
- Create: `apps/web/src/components/canvas/shell/CanvasWorkspaceShell.test.tsx`

- [ ] **Step 1: Write the failing desktop/mobile shell harness test.**

Create a `tsx` + Playwright test following `apps/web/src/components/create/canvas/StoryboardDirectorInteractionGate.test.tsx`. Bundle only `CanvasWorkspaceShell.tsx` and a harness that renders an `#inspector-content` element with a close button. The harness must expose `window.__shellHarness` with `open()`, `close()`, and `closeCount()`.

Add these assertions before implementation:

```ts
async function harnessCloseCount(page: Page) {
  return page.evaluate(() => (
    window as unknown as { __shellHarness: { closeCount: () => number } }
  ).__shellHarness.closeCount())
}

test('renders an open inspector as a 320–420px desktop aside', async () => {
  const page = await renderPage({ width: 1280, height: 720 })
  const inspector = page.locator('[data-canvas-region="right-inspector"]')
  const box = await inspector.boundingBox()
  assert.ok(box)
  assert.ok(box.width >= 320 && box.width <= 420)
  assert.equal(Math.round(box.height), 720)
  await page.close()
})

test('renders the same inspector as a 16px-bounded narrow sheet and dismisses it', async () => {
  const page = await renderPage({ width: 390, height: 844 })
  const sheet = page.locator('[data-canvas-region="right-inspector"] [data-canvas-inspector-panel="true"]')
  const box = await sheet.boundingBox()
  assert.ok(box)
  assert.equal(Math.round(box.x), 16)
  assert.equal(Math.round(box.y), 16)
  assert.equal(Math.round(box.width), 358)
  assert.equal(Math.round(box.height), 812)
  await page.locator('[data-canvas-inspector-backdrop="true"]').click({ position: { x: 2, y: 2 } })
  assert.equal(await harnessCloseCount(page), 1)
  await page.close()
})
```

- [ ] **Step 2: Run the focused test and verify the mobile contract fails.**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/canvas/shell/CanvasWorkspaceShell.test.tsx`

Expected: FAIL because the shell has no `onDismissRightInspector`, backdrop, or `data-canvas-inspector-panel` frame and hides the Inspector below `1024px`.

- [ ] **Step 3: Add the minimal shell API and structural frame.**

In `CanvasWorkspaceShellProps`, add exactly:

```ts
/** Dismisses the currently visible Inspector from its narrow-screen backdrop. */
onDismissRightInspector?: () => void
```

Accept it in `CanvasWorkspaceShell`, then replace the current Inspector markup with:

```tsx
{hasRightInspector ? (
  <aside className={styles.rightInspector} data-canvas-region="right-inspector" aria-label="节点检查器">
    <button
      type="button"
      className={styles.inspectorBackdrop}
      data-canvas-inspector-backdrop="true"
      aria-label="关闭节点检查器"
      onClick={onDismissRightInspector}
    />
    <div className={styles.inspectorPanel} data-canvas-inspector-panel="true">
      {rightInspector}
    </div>
  </aside>
) : null}
```

Do not add node IDs, save functions, generation functions, or a breakpoint hook to this component.

- [ ] **Step 4: Implement the bounded desktop and mobile shell CSS.**

Replace the existing `.rightInspector` breakpoint rules with this behavior:

```css
.rightInspector {
  flex-shrink: 0;
  width: clamp(320px, 26vw, 420px);
  position: relative;
  background: #09090f;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.inspectorBackdrop { display: none; }
.inspectorPanel { height: 100%; min-height: 0; overflow: hidden; }

@media (max-width: 1023px) {
  .rightInspector {
    position: fixed;
    inset: 0;
    z-index: var(--canvas-z-modal);
    display: block;
    width: auto;
    border: 0;
    background: transparent;
    overflow: visible;
  }
  .inspectorBackdrop {
    display: block;
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.52);
  }
  .inspectorPanel {
    position: absolute;
    inset: 16px;
    max-height: calc(100dvh - 32px);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 8px;
    background: #09090f;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.52);
  }
}
```

Keep the existing narrow left rail and hidden bottom dock rules. Remove the old mobile `display: none` rule for `.rightInspector`; do not change Canvas node, toolbar, panel, or top-bar z-index values.

- [ ] **Step 5: Add Escape dismissal only for the non-processing layout frame.**

In `CanvasWorkspaceShell.tsx`, import `useEffect` and add this effect after the `hasRightInspector` calculation:

```ts
useEffect(() => {
  if (!hasRightInspector || !onDismissRightInspector) return
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onDismissRightInspector()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [hasRightInspector, onDismissRightInspector])
```

This callback only closes the read-only Inspector frame. It must not close, reset, or retarget an existing processing tool panel; those panels keep their existing explicit source-lock/cancel behavior outside the shell.

- [ ] **Step 6: Run the shell regression and commit the isolated layout primitive.**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/canvas/shell/CanvasWorkspaceShell.test.tsx`

Expected: PASS for 1280×720 aside width, 390×844 sheet bounds, backdrop close, and Escape close.

```bash
git add apps/web/src/components/canvas/shell/CanvasWorkspaceShell.tsx \
  apps/web/src/components/canvas/shell/canvasWorkspaceShell.module.css \
  apps/web/src/components/canvas/shell/CanvasWorkspaceShell.test.tsx
git commit -m "feat: add responsive canvas inspector shell"
```

### Task 2: Make the Inspector actions explicitly node-scoped

**Files:**
- Modify: `apps/web/src/components/canvas/inspector/CanvasRightInspector.tsx`
- Create: `apps/web/src/components/canvas/inspector/CanvasRightInspector.test.tsx`

- [ ] **Step 1: Write the failing Inspector interaction test.**

Build a minimal browser harness with Node A and Node B, separate `onOpenGenerationDialog`, `onOpenCameraControl`, `onOpenSceneLighting`, `onOpenPromptInspector`, and `onSelectNode` spies. Render Node A, activate the Camera, Lighting, Prompt, source, and a relation control, then rerender Node B and assert each callback received only the displayed node's ID.

Include click-to-load video coverage:

```ts
assert.equal(await page.locator('video').count(), 0)
await page.getByRole('button', { name: /播放视频预览/i }).click()
assert.equal(await page.locator('video').count(), 1)
```

Also assert `onOpenGenerationDialog` does not run during initial render.

- [ ] **Step 2: Run the focused test and verify it fails because shortcuts are absent.**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/canvas/inspector/CanvasRightInspector.test.tsx`

Expected: FAIL because `CanvasRightInspectorProps` exposes only generation and selection callbacks.

- [ ] **Step 3: Add optional existing-action callbacks to the Inspector contract.**

Extend `CanvasRightInspectorProps` exactly:

```ts
  onOpenPromptInspector?: (nodeId: string) => void
  onOpenCameraControl?: (nodeId: string) => void
  onOpenSceneLighting?: (nodeId: string) => void
```

Add a `Section title="节点控制"` before the Prompt section. Render no more than these three compact buttons, each passing `node.id` directly:

```tsx
{onOpenCameraControl ? <button type="button" onClick={() => onOpenCameraControl(node.id)}>摄影机</button> : null}
{onOpenSceneLighting ? <button type="button" onClick={() => onOpenSceneLighting(node.id)}>灯光</button> : null}
{onOpenPromptInspector ? <button type="button" onClick={() => onOpenPromptInspector(node.id)}>查看 Prompt</button> : null}
```

Apply the existing dark Inspector button styling (`rounded-md`, white 6% hover surface, 10–11px text). Do not add a new tool menu, local state, fetch, save scheduler, Provider selector, or derived-node creation path. Change the video preview button to include `aria-label="播放视频预览"`.

- [ ] **Step 4: Run the Inspector test and commit the context-only action surface.**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/canvas/inspector/CanvasRightInspector.test.tsx`

Expected: PASS for A/B callback identity, source/relationship navigation, no initial video element, and explicit video loading.

```bash
git add apps/web/src/components/canvas/inspector/CanvasRightInspector.tsx \
  apps/web/src/components/canvas/inspector/CanvasRightInspector.test.tsx
git commit -m "feat: expose node-scoped inspector controls"
```

### Task 3: Connect the real selected node to the shell without changing tool semantics

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `scripts/canvas-performance-request-storm-static.test.mjs`

- [ ] **Step 1: Add a failing static integration assertion.**

In `scripts/canvas-performance-request-storm-static.test.mjs`, add a test that reads `CanvasRightInspector.tsx` and asserts the Inspector stays presentation-only:

```js
const inspectorPath = new URL('apps/web/src/components/canvas/inspector/CanvasRightInspector.tsx', root)
const inspector = readFileSync(inspectorPath, 'utf8')

test('right inspector remains a request-free node-context surface', () => {
  assert.doesNotMatch(inspector, /\bfetch\s*\(/)
  assert.doesNotMatch(inspector, /scheduleCanvasSave/)
  assert.doesNotMatch(inspector, /\/api\/generate\//)
  assert.match(workspace, /rightInspector=\{activeNode && isRightInspectorOpen \? \(/)
  assert.match(workspace, /showRightInspector=\{Boolean\(activeNode && isRightInspectorOpen\)\}/)
})
```

- [ ] **Step 2: Run the static test and verify it fails before the Workspace wiring exists.**

Run: `node --test scripts/canvas-performance-request-storm-static.test.mjs`

Expected: FAIL because the current shell receives `rightInspector={undefined}` and `showRightInspector={false}`.

- [ ] **Step 3: Import and wire the existing Inspector using the current selection owner.**

Replace the removed-Inspector comment with:

```ts
import { CanvasRightInspector, type InspectorEdgeRef } from '@/components/canvas/inspector/CanvasRightInspector'
```

Near the existing `activeNode` memo, add memoized values that derive only from `activeNodeId`, `nodes`, and `edges`:

```ts
const nodeTitleById = useMemo(
  () => new Map(nodes.map((node) => [node.id, node.title || '未命名节点'])),
  [nodes],
)

const activeNodeIncomingEdges = useMemo<InspectorEdgeRef[]>(
  () => activeNodeId ? edges
    .filter((edge) => edge.toNodeId === activeNodeId)
    .map((edge) => ({ id: edge.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, label: edge.label })) : [],
  [activeNodeId, edges],
)

const activeNodeOutgoingEdges = useMemo<InspectorEdgeRef[]>(
  () => activeNodeId ? edges
    .filter((edge) => edge.fromNodeId === activeNodeId)
    .map((edge) => ({ id: edge.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, label: edge.label })) : [],
  [activeNodeId, edges],
)
```

The local `CanvasEdge` contract uses `fromNodeId` and `toNodeId`; preserve its `id` and existing `label` verbatim.

Replace the shell's Inspector props with:

```tsx
rightInspector={activeNode && isRightInspectorOpen ? (
  <CanvasRightInspector
    node={activeNode}
    sourceNode={inspectorSourceNode}
    incomingEdges={activeNodeIncomingEdges}
    outgoingEdges={activeNodeOutgoingEdges}
    nodeTitleById={nodeTitleById}
    projectId={projectId}
    onClose={() => setIsRightInspectorOpen(false)}
    onSelectNode={(nodeId) => {
      const node = nodes.find((candidate) => candidate.id === nodeId)
      if (node) selectNodeForMove(node)
    }}
    onOpenGenerationDialog={(nodeId) => openGenerationDialog(nodeId)}
    onOpenPromptInspector={(nodeId) => openPromptInspector(nodeId)}
    onOpenCameraControl={(nodeId) => {
      const node = nodes.find((candidate) => candidate.id === nodeId)
      if (node) openNodeScopedTool('camera-control', node)
    }}
    onOpenSceneLighting={(nodeId) => {
      const node = nodes.find((candidate) => candidate.id === nodeId)
      if (node) openNodeScopedTool('scene-lighting', node)
    }}
  />
) : undefined}
showRightInspector={Boolean(activeNode && isRightInspectorOpen)}
onDismissRightInspector={() => setIsRightInspectorOpen(false)}
```

Use a small local `find` only at callback invocation time; do not add selection duplicate state, alter `openNodeScopedTool`, change `lockedNodeToolContext`, or write Canvas state from selection/close operations.

- [ ] **Step 4: Keep the current bottom dock and selected toolbar behavior intact.**

Do not rename, remove, or route `CanvasBottomDock`. Keep the existing `AssetAgentToolbar` callbacks and all generation dialog code exactly as-is. The Inspector's `打开生成任务` button may only call the existing `openGenerationDialog(nodeId)` callback; it must not invoke `handleGenerate`, `fetch`, `scheduleCanvasSave`, or a Provider status request.

- [ ] **Step 5: Run static and focused context tests, then commit.**

Run:

```bash
node --test scripts/canvas-performance-request-storm-static.test.mjs
cd apps/web && node_modules/.bin/tsx --test \
  src/components/canvas/shell/CanvasWorkspaceShell.test.tsx \
  src/components/canvas/inspector/CanvasRightInspector.test.tsx
```

Expected: PASS. The static test must find the real conditional Inspector wiring and reject Inspector networking/saving.

```bash
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx \
  scripts/canvas-performance-request-storm-static.test.mjs
git commit -m "feat: connect canvas selection inspector"
```

### Task 4: Bound generation dialogs without shrinking default node cards

**Files:**
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts`
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`

- [ ] **Step 1: Extend the layout tests for the approved 16px margin.**

Change the dialog helper tests to pass viewport width and height. Add the exact cases:

```ts
test('keeps a desktop task dialog at its accepted 480 by 420 default', () => {
  assert.deepEqual(getCanvasNodeDialogSize(1440, 720), { width: 480, height: 420 })
})

test('reserves a 16px margin on a narrow and short viewport', () => {
  assert.deepEqual(getCanvasNodeDialogSize(390, 300), { width: 358, height: 268 })
})

test('does not change readable compact node dimensions at 100% zoom', () => {
  assert.deepEqual(getCanvasNodeSize('image'), { width: 248, height: 220 })
  assert.deepEqual(getCanvasNodeSize('video'), { width: 248, height: 220 })
})
```

- [ ] **Step 2: Run the layout test and verify it fails.**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: FAIL because the helper accepts one argument and reserves 24px per side.

- [ ] **Step 3: Implement a height-aware helper and consume it in positioning.**

Replace the helper with:

```ts
export function getCanvasNodeDialogSize(viewportWidth: number, viewportHeight: number): CanvasSize {
  const viewportMargin = 16
  return {
    width: Math.min(480, Math.max(0, viewportWidth - viewportMargin * 2)),
    height: Math.min(viewportWidth <= 900 ? 320 : 420, Math.max(0, viewportHeight - viewportMargin * 2)),
  }
}
```

In `VisualCanvasWorkspace.tsx`, change `viewportMargin` in `nodeDialogStyle` from `24` to `16`, then call `getCanvasNodeDialogSize(viewportWidth, viewportHeight)`. Keep `dialogScale`, node anchoring, above/below flip, source lock, footer controls, and all generation code unchanged.

- [ ] **Step 4: Run the focused geometry suite and commit.**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts`

Expected: PASS. Existing non-default node sizes must remain untouched.

```bash
git add apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts \
  apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts \
  apps/web/src/components/create/VisualCanvasWorkspace.tsx
git commit -m "fix: bound canvas task dialogs to viewport"
```

### Task 5: Run the Phase 1 verification gate and record the result

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run targeted component and static tests.**

Run:

```bash
node --test scripts/canvas-performance-request-storm-static.test.mjs
cd apps/web && node_modules/.bin/tsx --test \
  src/components/canvas/shell/CanvasWorkspaceShell.test.tsx \
  src/components/canvas/inspector/CanvasRightInspector.test.tsx \
  src/components/create/canvas/canvasWorkspaceLayout.test.ts \
  src/components/create/canvas/StoryboardDirectorInteractionGate.test.tsx
```

Expected: PASS. Treat any failure as a blocker; do not weaken assertions to pass it.

- [ ] **Step 2: Run the repository verification suite.**

Run:

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
git diff --name-only -- \
  ':!apps/web/src/components/canvas/shell/CanvasWorkspaceShell.tsx' \
  ':!apps/web/src/components/canvas/shell/canvasWorkspaceShell.module.css' \
  ':!apps/web/src/components/canvas/shell/CanvasWorkspaceShell.test.tsx' \
  ':!apps/web/src/components/canvas/inspector/CanvasRightInspector.tsx' \
  ':!apps/web/src/components/canvas/inspector/CanvasRightInspector.test.tsx' \
  ':!apps/web/src/components/create/VisualCanvasWorkspace.tsx' \
  ':!apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts' \
  ':!apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts' \
  ':!scripts/canvas-performance-request-storm-static.test.mjs' \
  ':!docs/CURRENT_STATUS.md' ':!docs/NEXT_TASKS.md'
```

Expected: type-check, lint, build, and diff-check PASS; forbidden-zone diff command has no output.

- [ ] **Step 3: Perform local browser QA at the required viewports.**

At `1280×720`, select an image node then a video node, confirm the Inspector updates with each selected node, its width stays between 320 and 420px, relationship/source navigation changes the displayed node, and the video element is absent until its explicit preview control is clicked.

At `390×844`, select a node, confirm the Inspector sheet remains inside the 16px margin, the close control and backdrop close it, reopening it does not create a Canvas PUT, and the bottom dock remains hidden.

Use browser network recording for both paths. Acceptance counts before a manual save are: Canvas `PUT` = 0, `/api/generate/*` = 0, Provider = 0, billing/credits/wallet/payment/recharge/checkout mutations = 0. A manual cloud save may issue at most one Canvas `PUT`.

- [ ] **Step 4: Run the local 20/50/100 node regression.**

Use the existing Canvas performance fixture or existing project safely, without generating media. At each of 20, 50, and 100 nodes: pan, zoom, select Node A then Node B, open/close Inspector, and open/cancel a generation dialog. Record that there is no `Maximum update depth` error, no hydration/key error, no stale target, no automatic video load, and no request storm.

- [ ] **Step 5: Update status documents only after every gate passes.**

In `docs/CURRENT_STATUS.md`, add a closed entry stating: four-zone shell Phase 1 is locally validated; selected-node Inspector reactivated; desktop aside and narrow sheet are bounded; no API, Provider, BYOK, generation, billing, schema, or persistence semantics changed; Production authenticated QA remains blocked by historical Supabase recovery.

In `docs/NEXT_TASKS.md`, mark `P0-TOOL-LAYOUT-RESTRUCTURE-PLAN` as Phase 1 complete and add the next explicit item: `P1-TOOL-PLUGIN-REGISTRY` begins only after Founder approval, first migrating Camera/Lighting with a same-change obsolete-entry removal.

- [ ] **Step 6: Commit verification/docs, push only after Founder-authorized implementation review, and stop.**

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: close canvas inspector shell phase"
git status --short
```

Expected: clean worktree. Do not claim Production QA or deploy readiness until Preview safe-write and Production read-only smoke can run against a recovered authenticated database. Push and deploy follow the repository's Founder-authorized release sequence after this implementation review.

## Self-review

- **Spec coverage:** Four zones are retained (existing top bar, existing left rail, Canvas node toolbar, activated right Inspector, and unchanged conditional bottom dock). Tasks 1–4 cover shared selection, source lock reuse, 320–420px desktop Inspector, 16px responsive sheet and dialog bounds, explicit controls, click-to-load video, and no semantic/tool migration. Task 5 covers A/B isolation, browser geometry, zero-request open/close paths, manual-save limit, and 20/50/100 node checks.
- **Intentionally deferred:** Moving or deleting old Camera/Lighting/Prompt controls, plugin-registry extraction, generation reliability changes, and Production authenticated QA are separate approved scopes. This batch adds Inspector shortcuts but does not remove current toolbar entries, so no existing workflow is made undiscoverable before migration tests exist.
- **Safety coverage:** Inspector has no fetch/save/generation code; workspace callbacks reuse `openNodeScopedTool` and `openGenerationDialog`; no API route, Provider/BYOK, billing, database, schema, env, executor, package, or production database file is modified.
- **Placeholder scan:** No task relies on TBD work or unnamed files. Exact test commands, callbacks, files, expected outcomes, and commit boundaries are specified.
- **Type consistency:** `onDismissRightInspector`, `InspectorEdgeRef`, `onOpenPromptInspector`, `onOpenCameraControl`, and `onOpenSceneLighting` are defined in Tasks 1–3 before their workspace use. Dialog helper calls use `(viewportWidth, viewportHeight)` in both test and runtime tasks.
