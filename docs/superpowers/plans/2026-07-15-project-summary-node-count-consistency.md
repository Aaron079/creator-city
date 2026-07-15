# Project Summary Node Count Consistency Implementation Plan

> **For agentic workers:** Execute this plan inline with test-driven development. Keep the approved safe owned-project query and do not expand scope.

**Goal:** Make `/projects` and `/dashboard` report the persisted Canvas node count consistently with the project overview.

**Architecture:** Preserve the resilient owned-project list query, then issue one isolated batched `CanvasWorkflow.findMany` count query for all returned workflow IDs. Convert those rows to a map and sum counts per project during serialization. If the auxiliary count query fails, return the project list with zero fallback counts and a warning instead of failing the page.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 5, Node test runner, `tsx`.

---

## Task 1: Add node-count aggregation helpers with tests

**Files:**
- Create: `apps/web/src/lib/projects/project-summary.test.ts`
- Create: `apps/web/src/lib/projects/project-summary.ts`

1. Write tests for one workflow, multiple workflows, zero counts, no workflows, and missing rows.
2. Run `cd apps/web && node_modules/.bin/tsx --test src/lib/projects/project-summary.test.ts` and record the expected module-not-found failure.
3. Implement `toWorkflowNodeCountMap` and `countProjectWorkflowNodes` as pure functions.
4. Re-run the targeted test and require all cases to pass.

The helper implementation should use this contract:

```ts
export type WorkflowNodeCountRow = {
  id: string
  _count: { nodes: number }
}

export function toWorkflowNodeCountMap(
  rows: readonly WorkflowNodeCountRow[],
): Map<string, number> {
  return new Map(rows.map((row) => [row.id, row._count.nodes]))
}

export function countProjectWorkflowNodes(
  workflows: readonly { id: string }[],
  counts: ReadonlyMap<string, number>,
): number {
  return workflows.reduce(
    (total, workflow) => total + (counts.get(workflow.id) ?? 0),
    0,
  )
}
```

## Task 2: Add a static regression test for the route contract

**Files:**
- Create: `scripts/project-summary-node-count-static.test.mjs`

1. Assert the owned-project route imports and calls `countProjectWorkflowNodes`.
2. Assert it performs one batched `CanvasWorkflow.findMany` query using `id: { in: workflowIds }` and selects `_count.nodes`.
3. Assert the auxiliary query has the `node_count_query` warning fallback.
4. Assert the normal owned-project serialization no longer contains `nodeCount: 0`.
5. Run `node --test scripts/project-summary-node-count-static.test.mjs` and record the expected failure before changing the route.

## Task 3: Wire batched counts into the owned-project route

**Files:**
- Modify: `apps/web/src/app/api/projects/route.ts`

1. Import the two aggregation helpers.
2. After the safe owned-project query, collect all `canvasWorkflows[].id` values.
3. When the list is non-empty, call `db.canvasWorkflow.findMany` once with:

```ts
where: { id: { in: workflowIds } },
select: {
  id: true,
  _count: { select: { nodes: true } },
},
```

4. Convert the result to a workflow-count map and set each serialized project's `nodeCount` using `countProjectWorkflowNodes`.
5. Catch only the auxiliary count-query failure, append a `node_count_query` warning, and preserve the list response with zero fallback counts.
6. Leave `assetCount`, list filtering, sort behavior, pagination, and all other response fields unchanged.
7. Run both targeted tests and require them to pass.

## Task 4: Run repository quality gates and boundary checks

1. Run `pnpm type-check`.
2. Run `pnpm lint`; classify only existing warnings as non-blocking.
3. Run `pnpm build`.
4. Run `git diff --check`.
5. Inspect `git diff --name-only` and require no changes to Prisma/schema/migrations, env, payment, credits, wallet, billing, Provider adapters, BYOK semantics, generation routes, `cn-executor`, `package.json`, `pnpm-lock.yaml`, or `next.config.js`.
6. Review the complete diff for unintended response-contract changes.

## Task 5: Commit, push, and verify production

1. Commit the implementation and tests with `fix: report project node counts consistently`.
2. Push `main` to `origin`.
3. Wait for the corresponding Vercel Production deployment to become Ready.
4. In the authenticated Chrome production session, verify:
   - `/projects` reports one node for the existing QA project.
   - `/dashboard` reports the same one-node count.
   - The project overview remains one node.
   - Refreshing each page preserves the count.
   - No new product console errors, API 5xx responses, duplicate requests, generation calls, Provider calls, or payment mutations occur.
5. Finalize the Chrome session with the production tab kept open.

## Task 6: Close documentation and deployment

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

1. Record `P1-PROJECT-SUMMARY-NODE-COUNT-CONSISTENCY` as production validated and closed.
2. Record implementation scope, tests, production evidence, and unchanged forbidden boundaries.
3. Commit only the documentation with `docs: close project node count consistency`.
4. Push `main`, wait for Vercel Production Ready, and confirm local `main`, `origin/main`, and the deployment SHA agree.
5. Run `git status --short` and require a clean worktree.
