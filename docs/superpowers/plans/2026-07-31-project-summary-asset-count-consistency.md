# Project Summary Asset Count Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/projects` and `/dashboard` use the same current-user direct-Asset count as `/assets`, without duplicate counts from `ProjectAsset` associations.

**Architecture:** Add a pure helper that maps Prisma direct-Asset `groupBy` rows to project counts. Update `GET /api/projects` to use one batched direct-Asset group query for each response path, including the recent-project fast path, while leaving the response shape unchanged and returning a warning plus zero counts if that non-critical lookup fails.

**Tech Stack:** Next.js route handlers, Prisma, TypeScript, Node built-in test runner, pnpm.

---

## File Structure

- Modify: `apps/web/src/lib/projects/project-summary.ts` -- typed direct-Asset count rows and map helper.
- Modify: `apps/web/src/lib/projects/project-summary.test.ts` -- pure direct-Asset count helper tests.
- Modify: `apps/web/src/app/api/projects/route.ts` -- batched canonical direct-Asset count lookup in every project-list response path.
- Create: `scripts/project-summary-asset-count-static.test.mjs` -- static route contract guarding against a return to hardcoded or overlapping asset counts.

### Task 1: Define the Direct-Asset Count Helper With Failing Tests

**Files:**
- Modify: `apps/web/src/lib/projects/project-summary.test.ts`
- Modify: `apps/web/src/lib/projects/project-summary.ts`

- [ ] **Step 1: Write the failing asset-count tests**

Extend the existing import from `./project-summary` with `countProjectAssets` and `toProjectAssetCountMap`, then add:

```ts
describe('project summary asset counts', () => {
  test('maps direct assets to their project', () => {
    const counts = toProjectAssetCountMap([
      { projectId: 'project-1', _count: { _all: 2 } },
    ])

    assert.equal(countProjectAssets('project-1', counts), 2)
  })

  test('keeps counts distinct across projects', () => {
    const counts = toProjectAssetCountMap([
      { projectId: 'project-1', _count: { _all: 1 } },
      { projectId: 'project-2', _count: { _all: 3 } },
    ])

    assert.equal(countProjectAssets('project-1', counts), 1)
    assert.equal(countProjectAssets('project-2', counts), 3)
  })

  test('treats a missing project count as zero', () => {
    assert.equal(countProjectAssets('project-missing', new Map()), 0)
  })

  test('ignores unbound direct assets', () => {
    const counts = toProjectAssetCountMap([
      { projectId: null, _count: { _all: 9 } },
      { projectId: 'project-1', _count: { _all: 1 } },
    ])

    assert.equal(countProjectAssets('project-1', counts), 1)
    assert.equal(counts.has('null'), false)
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/projects/project-summary.test.ts
```

Expected: FAIL because `toProjectAssetCountMap` and `countProjectAssets` are not exported.

- [ ] **Step 3: Implement the minimal pure helper**

Append this to `apps/web/src/lib/projects/project-summary.ts`:

```ts
export type ProjectAssetCountRow = {
  projectId: string | null
  _count: { _all: number }
}

export function toProjectAssetCountMap(
  rows: readonly ProjectAssetCountRow[],
): Map<string, number> {
  return new Map(
    rows.flatMap((row) => (
      row.projectId === null ? [] : [[row.projectId, row._count._all] as const]
    )),
  )
}

export function countProjectAssets(
  projectId: string,
  counts: ReadonlyMap<string, number>,
): number {
  return counts.get(projectId) ?? 0
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/projects/project-summary.test.ts
```

Expected: PASS for all node-count and asset-count tests.

- [ ] **Step 5: Commit the helper and tests**

```bash
git add apps/web/src/lib/projects/project-summary.ts apps/web/src/lib/projects/project-summary.test.ts
git commit -m "test: define project asset count semantics"
```

### Task 2: Use One Canonical Direct-Asset Lookup Per Project Response

**Files:**
- Modify: `apps/web/src/app/api/projects/route.ts`
- Modify: `apps/web/src/lib/projects/project-summary.ts`

- [ ] **Step 1: Add a reusable count lookup beside the route constants**

Import `countProjectAssets` and `toProjectAssetCountMap` from
`@/lib/projects/project-summary`, then add:

```ts
async function loadProjectAssetCounts(userId: string, projectIds: readonly string[]) {
  if (projectIds.length === 0) return new Map<string, number>()

  const rows = await db.asset.groupBy({
    by: ['projectId'],
    where: {
      ownerId: userId,
      projectId: { in: [...projectIds] },
    },
    _count: { _all: true },
  })

  return toProjectAssetCountMap(rows)
}
```

- [ ] **Step 2: Replace the recent-project overlapping relation count**

In the `limit === 1 && sort === 'lastOpenedAt'` branch, after loading the project,
initialize an empty map and catch a non-critical lookup failure:

```ts
let assetCounts = new Map<string, number>()
let assetCountWarning: string | undefined
try {
  assetCounts = await loadProjectAssetCounts(
    user.id,
    project ? [project.id] : [],
  )
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  console.warn('[projects] asset count query failed', { userId: user.id, error })
  assetCountWarning = `asset_count_query: ${msg}`
}
```

Serialize its count with:

```ts
assetCount: countProjectAssets(project.id, assetCounts),
```

Remove `_count.generatedAssets` and `_count.assets` from `projectSelect()`
and remove the old relation-summing helper.

Include `warnings: [assetCountWarning]` in that fast-path response only when the
warning is defined, so the recent project still returns with a zero fallback.

- [ ] **Step 3: Add resilient owned-project asset counting**

After the owned branch's workflow count query, add:

```ts
let assetCounts = new Map<string, number>()
if (ownedProjects.length > 0) {
  try {
    assetCounts = await loadProjectAssetCounts(
      user.id,
      ownedProjects.map((project) => project.id),
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('[projects] asset count query failed', { userId: user.id, error })
    warnings.push(`asset_count_query: ${msg}`)
  }
}
```

Replace the owned serializer's hardcoded count with:

```ts
assetCount: countProjectAssets(project.id, assetCounts),
```

- [ ] **Step 4: Add resilient mixed owned/member project counting**

After building and sorting the de-duplicated project collection, wrap the same
`loadProjectAssetCounts(user.id, projectIds)` call in a `try/catch`. On failure,
retain an empty map and append `asset_count_query` to the existing response warning
field without changing `membershipWarning` behavior. Use:

```ts
assetCount: countProjectAssets(project.id, assetCounts),
```

for every mixed-list serialization row. Direct assets owned by other members are
intentionally excluded because `/api/assets` is current-user scoped.

- [ ] **Step 5: Run TypeScript and focused helper tests**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/projects/project-summary.test.ts
pnpm type-check
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the route implementation**

```bash
git add apps/web/src/app/api/projects/route.ts apps/web/src/lib/projects/project-summary.ts
git commit -m "fix: align project asset counts with asset library"
```

### Task 3: Protect the Route Contract and Verify the Read-Only UI

**Files:**
- Create: `scripts/project-summary-asset-count-static.test.mjs`

- [ ] **Step 1: Write the static route contract**

Create `scripts/project-summary-asset-count-static.test.mjs` with Node's test
runner. Read `apps/web/src/app/api/projects/route.ts`, then assert all of:

```js
assert.match(source, /db\.asset\.groupBy\(/)
assert.match(source, /toProjectAssetCountMap/)
assert.match(source, /assetCount:\s*countProjectAssets\(project\.id, assetCounts\)/)
assert.doesNotMatch(source, /assetCount:\s*0/)
assert.doesNotMatch(source, /generatedAssets:\s*true, assets:\s*true/)
```

Use clear test names for canonical direct-Asset grouping and removal of the
owned-list hardcode.

- [ ] **Step 2: Run all asset-count focused tests**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/projects/project-summary.test.ts
node --test scripts/project-summary-asset-count-static.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run full required local verification**

Run:

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

Expected: commands exit 0. Record pre-existing non-failing lint warnings
separately from new errors.

- [ ] **Step 4: Perform authenticated browser QA without mutations**

In the existing authenticated browser session:

1. Open `/projects`, record the existing project's visible asset count.
2. Open `/dashboard`, record the same project's recent-card asset count.
3. Open `/assets` filtered to that existing project, record the list count.
4. Refresh each page once and confirm values remain equal.

Do not create, upload, edit, generate, delete, or save any project or asset.
Classify missing authenticated browser instrumentation as a QA harness limitation,
not a product PASS.

- [ ] **Step 5: Commit, push, deploy, and verify production**

```bash
git add scripts/project-summary-asset-count-static.test.mjs
git commit -m "test: guard project asset count consistency"
git push origin main
```

Wait for the deployment containing the implementation commit to become Ready.
Repeat the same read-only production browser comparison and report any mismatch
as a P1 issue.

- [ ] **Step 6: Update project status documentation in a separate commit**

Update `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` only after local and
production evidence is recorded. State the canonical direct-Asset definition,
the deployment SHA, browser QA result, and any remaining harness limitations.

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: record project asset count consistency"
git push origin main
```

## Self-Review

- Spec coverage: Tasks 1-2 implement the direct-Asset definition, all three route
  paths, one batched lookup, and warning-based degradation. Task 3 covers regression
  protection, local checks, read-only browser QA, deployment, and status documentation.
- Placeholder scan: no unresolved implementation placeholders or unspecified validation steps remain.
- Type consistency: `ProjectAssetCountRow`, `toProjectAssetCountMap`, and
  `countProjectAssets` are introduced in Task 1 and used with the same names in
  Tasks 2-3. The route's `assetCounts` map is always a `Map<string, number>`.
