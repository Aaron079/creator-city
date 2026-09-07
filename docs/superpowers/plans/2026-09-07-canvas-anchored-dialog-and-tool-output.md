# Canvas Anchored Dialog and Tool Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a selected Canvas display node open one stable, independent surface sequence below it: category navigation, then a compact result-aware dialog after a category is chosen, with no duplicate node navigation or misleading tool output labels.

**Architecture:** Keep `VisualCanvasWorkspace` as the selected-node and modal coordinator. Add pure Canvas surface geometry to `canvasWorkspaceLayout.ts`, keep `AssetAgentToolbar` as the only node-category navigation, and render a new node-context dialog directly below it. Extend the existing typed node-tool registry with output metadata so the context dialog describes what each existing action actually does before delegating to its current callback.

**Tech Stack:** Next.js, React, TypeScript, existing Canvas CSS modules, Node `node:test`, TSX test runner, Playwright safe Preview QA.

---

## File Structure

- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts`
  - Pure, deterministic geometry for the display-node, navigation-bar, and dialog group.
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`
  - Unit contracts for desktop, narrow, edge, and lower-viewport geometry.
- Modify: `apps/web/src/components/create/AssetAgentToolbar.tsx`
  - Turn the selected-node toolbar into controlled `Task` / `Tools` / `Assets` category navigation; remove its duplicate popup ownership.
- Modify: `apps/web/src/components/create/AssetAgentToolbar.test.ts`
  - Cover category selection and viewport centering after the toolbar moves below its node.
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolTypes.ts`
  - Add typed output contract, output label, CTA label, and honest availability reason to every tool entry.
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
  - Classify existing tools as configuration, structured text, derived image, derived video, analysis, preview, or generation.
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.ts`
  - Preserve enabled-tool recommendations and add context-list availability records with explicit blocked reasons.
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts`
  - Cover visible-but-blocked context tools without changing recommendation behavior.
- Modify: `apps/web/src/components/create/canvas/node-tools/NodeToolCenter.tsx`
  - Support a compact contextual-dialog presentation that shows each tool's result badge and CTA text.
- Modify: `apps/web/src/components/create/canvas/node-tools/NodeToolCenter.test.ts`
  - Assert visible output labels and prevent a configuration tool from being labelled as generation.
- Create: `apps/web/src/components/create/canvas/node-tools/NodeToolContextDialog.tsx`
  - Own the independent rectangle below the selected-node category navigation; render category-specific child actions and honest unavailable states.
- Create: `apps/web/src/components/create/canvas/node-tools/NodeToolContextDialog.test.tsx`
  - Test category-to-content selection, one CTA per child action, and no duplicate category controls.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
  - Own one active node-context category, calculate below-node positions, render the dialog, close it on selection changes, and retain the existing generation/tool callbacks.
- Modify: `apps/web/src/components/create/canvas.module.css`
  - Replace tall/zoom-scaled node-dialog treatment with the approved rectangular, low-height visual language and add context-dialog styles.
- Modify: `apps/web/src/components/canvas/dock/CanvasBottomDock.tsx`
  - Keep the dock status-only; remove its duplicate “open task” action.
- Create: `apps/web/src/components/canvas/dock/CanvasBottomDock.test.tsx`
  - Assert the dock exposes status and selection only, not a second task launcher.
- Modify: `apps/web/tests/e2e/canvas-safe-preview.spec.ts`
  - Add authenticated-safe assertions for one selected-node navigation group, bounded dialog geometry, and zero forbidden mutations before manual save.
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`
  - Record the completed layout/semantic hardening and stop rather than auto-starting a new Canvas feature.

## Task 1: Add Pure Anchored-Surface Geometry

**Files:**
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts`
- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`

- [ ] **Step 1: Write failing geometry tests**

Add tests for the approved desktop targets and the lower-viewport pan request:

```ts
test('lays out the selected-node navigation and dialog below its display node', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 400, top: 120, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1440, bottom: 720 },
  })

  assert.deepEqual(layout.navigation, { left: 174, top: 358, width: 700, height: 48 })
  assert.deepEqual(layout.dialog, { left: 174, top: 412, width: 700, height: 210 })
  assert.equal(layout.panDeltaY, 0)
})

test('requests an upward canvas pan instead of flipping the dialog above the node', () => {
  const layout = getCanvasNodeContextSurfaceLayout({
    node: { left: 300, top: 460, width: 248, height: 220 },
    stage: { left: 0, top: 64, right: 1280, bottom: 720 },
  })

  assert.equal(layout.navigation.top, 698)
  assert.equal(layout.dialog.top, 752)
  assert.equal(layout.panDeltaY, -258)
})
```

- [ ] **Step 2: Run the layout test to verify it fails**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts
```

Expected: failure because `getCanvasNodeContextSurfaceLayout` is not exported.

- [ ] **Step 3: Implement the pure layout helper**

Add the following exported types and function to `canvasWorkspaceLayout.ts`; retain the legacy dialog helpers until their callers have migrated:

```ts
export type CanvasStageRect = { left: number; top: number; right: number; bottom: number }
export type CanvasNodeScreenRect = { left: number; top: number; width: number; height: number }
export type CanvasContextSurfaceLayout = {
  navigation: { left: number; top: number; width: number; height: number }
  dialog: { left: number; top: number; width: number; height: number }
  panDeltaY: number
}

const CONTEXT_NAVIGATION = { width: 700, height: 48, gap: 18 }
const CONTEXT_DIALOG = { width: 700, height: 210, gap: 6 }
const CONTEXT_STAGE_MARGIN = 16

export function getCanvasNodeContextSurfaceLayout({
  node,
  stage,
}: {
  node: CanvasNodeScreenRect
  stage: CanvasStageRect
}): CanvasContextSurfaceLayout {
  const stageWidth = Math.max(0, stage.right - stage.left)
  const navigationWidth = Math.min(CONTEXT_NAVIGATION.width, Math.max(0, stageWidth - CONTEXT_STAGE_MARGIN * 2))
  const dialogWidth = Math.min(CONTEXT_DIALOG.width, Math.max(0, stageWidth - CONTEXT_STAGE_MARGIN * 2))
  const nodeCenter = node.left + node.width / 2
  const navigationLeft = clampCanvasDialogLeftToStage(
    nodeCenter - navigationWidth / 2,
    navigationWidth,
    stage.left,
    stage.right,
    CONTEXT_STAGE_MARGIN,
  )
  const dialogLeft = clampCanvasDialogLeftToStage(
    nodeCenter - dialogWidth / 2,
    dialogWidth,
    stage.left,
    stage.right,
    CONTEXT_STAGE_MARGIN,
  )
  const navigationTop = node.top + node.height + CONTEXT_NAVIGATION.gap
  const dialogTop = navigationTop + CONTEXT_NAVIGATION.height + CONTEXT_DIALOG.gap
  const overflow = dialogTop + CONTEXT_DIALOG.height - (stage.bottom - CONTEXT_STAGE_MARGIN)

  return {
    navigation: { left: navigationLeft, top: navigationTop, width: navigationWidth, height: CONTEXT_NAVIGATION.height },
    dialog: { left: dialogLeft, top: dialogTop, width: dialogWidth, height: CONTEXT_DIALOG.height },
    panDeltaY: overflow > 0 ? -overflow : 0,
  }
}
```

- [ ] **Step 4: Run the focused geometry tests**

Run the command from Step 2.

Expected: PASS, including existing compact-node and legacy-normalization tests.

- [ ] **Step 5: Commit the geometry contract**

```bash
git add apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts
git commit -m "feat: anchor canvas node context surfaces"
```

## Task 2: Add Truthful Tool Output Metadata

**Files:**
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolTypes.ts`
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.ts`
- Modify: `apps/web/src/components/create/canvas/node-tools/NodeToolCenter.tsx`
- Modify: `apps/web/src/components/create/canvas/node-tools/NodeToolCenter.test.ts`
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts`

- [ ] **Step 1: Write failing result-contract tests**

Add tests that inspect the rendered dialog-mode tool list:

```ts
test('labels configuration tools as task adjustments rather than generators', () => {
  const tree = NodeToolCenter({
    nodeKind: 'image', hasMediaResult: true, caps: {}, presentation: 'context-dialog', onAction() {},
  })
  const visible = textContent(tree)
  assert.match(visible, /摄影机控制/)
  assert.match(visible, /调整任务参数/)
  assert.doesNotMatch(visible, /摄影机控制.*生成图片/)
})

test('labels reference extraction as a derived image result', () => {
  const tree = NodeToolCenter({
    nodeKind: 'image', hasMediaResult: true, caps: {}, presentation: 'context-dialog', onAction() {},
  })
  assert.match(textContent(tree), /分镜参考提取/)
  assert.match(textContent(tree), /创建参考图节点/)
})
```

- [ ] **Step 2: Run the focused tool-menu test to verify it fails**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/node-tools/NodeToolCenter.test.ts
```

Expected: failure because `presentation` and result labels do not exist.

- [ ] **Step 3: Extend registry types and classify every existing tool**

Extend `NodeToolEntry` with stable display-only metadata:

```ts
export type NodeToolOutputKind =
  | 'configuration'
  | 'structured-text'
  | 'derived-image'
  | 'derived-video'
  | 'analysis'
  | 'preview'
  | 'generation'

export interface NodeToolEntry {
  // Existing fields remain unchanged.
  outputKind: NodeToolOutputKind
  outputLabel: string
  primaryActionLabel: string
  unavailableReason?: string
}
```

Classify registry entries without changing their existing `openActionId`:

```ts
{ id: 'camera-control', outputKind: 'configuration', outputLabel: '调整任务参数', primaryActionLabel: '应用到任务' }
{ id: 'script-segmentation', outputKind: 'structured-text', outputLabel: '文本节点', primaryActionLabel: '创建分场节点' }
{ id: 'storyboard-reference-extractor', outputKind: 'derived-image', outputLabel: '图片节点', primaryActionLabel: '创建参考图节点' }
{ id: 'draw-annotation', outputKind: 'derived-image', outputLabel: '图片标注', primaryActionLabel: '保存标注' }
{ id: 'color-grade', outputKind: 'preview', outputLabel: '预览', primaryActionLabel: '打开调色预览' }
{ id: 'remove-background', outputKind: 'derived-image', outputLabel: '图片节点', primaryActionLabel: '创建透明背景图', unavailableReason: '主体抠图执行器尚不可用' }
```

- [ ] **Step 4: Preserve recommendations and expose blocked context tools honestly**

Keep `availableNodeTools()` and `recommendNodeTool()` as the enabled-only API so
existing recommendation behavior remains unchanged. Add a separate context-list
record and helper:

```ts
export type NodeToolContextItem = {
  tool: NodeToolEntry
  unavailableReason?: string
}

export function contextNodeTools(input: NodeToolRecommendationInput): readonly NodeToolContextItem[] {
  return NODE_TOOL_REGISTRY
    .filter((tool) => tool.supportedKinds.includes(input.nodeKind))
    .map((tool) => {
      if (tool.requiresMedia && !input.hasMediaResult) {
        return { tool, unavailableReason: '请先获得节点素材后再使用此工具' }
      }
      if (tool.capabilityKey === 'removeBackground' && !input.caps.removeBackground) {
        return { tool, unavailableReason: tool.unavailableReason ?? '主体抠图执行器尚不可用' }
      }
      if (tool.capabilityKey === 'upscale' && !input.caps.upscale) {
        return { tool, unavailableReason: tool.unavailableReason ?? '高清重建执行器尚不可用' }
      }
      return { tool }
    })
}
```

Add a focused test that an image node without the removal-background capability
still returns `主体抠图` with its blocked reason, while
`availableNodeTools()` still omits it.

- [ ] **Step 5: Render output metadata in dialog presentation**

Add an optional presentation prop and preserve the current menu behavior for callers that do not pass it:

```ts
interface NodeToolCenterProps {
  nodeKind: VisualCanvasNodeKind
  hasMediaResult: boolean
  caps: { removeBackground?: boolean; upscale?: boolean }
  presentation?: 'menu' | 'context-dialog'
  onAction: (actionId: string) => void
}

const resultText = presentation === 'context-dialog'
  ? `${item.tool.outputLabel} · ${item.tool.primaryActionLabel}`
  : tool.executionType === 'preview' ? '预览' : undefined
```

For a disabled capability, render `item.unavailableReason` with a disabled
button rather than omitting the tool or opening a generic prompt panel. In
`context-dialog` mode, map `contextNodeTools(toolInput)`; retain
`availableNodeTools(toolInput)` for legacy `menu` mode.

- [ ] **Step 6: Run focused tool tests**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/node-tools/NodeToolCenter.test.ts src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts
```

Expected: PASS, including recommendation action callbacks and the new truthful-output assertions.

- [ ] **Step 7: Commit the typed output contract**

```bash
git add apps/web/src/components/create/canvas/node-tools/nodeToolTypes.ts apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.ts apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts apps/web/src/components/create/canvas/node-tools/NodeToolCenter.tsx apps/web/src/components/create/canvas/node-tools/NodeToolCenter.test.ts
git commit -m "feat: label canvas tool outputs"
```

## Task 3: Replace Toolbar-Owned Popups With One Context Dialog

**Files:**
- Modify: `apps/web/src/components/create/AssetAgentToolbar.tsx`
- Modify: `apps/web/src/components/create/AssetAgentToolbar.test.ts`
- Create: `apps/web/src/components/create/canvas/node-tools/NodeToolContextDialog.tsx`
- Create: `apps/web/src/components/create/canvas/node-tools/NodeToolContextDialog.test.tsx`

- [ ] **Step 1: Write failing controlled-navigation tests**

Add tests for a toolbar that reports category selection to its owner instead of rendering nested menus:

```ts
test('reports one selected node category and owns no popup menu', () => {
  const categories: string[] = []
  const tree = AssetAgentToolbar({
    nodeKind: 'image', nodeTitle: 'Frame', activeCategory: 'tools',
    onCategoryChange: (category) => categories.push(category),
  })
  const visible = textContent(tree)
  assert.match(visible, /任务/)
  assert.match(visible, /工具/)
  assert.match(visible, /资产/)
  assert.doesNotMatch(visible, /推荐下一步/)
})
```

Add context-dialog tests that assert one category heading, one child-action list, one output badge per action, and no rendered `Task` / `Tools` / `Assets` duplicate inside the dialog.

- [ ] **Step 2: Run the toolbar and dialog tests to verify they fail**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/AssetAgentToolbar.test.ts src/components/create/canvas/node-tools/NodeToolContextDialog.test.tsx
```

Expected: failure because the controlled props and dialog component do not exist.

- [ ] **Step 3: Convert `AssetAgentToolbar` to a controlled category bar**

Use one category type and remove `openMenu`, `menuPlacement`, document listeners, `NodeToolCenter` rendering, and the asset popup from this component. `AssetAgentToolbarProps` retains only node identity plus controlled category state; move all media, reframe, asset, comparison, and tool callbacks to the new dialog:

```ts
export type NodeContextCategory = 'task' | 'tools' | 'assets'

export interface AssetAgentToolbarProps {
  nodeKind: VisualCanvasNodeKind
  nodeTitle: string
  activeCategory: NodeContextCategory | null
  onCategoryChange: (category: NodeContextCategory) => void
}

function selectCategory(category: NodeContextCategory, event: React.MouseEvent) {
  stopEvent(event)
  onCategoryChange(category)
}
```

Render all three category buttons for text, image, and video nodes. Move download,
fullscreen, reframe, compare, asset-library navigation, and registered tool actions
to the new context dialog so they retain the same callbacks without a second menu.

- [ ] **Step 4: Create `NodeToolContextDialog`**

Create a focused component with this public contract:

```ts
export interface NodeToolContextDialogProps {
  category: NodeContextCategory
  nodeKind: VisualCanvasNodeKind
  nodeTitle: string
  hasMediaResult: boolean
  mediaUrl: string
  nodeId?: string
  assetId?: string
  reframeMode: ReframeMode
  caps: { removeBackground?: boolean; upscale?: boolean }
  onOpenGenerationDialog(): void
  onToolAction(actionId: string): void
  onDownload?(): void
  onFullscreen?(): void
  onReframeChange(mode: ReframeMode): void
  onOpenABCompare?(): void
  onOpenAssets(): void
  onClose(): void
}
```

Render only one category body:

```tsx
if (category === 'task') return <TaskContextBody onOpenGenerationDialog={onOpenGenerationDialog} />
if (category === 'tools') return <NodeToolCenter presentation="context-dialog" {...toolProps} />
return <AssetContextBody hasMediaResult={hasMediaResult} reframeMode={reframeMode} onDownload={onDownload} onFullscreen={onFullscreen} onReframeChange={onReframeChange} onOpenABCompare={onOpenABCompare} onOpenAssets={onOpenAssets} />
```

`TaskContextBody` must use an explicit `打开生成任务` action and must not make a
request during render. `AssetContextBody` must keep unavailable controls disabled
with a short visible reason. The dialog header shows the selected child context
and result type, not a second category navigation.

- [ ] **Step 5: Run controlled-navigation tests**

Run the command from Step 2 plus:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/node-tools/NodeToolCenter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the independent dialog component**

```bash
git add apps/web/src/components/create/AssetAgentToolbar.tsx apps/web/src/components/create/AssetAgentToolbar.test.ts apps/web/src/components/create/canvas/node-tools/NodeToolContextDialog.tsx apps/web/src/components/create/canvas/node-tools/NodeToolContextDialog.test.tsx
git commit -m "feat: add canvas node context dialog"
```

## Task 4: Integrate the Anchored Group in the Workspace

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `apps/web/src/components/create/canvas.module.css`
- Modify: `apps/web/src/components/canvas/dock/CanvasBottomDock.tsx`
- Create: `apps/web/src/components/canvas/dock/CanvasBottomDock.test.tsx`

- [ ] **Step 1: Write failing source and component assertions**

Extend `canvasWorkspaceLayout.test.ts` to assert that `VisualCanvasWorkspace`
uses `getCanvasNodeContextSurfaceLayout`, no longer derives the task-dialog scale
from `canvasZoom`, and no longer contains the `aboveTop` placement branch.

Add a bottom-dock test asserting that the rendered dock contains status text but
does not contain an `打开任务` button.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts src/components/canvas/dock/CanvasBottomDock.test.tsx
```

Expected: failure because workspace geometry still uses `dialogScale`, and the dock still opens generation.

- [ ] **Step 3: Add one node-context owner to `VisualCanvasWorkspace`**

Add local UI state beside `activeNodeId` and clear it through the existing close
paths:

```ts
const [activeNodeContextCategory, setActiveNodeContextCategory] = useState<NodeContextCategory | null>(null)

const closeNodeContext = useCallback(() => {
  setActiveNodeContextCategory(null)
  setEditingNodeId(null)
}, [])
```

When `activeNodeId` changes, set the category to `null`. Extend
`resetCanvasModalStates` and the Canvas-background handler to call
`setActiveNodeContextCategory(null)` so one source node owns at most one visible
context group.

Convert the existing `toolbarFixedStyle` and `nodeDialogStyle` to use the pure
layout helper. The toolbar must always use the returned navigation geometry
below the active node. The generation dialog and new context dialog use the
returned dialog geometry. Remove these existing behaviors:

```ts
const dialogScale = clampNumber(canvasZoom, 0.56, 1)
const aboveTop = nodeTop - NODE_DIALOG_GAP - visualDialogHeight
const shouldPlaceToolbarBelow = nodeScreenTop - toolbarGap - toolbarHeight < 12
```

On opening the group, apply `layout.panDeltaY` to the Canvas view once per
`activeNodeId + activeNodeContextCategory` key. Use a `requestAnimationFrame`
and a ref containing the last adjusted key so a re-render cannot create a pan
loop. Do not mutate node coordinates or schedule a save.

- [ ] **Step 4: Render the controlled bar and dialog**

Pass controlled props to the existing toolbar:

```tsx
<AssetAgentToolbar
  {...toolbarProps}
  activeCategory={activeNodeContextCategory}
  onCategoryChange={(category) => {
    setActiveNodeContextCategory(category)
    if (category !== 'task') setEditingNodeId(null)
  }}
/>
```

Render `NodeToolContextDialog` only when a selected node has a non-task active
category. The `Task` category opens the existing `CanvasPromptBox` generation
surface in the same anchored dialog geometry. Recreate the old toolbar's
`handleToolAction` switch in `VisualCanvasWorkspace` and pass it as
`onToolAction`; it continues to call `openNodeScopedTool` or `openCanvasPanel`.
Opening either first closes the compact context dialog, preserving the
one-visible-surface rule.

Make the `CanvasBottomDock` status-only by removing its
`onOpenGenerationDialog` prop and its `打开任务` button. Keep task selection,
status, source linkage, and expand/collapse behavior unchanged.

- [ ] **Step 5: Apply the approved CSS geometry**

Update `canvas.module.css` so the two anchored rectangles use the current dark
Canvas language but no tall glass card behavior:

```css
.scope :global(.canvas-node-dialog.create-floating-console),
.scope :global(.canvas-node-context-dialog) {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(20, 23, 29, 0.98);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.48);
}

.scope :global(.canvas-node-context-dialog) {
  position: fixed;
  z-index: 90;
  min-height: 0;
  max-height: min(210px, calc(100vh - 32px));
  overflow: auto;
}
```

Keep all existing provider panel portal behavior intact. Do not alter
`/api/generate/*`, Provider account loading, billing controls, or request logic.

- [ ] **Step 6: Run focused UI and layout tests**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test \
  src/components/create/canvas/canvasWorkspaceLayout.test.ts \
  src/components/create/AssetAgentToolbar.test.ts \
  src/components/create/canvas/node-tools/NodeToolCenter.test.ts \
  src/components/create/canvas/node-tools/NodeToolContextDialog.test.tsx \
  src/components/canvas/dock/CanvasBottomDock.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit workspace integration**

```bash
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/canvas.module.css apps/web/src/components/canvas/dock/CanvasBottomDock.tsx apps/web/src/components/canvas/dock/CanvasBottomDock.test.tsx apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts
git commit -m "feat: anchor canvas node dialogs"
```

## Task 5: Browser, Network, and Regression QA

**Files:**
- Modify: `apps/web/tests/e2e/canvas-safe-preview.spec.ts`

- [ ] **Step 1: Add a safe Preview regression test**

After selecting a Canvas node, assert the one contextual group and its relative
geometry before manual save:

```ts
const toolbar = page.locator('.asset-agent-toolbar')
await expect(toolbar).toBeVisible()
const toolbarBox = await toolbar.boundingBox()
const nodeBox = await nodes.first().boundingBox()
assert.ok(toolbarBox && nodeBox)
expect(toolbarBox.y).toBeGreaterThan(nodeBox.y + nodeBox.height)

await page.getByRole('button', { name: '工具' }).click()
const contextDialog = page.locator('.canvas-node-context-dialog')
await expect(contextDialog).toBeVisible()
const dialogBox = await contextDialog.boundingBox()
assert.ok(dialogBox)
expect(dialogBox.y).toBeGreaterThan(toolbarBox.y + toolbarBox.height)
```

Continue to collect requests and assert `findForbiddenMutationRequests(requests)`
is empty before the existing explicit save action.

- [ ] **Step 2: Run focused browser QA**

Run only with the established safe Preview fixture:

```bash
pnpm --filter web exec playwright test --config=apps/web/playwright.canvas.config.ts apps/web/tests/e2e/canvas-safe-preview.spec.ts
```

Expected: PASS when the authenticated fixture is available; otherwise the test
must report its existing explicit fixture skip, not a false product failure.

- [ ] **Step 3: Run final static verification**

```bash
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check
git diff --check
git status --short
```

Expected: type-check, lint, build, agent check, and diff check pass. The final
status contains only expected documentation changes before the next commit.

- [ ] **Step 4: Commit QA coverage**

```bash
git add apps/web/tests/e2e/canvas-safe-preview.spec.ts
git commit -m "test: cover anchored canvas dialogs"
```

## Task 6: Close the Task Documentation

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Record the completed task accurately**

Add an entry that records:

```md
P0-CANVAS-ANCHORED-DIALOG-AND-TOOL-OUTPUT:
VALIDATED / CLOSED

- selected-node navigation, context dialog, and result labels are source-scoped;
- no duplicate Task / Tools / Assets navigation remains in the selected-node flow;
- no generation, Provider, BYOK, billing, schema, environment, or API behavior changed;
- browser QA distinguishes a missing authenticated fixture from a product failure.
```

Move the task to `CLOSED` in `docs/NEXT_TASKS.md` and name the next task without
starting it.

- [ ] **Step 2: Verify and commit documentation**

```bash
git diff --check
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close anchored canvas dialog hardening"
git status --short
```

Expected: clean worktree after the commit.

## Final Acceptance Checklist

- [ ] A selected text, image, or video node has exactly one `Task` / `Tools` /
  `Assets` navigation bar directly below the node.
- [ ] The active category opens exactly one compact dialog below that bar; no
  second toolbar or duplicate category navigation appears.
- [ ] At 100% Canvas view, the target geometry is display node, `18px`,
  navigation bar (`700 x 48` max), `6px`, dialog (`700 x 210` max).
- [ ] Lower-viewport opening pans the view upward rather than placing the
  dialog above the display node or outside the visible Canvas stage.
- [ ] Tool labels, CTA text, unavailable states, and result promises match the
  typed registry contract.
- [ ] Opening, switching, and closing UI surfaces make no automatic Canvas
  write, generation, Provider, billing, credit, wallet, or payment request.
- [ ] Existing source-node identity and derived-node lineage behavior remain
  unchanged.
