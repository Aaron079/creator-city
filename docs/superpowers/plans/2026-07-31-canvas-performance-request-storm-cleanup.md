# Canvas Performance and Request-Storm Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound canvas render work for 20, 50, and 100 nodes by indexing node lookups and isolating unchanged node-card rendering, without changing cloud-save, media, generation, Provider, BYOK, payment, or database behavior.

**Architecture:** A pure canvas-render planning module owns the node index, indexed edge resolution, and memo-comparison contract. `VisualCanvasWorkspace` derives that index once per node revision and supplies a stable card-props factory through a ref. A memoized `CanvasNodeLayer` owns node-id-bound event closures, so parent renders caused by viewport or unrelated state updates do not re-render unchanged `CanvasNodeCard` content.

**Tech Stack:** TypeScript, React, Node `node:test` run through workspace `tsx`, and static contract tests run with Node.

---

## File Structure

- Create: `apps/web/src/components/create/canvas/canvasRenderPlanning.ts` — generic read-only node index, indexed edge resolution, and node-layer comparison contract.
- Create: `apps/web/src/components/create/canvas/canvasRenderPlanning.test.ts` — deterministic 20/50/100-node coverage for index, edge resolution, and memo isolation.
- Create: `apps/web/src/components/create/canvas/CanvasNodeLayer.tsx` — memoized node-card render layer with stable factory input.
- Modify: `apps/web/src/components/create/CanvasNodeCard.tsx` — export `CanvasNodeCardProps` for the layer's typed factory; preserve runtime markup and behavior.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — derive `nodeById`, render indexed edges, and replace inline card mapping with the layer plus a stable ref-backed card factory.
- Create: `scripts/canvas-performance-request-storm-static.test.mjs` — static boundary for index/memo integration and unchanged save/media guarantees.
- Modify: `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` only after implementation and QA are validated.

## Task 1: Establish the Pure Render-Planning Contract With RED Tests

**Files:**
- Create: `apps/web/src/components/create/canvas/canvasRenderPlanning.test.ts`
- Create after RED: `apps/web/src/components/create/canvas/canvasRenderPlanning.ts`

- [ ] **Step 1: Write the missing-module RED test**

Create `apps/web/src/components/create/canvas/canvasRenderPlanning.test.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildCanvasNodeIndex,
  canvasNodeLayerPropsEqual,
  resolveCanvasEdgeNodes,
  type CanvasNodeLayerVisualState,
} from './canvasRenderPlanning'

type Node = { id: string; revision: number }
type Edge = { fromNodeId: string; toNodeId: string }

function nodes(count: number): Node[] {
  return Array.from({ length: count }, (_, index) => ({ id: `node-${index}`, revision: 1 }))
}

function visualState(node: Node): CanvasNodeLayerVisualState<Node> {
  return {
    node,
    active: false,
    dragging: false,
    incomingSourceNode: undefined,
    incomingPortraitLikely: false,
    sourceNodeTitle: undefined,
    sourceNodeMissing: false,
    reframeMode: 'original',
    canCreateDerivedVideo: false,
    canOpenGenerationDialog: false,
  }
}

describe('canvas render planning', () => {
  test('indexes and resolves every edge for 20, 50, and 100 nodes', () => {
    for (const count of [20, 50, 100]) {
      const fixture = nodes(count)
      const index = buildCanvasNodeIndex(fixture)
      const edges: Edge[] = fixture.slice(1).map((node, position) => ({
        fromNodeId: fixture[position].id,
        toNodeId: node.id,
      }))

      assert.equal(index.size, count)
      for (const edge of edges) {
        assert.deepEqual(resolveCanvasEdgeNodes(index, edge), {
          fromNode: index.get(edge.fromNodeId),
          toNode: index.get(edge.toNodeId),
        })
      }
    }
  })

  test('isolates every unchanged node layer when one node changes', () => {
    for (const count of [20, 50, 100]) {
      const previous = nodes(count)
      const next = previous.map((node, index) => index === Math.floor(count / 2)
        ? { ...node, revision: 2 }
        : node)
      const equalCount = previous.filter((node, index) => (
        canvasNodeLayerPropsEqual(visualState(node), visualState(next[index]))
      )).length

      assert.equal(equalCount, count - 1)
    }
  })

  test('re-renders a layer when visual state, source, or node identity changes', () => {
    const source = { id: 'source', revision: 1 }
    const node = { id: 'node', revision: 1 }
    const baseline = visualState(node)

    assert.equal(canvasNodeLayerPropsEqual(baseline, { ...baseline, active: true }), false)
    assert.equal(canvasNodeLayerPropsEqual(baseline, { ...baseline, incomingSourceNode: source }), false)
    assert.equal(canvasNodeLayerPropsEqual(baseline, { ...baseline, node: { ...node } }), false)
  })
})
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasRenderPlanning.test.ts
```

Expected: FAIL with `Cannot find module './canvasRenderPlanning'`.

- [ ] **Step 3: Preserve the test boundary**

Do not use timers, DOM rendering, browser globals, a database, or generated assets in this test. It proves bounded render planning only; it is not a fake frame-rate benchmark.

## Task 2: Implement the Indexed Render Planner

**Files:**
- Create: `apps/web/src/components/create/canvas/canvasRenderPlanning.ts`
- Test: `apps/web/src/components/create/canvas/canvasRenderPlanning.test.ts`

- [ ] **Step 1: Add the generic index and edge resolver**

Create `canvasRenderPlanning.ts` with:

```ts
export type CanvasNodeIdentity = { id: string }
export type CanvasEdgeIdentity = { fromNodeId: string; toNodeId: string }

export function buildCanvasNodeIndex<Node extends CanvasNodeIdentity>(nodes: readonly Node[]) {
  return new Map(nodes.map((node) => [node.id, node]))
}

export function resolveCanvasEdgeNodes<
  Node extends CanvasNodeIdentity,
  Edge extends CanvasEdgeIdentity,
>(nodeById: ReadonlyMap<string, Node>, edge: Edge) {
  const fromNode = nodeById.get(edge.fromNodeId)
  const toNode = nodeById.get(edge.toNodeId)
  return fromNode && toNode ? { fromNode, toNode } : null
}
```

- [ ] **Step 2: Add the explicit visual comparison contract**

Append this contract to the same file:

```ts
export type CanvasNodeLayerVisualState<Node, Mode = string> = {
  node: Node
  active: boolean
  dragging: boolean
  incomingSourceNode: Node | undefined
  incomingPortraitLikely: boolean
  sourceNodeTitle: string | undefined
  sourceNodeMissing: boolean
  reframeMode: Mode
  canCreateDerivedVideo: boolean
  canOpenGenerationDialog: boolean
}

export function canvasNodeLayerPropsEqual<Node, Mode>(
  previous: CanvasNodeLayerVisualState<Node, Mode>,
  next: CanvasNodeLayerVisualState<Node, Mode>,
) {
  return previous.node === next.node
    && previous.active === next.active
    && previous.dragging === next.dragging
    && previous.incomingSourceNode === next.incomingSourceNode
    && previous.incomingPortraitLikely === next.incomingPortraitLikely
    && previous.sourceNodeTitle === next.sourceNodeTitle
    && previous.sourceNodeMissing === next.sourceNodeMissing
    && previous.reframeMode === next.reframeMode
    && previous.canCreateDerivedVideo === next.canCreateDerivedVideo
    && previous.canOpenGenerationDialog === next.canOpenGenerationDialog
}
```

The mode type remains generic so the planner never narrows the actual `ReframeMode` union from `AssetAgentToolbar`.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasRenderPlanning.test.ts
```

Expected: all three tests PASS for 20, 50, and 100-node fixtures.

## Task 3: Establish the Memo-Layer Static Contract With RED Tests

**Files:**
- Create: `scripts/canvas-performance-request-storm-static.test.mjs`
- Create after RED: `apps/web/src/components/create/canvas/CanvasNodeLayer.tsx`
- Modify after RED: `apps/web/src/components/create/CanvasNodeCard.tsx`

- [ ] **Step 1: Write the static boundary**

Create `scripts/canvas-performance-request-storm-static.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspace = readFileSync(
  new URL('../apps/web/src/components/create/VisualCanvasWorkspace.tsx', import.meta.url),
  'utf8',
)
const layer = readFileSync(
  new URL('../apps/web/src/components/create/canvas/CanvasNodeLayer.tsx', import.meta.url),
  'utf8',
)
const card = readFileSync(
  new URL('../apps/web/src/components/create/CanvasNodeCard.tsx', import.meta.url),
  'utf8',
)

test('canvas nodes use a memoized, ref-backed render layer', () => {
  assert.match(layer, /memo\(/)
  assert.match(layer, /canvasNodeLayerPropsEqual/)
  assert.match(layer, /createCardProps/)
  assert.match(workspace, /nodeCardPropsFactoryRef/)
  assert.match(workspace, /<CanvasNodeLayer/)
  assert.match(card, /export interface CanvasNodeCardProps/)
})

test('canvas edges resolve through the indexed node map', () => {
  assert.match(workspace, /buildCanvasNodeIndex\(nodes\)/)
  assert.match(workspace, /resolveCanvasEdgeNodes\(nodeById, edge\)/)
  const surface = workspace.slice(workspace.indexOf('{edges.length > 0 ?'))
  assert.doesNotMatch(surface.slice(0, 2600), /nodes\.find\(/)
})

test('save and media request-storm safeguards remain intact', () => {
  assert.match(workspace, /Autosave is local-only/)
  assert.match(workspace, /Cloud sync only happens when user clicks "保存到云端"/)
  assert.match(card, /Click-to-load overlay/)
  assert.match(card, /preload="metadata"/)
  assert.match(card, /loading="lazy"/)
})
```

- [ ] **Step 2: Run the RED static test**

Run:

```bash
node --test scripts/canvas-performance-request-storm-static.test.mjs
```

Expected: FAIL because the memo layer and render index integration do not exist.

## Task 4: Implement the Memoized Node Layer and Integrate It

**Files:**
- Create: `apps/web/src/components/create/canvas/CanvasNodeLayer.tsx`
- Modify: `apps/web/src/components/create/CanvasNodeCard.tsx:58-94`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx:1-10, 8988-9013, 11207-11320`
- Test: `apps/web/src/components/create/canvas/canvasRenderPlanning.test.ts`
- Test: `scripts/canvas-performance-request-storm-static.test.mjs`

- [ ] **Step 1: Export the existing card props type without changing its API**

Change only the declaration:

```ts
export interface CanvasNodeCardProps {
  // Preserve every existing property and callback exactly as currently declared.
}
```

Do not alter any `CanvasNodeCard` JSX, action wiring, media state, or card CSS.

- [ ] **Step 2: Add `CanvasNodeLayer` with a stable factory input**

Create `CanvasNodeLayer.tsx` using this shape:

```tsx
'use client'

import { memo } from 'react'
import {
  CanvasNodeCard,
  type CanvasNodeCardProps,
  type VisualCanvasNode,
} from '@/components/create/CanvasNodeCard'
import type { ReframeMode } from '@/components/create/AssetAgentToolbar'
import {
  canvasNodeLayerPropsEqual,
  type CanvasNodeLayerVisualState,
} from './canvasRenderPlanning'

export type CanvasNodeCardPropsFactory = (
  state: CanvasNodeLayerVisualState<VisualCanvasNode, ReframeMode>,
) => CanvasNodeCardProps

export type CanvasNodeLayerProps = CanvasNodeLayerVisualState<VisualCanvasNode, ReframeMode> & {
  createCardProps: CanvasNodeCardPropsFactory
}

function CanvasNodeLayerComponent(props: CanvasNodeLayerProps) {
  return <CanvasNodeCard {...props.createCardProps(props)} />
}

export const CanvasNodeLayer = memo(
  CanvasNodeLayerComponent,
  (previous, next) => (
    canvasNodeLayerPropsEqual(previous, next)
    && previous.createCardProps === next.createCardProps
  ),
)
```

The generic planner state carries the exact `ReframeMode` type; it must not
introduce a narrowed duplicate union.

- [ ] **Step 3: Add a ref-backed, current-state card factory in the workspace**

Near the other refs in `VisualCanvasWorkspace`, add a ref whose current value
is a `CanvasNodeCardPropsFactory`. On each workspace render, replace
`ref.current` with a factory that builds the current card props for a supplied
visual state. It must preserve all existing action routing, including:

```ts
onSelect: () => selectNodeForMove(node),
onAddPrev: (event) => startConnectionDrag(node.id, 'in', event),
onAddNext: (event) => startConnectionDrag(node.id, 'out', event),
onDragStart: (event) => handleNodeDragStart(node.id, event),
onOpenContextMenu: (event) => openNodeContextMenu(node.id, event.clientX, event.clientY),
onEdit: () => focusPromptForNode(node),
onOpenPreview: (type) => openNodePreview(node, type),
onOpenPromptInspector: () => openPromptInspector(node.id),
```

Carry over each existing optional recovery, creative-assets, storyboard,
workflow-continue, derived-video, and text-generation callback unchanged. Then
derive one stable callback once:

```ts
const createCanvasNodeCardProps = useCallback((state: CanvasNodeLayerVisualState<VisualCanvasNode, ReframeMode>) => (
  nodeCardPropsFactoryRef.current(state)
), [])
```

The stable callback may read the current factory ref, but must never read or
write storage, make a request, or mutate node/edge state merely by rendering.

- [ ] **Step 4: Derive one node index and use it in edge and node rendering**

Import `buildCanvasNodeIndex`, `resolveCanvasEdgeNodes`, and `CanvasNodeLayer`.
Before the surface JSX, derive:

```ts
const nodeById = useMemo(() => buildCanvasNodeIndex(nodes), [nodes])
```

Replace the edge's two `nodes.find` calls with:

```ts
const edgeNodes = resolveCanvasEdgeNodes(nodeById, edge)
if (!edgeNodes) return null
const { fromNode, toNode } = edgeNodes
```

Replace the inline `CanvasNodeCard` element with `CanvasNodeLayer`. Pass the
node, active/dragging flags, upstream source node obtained from `nodeById`,
portrait flag, existing source title/missing-state values, the current reframe
mode, derived-video/text-generation eligibility booleans, and the stable
`createCanvasNodeCardProps`. Preserve the surrounding positioned `<div>` and
`CanvasNodeErrorBoundary` unchanged.

- [ ] **Step 5: Verify the focused suite and static contract**

Run:

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasRenderPlanning.test.ts src/components/create/canvas/canvasSaveScheduling.test.ts src/lib/canvas/canvasSaveIntegrity.test.ts
node --test scripts/canvas-performance-request-storm-static.test.mjs scripts/canvas-save-integrity-static.test.mjs
```

Expected: all tests PASS. The static test must prove edge lookup has no
`nodes.find` in its surface render block and that save/media safeguards remain.

## Task 5: Full Validation and Read-Only Browser QA

**Files:**
- No new product files beyond Tasks 1-4.

- [ ] **Step 1: Run mandatory verification**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
git diff --name-only
```

Expected: type-check/build/diff-check PASS; lint may contain only previously
known warnings, with no new warning in task-touched files.

- [ ] **Step 2: Check forbidden zones**

```bash
git diff --name-only | rg '(^apps/server/prisma/|(^|/)\.env|payment|credits|wallet|billing|provider|/api/generate/|cn-executor|package\.json|pnpm-lock\.yaml|next\.config\.js)' && exit 1 || true
```

Expected: no output. If a file in this forbidden set appears, stop and report
`SCOPE_EXPANSION_REQUIRED`.

- [ ] **Step 3: Run Production Chrome QA without mutating data**

Open the existing Golden Path project, select `使用服务器版本` if a local-draft
prompt appears, and do not create, edit, drag, save, generate, upload, or open
a Provider flow. Record only:

1. Rendered `.canvas-node-card` count matches the server project.
2. Video node count is nonzero while mounted `<video>` count is zero before a
   user preview action.
3. Existing image nodes render and use lazy image markup.
4. New console warn/error count is zero after load.
5. No user action initiated a canvas `PUT`, generation, Provider, billing, or
   payment call.

Classify exact network counts and frame timing as `QA_HARNESS_LIMITATION` when
the browser surface does not expose them. Do not call that a product PASS.

## Task 6: Documentation, Commit, Push, and Deployment Closeout

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Record the validated outcome**

Add a dated `P1-CANVAS-PERFORMANCE-AND-REQUEST-STORM-CLEANUP` closeout entry to
`CURRENT_STATUS.md` containing: implementation SHA, focused test totals,
mandatory validation, production read-only results, explicit QA limitations,
and confirmation that save/generation/Provider/payment/schema/env/database
boundaries were untouched.

Change the corresponding `NEXT_TASKS.md` row to `VALIDATED / CLOSED`; state
that viewport virtualization is intentionally deferred until a future measured
need and that no new task starts automatically.

- [ ] **Step 2: Commit implementation only after all validation passes**

```bash
git add apps/web/src/components/create/CanvasNodeCard.tsx \
  apps/web/src/components/create/VisualCanvasWorkspace.tsx \
  apps/web/src/components/create/canvas/canvasRenderPlanning.ts \
  apps/web/src/components/create/canvas/canvasRenderPlanning.test.ts \
  apps/web/src/components/create/canvas/CanvasNodeLayer.tsx \
  scripts/canvas-performance-request-storm-static.test.mjs
git diff --cached --check
git commit -m "perf: isolate canvas node rendering"
git push origin main
```

- [ ] **Step 3: Wait for Vercel Production Ready and perform the read-only QA**

Record the deployment SHA and result. Do not claim Production PASS if only
local tests completed.

- [ ] **Step 4: Commit and push docs separately**

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close canvas performance cleanup"
git push origin main
git status --short
```

Expected: clean working tree and no unpushed commits.

## Plan Self-Review

- The plan changes no persistence or request behavior; it verifies existing
  local-first, click-to-load safeguards explicitly.
- The pure tests cover the requested 20/50/100-node scale as deterministic
  bounded-work evidence and do not misrepresent themselves as browser timing.
- The only proposed component API change is exporting an existing props type;
  all runtime card props and callback behavior remain preserved by the factory.
- No package, database, env, Provider, generation, BYOK, payment, or executor
  work is included.
