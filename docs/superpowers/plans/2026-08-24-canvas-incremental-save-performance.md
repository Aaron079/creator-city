# Canvas Incremental Save Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make large-canvas cloud saves fast by batching server persistence and sending only changed entities for normal saves, while retaining full-snapshot compatibility and current recovery guarantees.

**Architecture:** Add a pure client payload helper that selects dirty node and edge records from the canonical canvas snapshot. The workspace derives dirty identities centrally from existing commit boundaries, submits `saveMode: 'incremental'` for normal saves, and clears pending identities only after a successful acknowledgement. The canvas PUT route keeps workflow-version reservation, validates either request mode, and delegates normalized node and edge writes to parameterized PostgreSQL bulk-upsert helpers; old/full requests remain supported.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma 5 tagged-template SQL, PostgreSQL, Node test runner, `tsx`.

---

## File Map

- Create: `apps/web/src/lib/canvas/canvasIncrementalSave.ts` — pure client dirty-set and entity-payload selection.
- Create: `apps/web/src/lib/canvas/canvasIncrementalSave.test.ts` — TDD coverage for client payload behavior.
- Create: `apps/web/src/lib/projects/canvas-bulk-persistence.ts` — normalized, parameterized node/edge bulk-upsert builders.
- Create: `apps/web/src/lib/projects/canvas-bulk-persistence.test.ts` — TDD coverage for normalization and media preservation inputs.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — central dirty tracking, incremental requests, acknowledgement handling.
- Modify: `apps/web/src/app/api/projects/[projectId]/canvas/route.ts` — request-mode validation and bulk-helper integration.
- Modify: `scripts/canvas-save-integrity-static.test.mjs` — static route/client contract checks.
- Create: `scripts/canvas-incremental-save-static.test.mjs` — integration-boundary regressions for the new behavior.
- Modify: `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` — closeout after all production evidence is available.

## Task 1: Define incremental payload behavior with failing unit tests

**Files:**
- Create: `apps/web/src/lib/canvas/canvasIncrementalSave.test.ts`
- Create: `apps/web/src/lib/canvas/canvasIncrementalSave.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildCanvasEntitySavePayload, collectChangedEntityIds } from './canvasIncrementalSave'

const nodes = [{ id: 'node-a', title: 'A' }, { id: 'node-b', title: 'B' }]
const edges = [{ id: 'edge-a', fromNodeId: 'node-a', toNodeId: 'node-b' }]

describe('canvas incremental save payload', () => {
  test('sends no entity upserts for an unchanged incremental save', () => {
    assert.deepEqual(buildCanvasEntitySavePayload({ nodes, edges, dirtyNodeIds: new Set(), dirtyEdgeIds: new Set() }), {
      saveMode: 'incremental', nodes: [], edges: [],
    })
  })
  test('sends only the dirty node and edge', () => {
    assert.deepEqual(buildCanvasEntitySavePayload({
      nodes, edges, dirtyNodeIds: new Set(['node-b']), dirtyEdgeIds: new Set(['edge-a']),
    }), { saveMode: 'incremental', nodes: [nodes[1]], edges })
  })
  test('uses a full snapshot when the dirty baseline is unavailable', () => {
    assert.deepEqual(buildCanvasEntitySavePayload({
      nodes, edges, dirtyNodeIds: new Set(), dirtyEdgeIds: new Set(), forceFull: true,
    }), { saveMode: 'full', nodes, edges })
  })
  test('derives only changed identities from immutable commit results', () => {
    const previous = [{ id: 'node-a', title: 'A' }, { id: 'node-b', title: 'B' }]
    const next = [previous[0], { id: 'node-b', title: 'Edited' }, { id: 'node-c', title: 'C' }]
    assert.deepEqual([...collectChangedEntityIds(previous, next)], ['node-b', 'node-c'])
  })
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test src/lib/canvas/canvasIncrementalSave.test.ts
```

Expected: FAIL because `canvasIncrementalSave` does not exist.

- [ ] **Step 3: Implement the smallest pure helper**

```ts
export type CanvasSaveEntity = { id: string }

export function collectChangedEntityIds<T extends CanvasSaveEntity>(previous: readonly T[], next: readonly T[]) {
  const previousById = new Map(previous.map((entity) => [entity.id, entity]))
  return new Set(next.filter((entity) => previousById.get(entity.id) !== entity).map((entity) => entity.id))
}

export function buildCanvasEntitySavePayload<Node extends CanvasSaveEntity, Edge extends CanvasSaveEntity>({
  nodes, edges, dirtyNodeIds, dirtyEdgeIds, forceFull = false,
}: {
  nodes: readonly Node[]
  edges: readonly Edge[]
  dirtyNodeIds: ReadonlySet<string>
  dirtyEdgeIds: ReadonlySet<string>
  forceFull?: boolean
}) {
  if (forceFull) return { saveMode: 'full' as const, nodes: [...nodes], edges: [...edges] }
  return {
    saveMode: 'incremental' as const,
    nodes: nodes.filter((node) => dirtyNodeIds.has(node.id)),
    edges: edges.filter((edge) => dirtyEdgeIds.has(edge.id)),
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run the same `tsx --test` command. Expected: all four tests PASS.

- [ ] **Step 5: Commit the focused helper**

```bash
git add apps/web/src/lib/canvas/canvasIncrementalSave.ts apps/web/src/lib/canvas/canvasIncrementalSave.test.ts
git commit -m "feat: add incremental canvas save payload"
```

## Task 2: Define bulk persistence inputs with failing unit tests

**Files:**
- Create: `apps/web/src/lib/projects/canvas-bulk-persistence.test.ts`
- Create: `apps/web/src/lib/projects/canvas-bulk-persistence.ts`

- [ ] **Step 1: Write failing normalization tests**

Test three invariants: a node row carries the existing `(workflowId, nodeId)` identity; empty media results normalize to `null` so an update preserves an existing stored URL; and an edge row carries `(workflowId, edgeId)` plus JSON text. Use representative input objects only; no database connection or environment is permitted.

- [ ] **Step 2: Verify RED**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test src/lib/projects/canvas-bulk-persistence.test.ts
```

Expected: FAIL because the normalization module does not exist.

- [ ] **Step 3: Implement normalized row builders and tagged SQL helpers**

Export:

```ts
export function prepareCanvasNodeRows(args: {
  workflowId: string
  projectId: string
  now: Date
  nodes: CanvasNodeSaveInput[]
}): CanvasNodeWriteRow[]

export function prepareCanvasEdgeRows(args: {
  workflowId: string
  now: Date
  edges: CanvasEdgeSaveInput[]
}): CanvasEdgeWriteRow[]

export function buildCanvasNodeBulkUpsert(rows: readonly CanvasNodeWriteRow[]): Prisma.Sql | null
export function buildCanvasEdgeBulkUpsert(rows: readonly CanvasEdgeWriteRow[]): Prisma.Sql | null
```

Use `Prisma.sql` and `Prisma.join` only. Build one parameterized statement for each non-empty collection. The node upsert keeps all current fields and uses:

```sql
ON CONFLICT ("workflowId", "nodeId") DO UPDATE SET
  "resultImageUrl" = COALESCE(EXCLUDED."resultImageUrl", "CanvasNode"."resultImageUrl"),
  "resultVideoUrl" = COALESCE(EXCLUDED."resultVideoUrl", "CanvasNode"."resultVideoUrl"),
  "updatedAt" = EXCLUDED."updatedAt"
```

alongside existing scalar and JSON assignments. Bind JSON as JSON-text parameters cast to `jsonb`; never concatenate user data into SQL. The edge statement uses the existing `(workflowId, edgeId)` conflict identity and sets current edge fields on conflict.

- [ ] **Step 4: Verify GREEN**

Run the same targeted test. Expected: all normalization invariants PASS.

- [ ] **Step 5: Commit the focused helper**

```bash
git add apps/web/src/lib/projects/canvas-bulk-persistence.ts apps/web/src/lib/projects/canvas-bulk-persistence.test.ts
git commit -m "perf: add bulk canvas persistence helpers"
```

## Task 3: Integrate server modes and bulk writes

**Files:**
- Modify: `apps/web/src/app/api/projects/[projectId]/canvas/route.ts`
- Create: `scripts/canvas-incremental-save-static.test.mjs`

- [ ] **Step 1: Write a failing static route contract**

Assert that the route validates `saveMode` as either `full` or `incremental`; calls the two bulk-upsert builders; executes returned tagged SQL through `db.$executeRaw`; keeps `canvasWorkflow.updateMany` version reservation; and no longer contains `db.canvasNode.upsert` or `db.canvasEdge.upsert`.

- [ ] **Step 2: Verify RED**

```bash
cd /Users/aaron/creator-city
node --test scripts/canvas-incremental-save-static.test.mjs
```

Expected: FAIL because the route still contains per-entity Prisma upserts.

- [ ] **Step 3: Replace per-entity persistence without changing request safety**

1. Import the four persistence helpers.
2. Add `saveMode?: 'full' | 'incremental'` to the parsed body and reject other values with `VALIDATION_FAILED`.
3. Keep payload limits and empty full-snapshot protection, but allow empty incremental entity lists to reserve/update the workflow and return success.
4. After workflow reservation, prepare node rows and execute one bulk statement when non-empty; preserve `CANVAS_PARTIAL_SAVE` and timeout semantics if preparation or execution fails.
5. Prepare and execute one edge bulk statement when non-empty with the same failure semantics.
6. Leave deletion order, access checks, error classification, and best-effort `lastOpenedAt` untouched.

```ts
const nodeStatement = buildCanvasNodeBulkUpsert(prepareCanvasNodeRows({
  workflowId: workflow.id, projectId: params.projectId, now, nodes: validNodes,
}))
if (nodeStatement) await db.$executeRaw(nodeStatement)
```

- [ ] **Step 4: Verify GREEN**

```bash
node --test scripts/canvas-incremental-save-static.test.mjs
node --test scripts/canvas-save-integrity-static.test.mjs
```

Expected: both PASS.

- [ ] **Step 5: Commit the server integration**

```bash
git add apps/web/src/app/api/projects/[projectId]/canvas/route.ts scripts/canvas-incremental-save-static.test.mjs
git commit -m "perf: batch canvas save upserts"
```

## Task 4: Integrate client dirty tracking and incremental saves

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `scripts/canvas-incremental-save-static.test.mjs`

- [ ] **Step 1: Extend the static test before implementation**

Assert that the workspace imports `buildCanvasEntitySavePayload` and `collectChangedEntityIds`; owns dirty node and edge refs; derives changed IDs in both `commitNodes` and `commitEdges`; sends `saveMode`; and removes saved dirty IDs only after `canvasSaveFailure` returns null.

- [ ] **Step 2: Verify RED**

```bash
cd /Users/aaron/creator-city
node --test scripts/canvas-incremental-save-static.test.mjs
```

Expected: FAIL because the workspace currently sends every snapshot entity.

- [ ] **Step 3: Implement central dirty tracking**

1. Add `dirtyNodeIdsRef`, `dirtyEdgeIdsRef`, and `forceFullCanvasSaveRef` adjacent to deletion/save refs.
2. In `commitNodes` and `commitEdges`, add identities from `collectChangedEntityIds` before publishing React state.
3. Clear dirty sets after applying a clean server snapshot. When a local-only recovery snapshot lacks a reliable server baseline, set `forceFullCanvasSaveRef.current = true`.
4. In `saveCanvas`, use `buildCanvasEntitySavePayload` and send its `saveMode`, selected nodes, and selected edges with existing viewport, workflow identity, deletion queues, and `baseUpdatedAt`.
5. On acknowledgement only, remove just IDs submitted by that request from dirty sets, clear acknowledged deletion queues, and clear `forceFullCanvasSaveRef` after a full acknowledgement. Never clear later changes that arrived while the request was in flight.
6. Update direct PUT callers: draft restore is full; shot-sequence metadata persistence uses the same selection helper so it does not rewrite unrelated canvas entities.
7. Preserve local-only scheduling, 401 emergency drafts, retry coalescing, and conflict behavior.

- [ ] **Step 4: Verify GREEN**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test src/lib/canvas/canvasIncrementalSave.test.ts
cd /Users/aaron/creator-city
node --test scripts/canvas-incremental-save-static.test.mjs
node --test scripts/canvas-save-integrity-static.test.mjs
node --test scripts/canvas-performance-request-storm-static.test.mjs
```

Expected: all pass.

- [ ] **Step 5: Commit client integration**

```bash
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx scripts/canvas-incremental-save-static.test.mjs
git commit -m "perf: send incremental canvas saves"
```

## Task 5: Run full regression and boundary verification

**Files:**
- Modify only if needed to correct a verified test failure from Tasks 1–4.

- [ ] **Step 1: Run focused tests**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test src/lib/canvas/canvasIncrementalSave.test.ts src/lib/projects/canvas-bulk-persistence.test.ts src/lib/canvas/canvasSaveIntegrity.test.ts
cd /Users/aaron/creator-city
node --test scripts/canvas-incremental-save-static.test.mjs scripts/canvas-save-integrity-static.test.mjs scripts/canvas-performance-request-storm-static.test.mjs
```

- [ ] **Step 2: Run repository gates**

```bash
cd /Users/aaron/creator-city
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

- [ ] **Step 3: Enforce scope boundaries**

```bash
git diff --name-only bdd8ae7..HEAD
git status --short
```

Expected runtime files are limited to canvas save route, workspace, and new persistence helpers/tests. The diff must not include schema/migrations, env files, payment/credits/wallet/billing, Provider/BYOK, generation routes, cn-executor, package files, or `next.config.js`.

## Task 6: Browser QA, production rollout, and documentation

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Local/Preview browser QA**

Use an isolated QA project and verify 20/50/100 nodes, first cloud save, unchanged repeat save, one-node move, node/edge delete, refresh/reopen, and stale second-tab conflict. Record first and repeat timings separately. Do not invoke Provider/generation, payment, credit, or wallet routes.

- [ ] **Step 2: Commit and deploy implementation**

```bash
git log --oneline -8
git push origin main
```

Wait for matching Vercel Production Ready. Do not push or deploy without explicit Founder confirmation.

- [ ] **Step 3: Authenticated Production QA**

Repeat isolated-project save/reload checks. Confirm no product console errors and no unexpected Provider/generation/payment/credit/wallet requests. Classify browser control and resource-timing limits separately from product defects.

- [ ] **Step 4: Close task documentation**

Record commits, test results, save timing evidence, deployment SHA, remaining limitations, and forbidden-boundary confirmation. Commit and push documentation only after explicit Founder confirmation.
