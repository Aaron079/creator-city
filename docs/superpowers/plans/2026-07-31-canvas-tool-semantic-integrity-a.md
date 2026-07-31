# Canvas Tool Semantic Integrity A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent legacy textual-only image edits from appearing as completed media and place storyboard-grid assets in stable, non-overlapping row/column positions.

**Architecture:** A new pure canvas-layout helper owns initial grid coordinates and collision resolution, allowing it to be tested without mounting the workspace. `VisualCanvasWorkspace` uses that helper only after a split crop has already become a persisted Asset. The unreachable legacy editor path is removed rather than converted into another competing edit model.

**Tech Stack:** Next.js, React, TypeScript, Node `node:test`, `tsx`, pnpm.

---

## File Structure

- Create: `apps/web/src/lib/canvas/storyboardGridPlacement.ts` — pure bounds, overlap, and grid-cell placement helpers.
- Create: `apps/web/src/lib/canvas/storyboardGridPlacement.test.ts` — executable unit tests for row/column and collision behavior.
- Create: `scripts/canvas-tool-semantic-integrity-static.test.mjs` — static regression boundary for the removed fake-completion editor path.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — use the pure placement helper and remove the legacy panel state/callback/render path.
- Delete: `apps/web/src/components/create/ImageEditorPanel.tsx` — obsolete UI that manufactured completed nodes without media output.
- Modify after verified production QA: `docs/CURRENT_STATUS.md`, `docs/NEXT_TASKS.md` — close the task and record exact verification evidence.

### Task 1: Establish and Test Deterministic Grid Placement

**Files:**
- Create: `apps/web/src/lib/canvas/storyboardGridPlacement.test.ts`
- Create: `apps/web/src/lib/canvas/storyboardGridPlacement.ts`

- [ ] **Step 1: Write the failing placement tests**

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { resolveStoryboardGridCellPosition } from './storyboardGridPlacement'

const source = { x: 100, y: 200, width: 380, height: 320 }
const size = { width: 380, height: 320 }

function overlaps(left, right) {
  return !(
    left.x + left.width + 24 < right.x ||
    right.x + right.width + 24 < left.x ||
    left.y + left.height + 24 < right.y ||
    right.y + right.height + 24 < left.y
  )
}

describe('resolveStoryboardGridCellPosition', () => {
  test('keeps same-row cells in distinct columns', () => {
    const left = resolveStoryboardGridCellPosition({ source, cell: { row: 0, col: 0 }, size, occupied: [] })
    const right = resolveStoryboardGridCellPosition({ source, cell: { row: 0, col: 1 }, size, occupied: [] })
    assert.equal(left.y, right.y)
    assert.ok(right.x > left.x)
  })

  test('keeps every 3x2 cell distinct and non-overlapping', () => {
    const positions = [0, 1, 2, 3, 4, 5].map((index) => resolveStoryboardGridCellPosition({
      source,
      cell: { row: Math.floor(index / 2), col: index % 2 },
      size,
      occupied: [],
    }))
    assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, 6)
    for (const [index, position] of positions.entries()) {
      for (const other of positions.slice(index + 1)) {
        assert.equal(overlaps({ ...position, ...size }, { ...other, ...size }), false)
      }
    }
  })

  test('moves a colliding cell to a non-overlapping position', () => {
    const occupied = { x: 720, y: 200, width: 380, height: 320 }
    const position = resolveStoryboardGridCellPosition({
      source,
      cell: { row: 0, col: 0 },
      size,
      occupied: [occupied],
    })
    assert.equal(overlaps({ ...position, ...size }, occupied), false)
  })
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/canvas/storyboardGridPlacement.test.ts
```

Expected: FAIL because `./storyboardGridPlacement` does not exist.

- [ ] **Step 3: Implement the smallest pure helper**

```ts
export type CanvasBounds = { x: number; y: number; width: number; height: number }
export type GridCellCoordinates = { row: number; col: number }

const GAP = 24
const SOURCE_GAP_X = 240
const COLUMN_GAP_X = 60
const ROW_GAP_Y = 25
const COLLISION_STEP_Y = 320
const FALLBACK_STEP_X = 120

function overlaps(left: CanvasBounds, right: CanvasBounds) {
  return !(
    left.x + left.width + GAP < right.x ||
    right.x + right.width + GAP < left.x ||
    left.y + left.height + GAP < right.y ||
    right.y + right.height + GAP < left.y
  )
}

export function resolveStoryboardGridCellPosition(input: {
  source: CanvasBounds
  cell: GridCellCoordinates
  size: Pick<CanvasBounds, 'width' | 'height'>
  occupied: CanvasBounds[]
}) {
  const candidate = {
    x: input.source.x + input.source.width + SOURCE_GAP_X + input.cell.col * (input.size.width + COLUMN_GAP_X),
    y: input.source.y + input.cell.row * (input.size.height + ROW_GAP_Y),
    width: input.size.width,
    height: input.size.height,
  }
  let next = { ...candidate }
  let guard = 0
  while (input.occupied.some((node) => overlaps(next, node)) && guard < 8) {
    next = { ...next, y: next.y + COLLISION_STEP_Y }
    guard += 1
  }
  if (input.occupied.some((node) => overlaps(next, node))) {
    next = { ...candidate, x: candidate.x + FALLBACK_STEP_X }
    guard = 0
    while (input.occupied.some((node) => overlaps(next, node)) && guard < 8) {
      next = { ...next, y: next.y + COLLISION_STEP_Y }
      guard += 1
    }
  }
  return { x: next.x, y: next.y }
}
```

- [ ] **Step 4: Run the new test and verify GREEN**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/canvas/storyboardGridPlacement.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the helper and its tests**

```bash
git add apps/web/src/lib/canvas/storyboardGridPlacement.ts apps/web/src/lib/canvas/storyboardGridPlacement.test.ts
git diff --cached --check
git commit -m "fix: place storyboard grid cells without overlap"
```

### Task 2: Remove Fake Completion and Wire Grid Placement Into the Workspace

**Files:**
- Create: `scripts/canvas-tool-semantic-integrity-static.test.mjs`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Delete: `apps/web/src/components/create/ImageEditorPanel.tsx`

- [ ] **Step 1: Write the failing static boundary test**

```js
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const workspace = readFileSync(resolve(root, 'apps/web/src/components/create/VisualCanvasWorkspace.tsx'), 'utf8')

describe('canvas tool semantic integrity boundary', () => {
  test('removes the legacy editor that produced completed textual-only media', () => {
    assert.equal(existsSync(resolve(root, 'apps/web/src/components/create/ImageEditorPanel.tsx')), false)
    assert.doesNotMatch(workspace, /ImageEditorPanel/)
    assert.doesNotMatch(workspace, /handleApplyImageEdit/)
    assert.doesNotMatch(workspace, /图片编辑器节点|姿势生成器|涂鸦生视频|涂鸦生图/)
  })
})
```

- [ ] **Step 2: Run the static test and verify RED**

Run:

```bash
node --test scripts/canvas-tool-semantic-integrity-static.test.mjs
```

Expected: FAIL because `ImageEditorPanel.tsx` and its workspace references still exist.

- [ ] **Step 3: Apply the minimal workspace changes**

1. Add this import beside the existing canvas-library imports:

```ts
import { resolveStoryboardGridCellPosition } from '@/lib/canvas/storyboardGridPlacement'
```

2. In `handleCreateStoryboardGridCellNode`, replace the literal `position` object with:

```ts
const nodeSize = getNodeSize('image')
const position = resolveStoryboardGridCellPosition({
  source: sourceNode,
  cell: { row: cell.metadata.row, col: cell.metadata.col },
  size: nodeSize,
  occupied: latestNodesRef.current,
})
```

3. Remove only the legacy-editor import, `image-editor` union member, `appliedImageEdit` state, `handleApplyImageEdit` callback, and its conditional render branch.
4. Delete `apps/web/src/components/create/ImageEditorPanel.tsx` with `apply_patch`; do not alter `AnnotationPanel`, `SceneToolLayer`, `SceneToolPalette`, `ImageEditStudio`, or stored metadata logic.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
node --test scripts/canvas-tool-semantic-integrity-static.test.mjs
pnpm --filter web exec tsx --test src/lib/canvas/storyboardGridPlacement.test.ts src/lib/canvas/storyboardGridSplit.test.ts src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts src/app/api/assets/upload/project-validation.test.ts
pnpm --filter web exec tsx --test src/lib/canvas/annotationMetadata.test.ts
node --test scripts/canvas-draw-annotation-static.test.mjs
```

Expected: all tests PASS; no Provider, generate, billing, credit, wallet, or upload calls originate from annotation helpers.

- [ ] **Step 5: Commit the semantic integrity change**

```bash
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx scripts/canvas-tool-semantic-integrity-static.test.mjs
git add -u apps/web/src/components/create/ImageEditorPanel.tsx
git diff --cached --check
git commit -m "fix: remove misleading image edit completion"
```

### Task 3: Verify the Product Boundary, Release, and Record Evidence

**Files:**
- Modify after verified release: `docs/CURRENT_STATUS.md`
- Modify after verified release: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run repository verification before pushing**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
git status --short
```

Expected: type-check/build exit 0; lint has no new warnings or errors; diff-check exits 0; only intended committed work is present.

- [ ] **Step 2: Run local browser QA with an existing result-bearing image node**

1. Open `/create` and an existing safe QA project.
2. Open the image node tool menu and confirm the removed legacy editor is not reachable.
3. Open `分镜拆格`, choose a manual 2x2 layout, and create all four persisted crop assets.
4. Confirm each child image node has a distinct location, no card overlaps another, and the source node remains unchanged.
5. Save manually, refresh, and confirm the four child nodes and lineage persist.
6. Inspect console and network: no `/api/generate/*`, Provider, billing, credits, wallet, payment, recharge, or checkout mutation. Record unavailable instrumentation as `QA_HARNESS_LIMITATION`, never as a product PASS.

- [ ] **Step 3: Push implementation and wait for Vercel Production Ready**

```bash
git push origin main
git rev-parse HEAD
```

Expected: `origin/main` contains the implementation SHA; Vercel Production reaches READY before production QA begins.

- [ ] **Step 4: Repeat the same safe 2x2 production QA**

Record exact deployment SHA, project used, node counts before/after, save/reload outcome, console result, and any network-harness limitation. Do not run Provider generation, real payment, or asset-transform execution.

- [ ] **Step 5: Update task documentation only after production evidence exists**

Add a closed entry that includes the two implementation commits, Production SHA, the removal of false completion, grid non-overlap evidence, persistence result, targeted test counts, browser classification, and the untouched forbidden zones. Set the next task to the separately-approved annotation compatibility design; do not start it.

- [ ] **Step 6: Commit and push the QA documentation**

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close canvas tool semantic integrity"
git push origin main
git status --short
```

Expected: a clean `main` worktree after the documentation push.

## Plan Self-Review

- Spec coverage: Task 1 addresses deterministic row/column placement and collision safety; Task 2 removes the fake completed-media path without touching existing annotation data; Task 3 verifies browser behavior, forbidden zones, release, and documentation.
- Placeholder scan: no incomplete or unspecified implementation steps remain.
- Type consistency: the helper accepts structural canvas bounds so `VisualCanvasNode`, source bounds, node size, and `latestNodesRef.current` satisfy the input without leaking workspace types into `lib/canvas`.
