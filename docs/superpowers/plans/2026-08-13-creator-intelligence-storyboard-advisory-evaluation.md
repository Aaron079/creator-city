# Creator Intelligence Storyboard Advisory Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned, deterministic, fully local evaluation gate for the existing Storyboard Director local-advisory evaluator.

**Architecture:** Owned synthetic Recipe fixtures represent positive, negative, and decision-scope cases. A separate test derives aggregate results from the production evaluator and fails closed on any mismatch, invented evidence id, unstable identity, nonlocal receipt, or stale decision. The existing advisory behavior and local cinematic pack are not changed.

**Tech Stack:** TypeScript, Node test runner through `tsx`, existing Recipe V3 types, existing local advisory evaluator and AST boundary test.

---

## File Map

- Create: `apps/web/src/lib/storyboard/recipe/advisoryEvaluation.fixtures.ts` — synthetic owned Recipe V3 fixture factory and eight named case definitions.
- Create: `apps/web/src/lib/storyboard/recipe/advisoryEvaluation.test.ts` — pure evaluator contract, aggregate accounting, evidence and identity assertions.
- Modify: `scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs` — include the new evaluation production modules in its local-only AST boundary scope.
- Modify: `docs/CURRENT_STATUS.md`, `docs/NEXT_TASKS.md` — observed results only after implementation verification and deployment.

## Task 1: Create Owned Evaluation Fixtures

**Files:**
- Create: `apps/web/src/lib/storyboard/recipe/advisoryEvaluation.fixtures.ts`
- Create: `apps/web/src/lib/storyboard/recipe/advisoryEvaluation.test.ts`

- [ ] **Step 1: Add a red fixture-import test**

In `advisoryEvaluation.test.ts`, import the missing fixture API and add:

```ts
import {
  STORYBOARD_ADVISORY_EVALUATION_CASES,
  allApprovedEvidenceIds,
} from './advisoryEvaluation.fixtures'

test('defines the owned advisory evaluation case matrix', () => {
  assert.deepEqual(
    STORYBOARD_ADVISORY_EVALUATION_CASES.map((item) => item.caseId),
    [
      'all-signals',
      'narrative-only',
      'composition-only',
      'continuity-only',
      'lighting-only',
      'no-approved-stages',
      'no-real-evidence',
      'decision-scope-change',
    ],
  )
  assert.equal(allApprovedEvidenceIds(STORYBOARD_ADVISORY_EVALUATION_CASES[0]!.recipe).size > 0, true)
})
```

- [ ] **Step 2: Verify the test is red**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisoryEvaluation.test.ts
```

Expected: FAIL because `advisoryEvaluation.fixtures.ts` does not exist.

- [ ] **Step 3: Implement a compact, deterministic fixture factory**

Create `advisoryEvaluation.fixtures.ts` with exported types and a factory that produces complete Recipe V3 records only from synthetic strings:

```ts
export type StoryboardAdvisoryEvaluationCase = {
  caseId:
    | 'all-signals'
    | 'narrative-only'
    | 'composition-only'
    | 'continuity-only'
    | 'lighting-only'
    | 'no-approved-stages'
    | 'no-real-evidence'
    | 'decision-scope-change'
  recipe: StoryboardDirectorRecipe
  expectedCodes: readonly string[]
  expectedSilence: boolean
}

export function allApprovedEvidenceIds(recipe: StoryboardDirectorRecipe): ReadonlySet<string> {
  return new Set([
    ...(recipe.scene.result?.evidence ?? []),
    ...(recipe.beat.result?.evidence ?? []),
    ...(recipe.shot.result?.evidence ?? []),
  ].map((item) => item.evidenceId))
}
```

Use a single private `recipeFor(options)` helper with fixed source id, timestamps,
and synthetic scene/beat/shot result evidence. Define the cases in the exact
order required by the design:

```ts
export const STORYBOARD_ADVISORY_EVALUATION_CASES = Object.freeze([
  evaluationCase('all-signals', recipeFor({
    reactionOrTurn: true, multipleCharacters: true, consecutiveShots: 2,
    location: 'STUDIO', timeOfDay: 'NIGHT', evidence: true,
  }), ['LOCAL_NARRATIVE_PURPOSE_REVIEW', 'LOCAL_COMPOSITION_HIERARCHY_REVIEW', 'LOCAL_CONTINUITY_CONFIRMATION', 'LOCAL_LIGHTING_MOTIVATION_REVIEW']),
  evaluationCase('narrative-only', recipeFor({ reactionOrTurn: true, consecutiveShots: 1, evidence: true }), ['LOCAL_NARRATIVE_PURPOSE_REVIEW']),
  evaluationCase('composition-only', recipeFor({ multipleCharacters: true, consecutiveShots: 1, evidence: true }), ['LOCAL_COMPOSITION_HIERARCHY_REVIEW']),
  evaluationCase('continuity-only', recipeFor({ consecutiveShots: 2, evidence: true }), ['LOCAL_CONTINUITY_CONFIRMATION']),
  evaluationCase('lighting-only', recipeFor({ consecutiveShots: 1, location: 'STUDIO', timeOfDay: 'NIGHT', evidence: true }), ['LOCAL_LIGHTING_MOTIVATION_REVIEW']),
  evaluationCase('no-approved-stages', recipeFor({ reactionOrTurn: true, multipleCharacters: true, consecutiveShots: 2, location: 'STUDIO', timeOfDay: 'NIGHT', evidence: true, approved: false }), []),
  evaluationCase('no-real-evidence', recipeFor({ reactionOrTurn: true, multipleCharacters: true, consecutiveShots: 2, location: 'STUDIO', timeOfDay: 'NIGHT', evidence: false }), []),
  evaluationCase('decision-scope-change', recipeFor({ reactionOrTurn: true, consecutiveShots: 1, evidence: true }), ['LOCAL_NARRATIVE_PURPOSE_REVIEW']),
] satisfies readonly StoryboardAdvisoryEvaluationCase[])
```

`recipeFor` must keep unrelated signals absent, use approved stage status only
when `approved` is true, and attach evidence only when `evidence` is true.
It must not import React, Canvas code, route code, persistence mutations,
networking, filesystem runtime APIs, environment access, Provider/BYOK,
generation, billing, payment, credits, Prisma, or executors.

- [ ] **Step 4: Verify the fixture contract is green**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisoryEvaluation.test.ts
```

Expected: PASS for the eight stable fixture case ids and owned evidence set.

- [ ] **Step 5: Commit fixtures**

```bash
git add apps/web/src/lib/storyboard/recipe/advisoryEvaluation.fixtures.ts apps/web/src/lib/storyboard/recipe/advisoryEvaluation.test.ts
git diff --cached --check
git commit -m "test: add storyboard advisory evaluation fixtures"
```

## Task 2: Enforce Advisory Evaluation Quality Gates

**Files:**
- Modify: `apps/web/src/lib/storyboard/recipe/advisoryEvaluation.test.ts`

- [ ] **Step 1: Add red exact-match and aggregate expectations**

Add a table-driven test that calls the production evaluator, not copied rule
logic:

```ts
test('matches every local advisory evaluation case exactly', () => {
  const aggregate = {
    caseCount: 0,
    expectedFindingCount: 0,
    emittedFindingCount: 0,
    exactMatchCount: 0,
    silenceMatchCount: 0,
    decisionInvalidationCount: 0,
  }

  for (const item of STORYBOARD_ADVISORY_EVALUATION_CASES) {
    const result = evaluateStoryboardDirectorAdvisories(item.recipe)
    const codes = result.findings.map((finding) => finding.code)
    assert.deepEqual(codes, item.expectedCodes, item.caseId)
    aggregate.caseCount += 1
    aggregate.expectedFindingCount += item.expectedCodes.length
    aggregate.emittedFindingCount += result.findings.length
    aggregate.exactMatchCount += 1
    if (item.expectedSilence) aggregate.silenceMatchCount += 1
  }

  assert.deepEqual(aggregate, {
    caseCount: 8,
    expectedFindingCount: 8,
    emittedFindingCount: 8,
    exactMatchCount: 8,
    silenceMatchCount: 2,
    decisionInvalidationCount: 0,
  })
})
```

Also add an initially failing decision-scope assertion that seeds the first
finding with `ignored`, changes `sourceFingerprint`, re-evaluates, and expects
`handling === 'open'` with the aggregate counter incremented to one.

- [ ] **Step 2: Verify red behavior**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisoryEvaluation.test.ts
```

Expected: FAIL until fixture cases and expected totals correctly match the
current evaluator output and decision-scope test is implemented.

- [ ] **Step 3: Add exact evidence, identity, local-receipt, and decision checks**

For every emitted finding, assert:

```ts
assert.equal(finding.severity, 'advisory')
assert.match(finding.findingId, /^sdrf1_[0-9a-f]{8}$/)
assert.ok(finding.advisory)
assert.match(finding.advisory.inputFingerprint, /^sdra1_[0-9a-f]{8}$/)
assert.match(finding.advisory.selectionFingerprint, /^ckr1_[0-9a-f]{8}$/)
assert.ok(finding.advisory.ruleIds.length > 0)
assert.ok(finding.evidenceIds.length > 0)
assert.ok(finding.evidenceIds.every((id) => allApprovedEvidenceIds(item.recipe).has(id)))
```

Evaluate every case twice and assert deep equality so a changed run timestamp
or order cannot silently alter output. For `decision-scope-change`, seed the
exact ignored tuple, prove it is ignored before source change, clone the Recipe
with a different `sourceFingerprint`, and prove the same advisory is `open`.
Increment `decisionInvalidationCount` only after that assertion succeeds.

Use the final exact aggregate contract:

```ts
{
  caseCount: 8,
  expectedFindingCount: 8,
  emittedFindingCount: 8,
  exactMatchCount: 8,
  silenceMatchCount: 2,
  decisionInvalidationCount: 1,
}
```

- [ ] **Step 4: Verify the evaluation gate is green**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisoryEvaluation.test.ts src/lib/storyboard/recipe/advisory.test.ts src/lib/storyboard/recipe/intelligence.test.ts
```

Expected: all cases pass; eight emitted expected findings, two exact silence
matches, one scoped decision invalidation, and no behavior change in legacy
intelligence tests.

- [ ] **Step 5: Commit the quality gate**

```bash
git add apps/web/src/lib/storyboard/recipe/advisoryEvaluation.test.ts
git diff --cached --check
git commit -m "test: gate storyboard advisory quality"
```

## Task 3: Protect Evaluation Boundaries and Deliver

**Files:**
- Modify: `scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs`
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Add a red AST boundary case for evaluation modules**

Extend the script's exact source list with:

```js
'apps/web/src/lib/storyboard/recipe/advisoryEvaluation.fixtures.ts',
'apps/web/src/lib/storyboard/recipe/advisoryEvaluation.test.ts',
```

Keep the existing AST import/call analysis. The fixture module remains subject
to the same forbidden import and call boundaries; do not scan test descriptions
as raw strings.

- [ ] **Step 2: Verify the boundary is red before the source list update**

Run:

```bash
node --test scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs
```

Expected: the prior source list does not include the evaluation fixture; add a
focused assertion of source-list membership first so this is a real red state.

- [ ] **Step 3: Implement the source-list membership assertion and update the list**

Add:

```js
test('Storyboard advisory evaluation fixtures remain inside the local boundary', () => {
  assert.ok(SOURCES.includes('apps/web/src/lib/storyboard/recipe/advisoryEvaluation.fixtures.ts'))
  assert.ok(SOURCES.includes('apps/web/src/lib/storyboard/recipe/advisoryEvaluation.test.ts'))
})
```

Keep forbidden AST checks for Provider paths, generation, billing/payment/
credits/wallet, Prisma/schema, environment, crawler/external-model/executor,
and network APIs. No production source module should become more permissive.

- [ ] **Step 4: Run targeted and repository gates**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisoryEvaluation.test.ts src/lib/storyboard/recipe/advisory.test.ts src/lib/storyboard/recipe/intelligence.test.ts src/lib/storyboard/recipe/recipePersistence.test.ts src/lib/storyboard/recipe/stateMachine.test.ts src/components/create/StoryboardDirectorPanel.test.tsx
node --test scripts/creator-intelligence-knowledge-boundary.test.mjs scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check || node scripts/agent-loop-check.mjs
git diff --check
```

Expected: all pass. Existing lint warnings may remain only if the command exits
zero and the warnings do not originate in this evaluation change.

- [ ] **Step 5: Update status documents only from observed results**

Record the exact commit ids, case and finding totals, boundary result, and the
fact that the suite is offline/owned/local. Do not claim Preview or Production
evaluation execution, browser QA, model quality, user-data reads, crawler
coverage, or external model behavior.

- [ ] **Step 6: Commit and deliver locally**

```bash
git add scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: record storyboard advisory evaluation"
```

Push `main` and wait for Vercel Production only after the user explicitly says
`确认推送部署` during this implementation session. Then verify local and remote
SHA equality, Vercel Ready, root 200, unauthenticated `/create` login redirect,
and a clean worktree.

## Plan Self-Review

- Spec coverage: Task 1 supplies all eight owned cases; Task 2 tests exact
  outputs, silence, evidence, receipt/identity, determinism, and scoped
  decision invalidation; Task 3 makes the evaluation files subject to the
  local-only AST boundary and verifies delivery gates.
- Placeholder scan: no unfinished markers or unspecified error handling.
- Type consistency: `StoryboardAdvisoryEvaluationCase`,
  `STORYBOARD_ADVISORY_EVALUATION_CASES`, and `allApprovedEvidenceIds` are
  introduced in Task 1 and used unchanged by later tasks.
