# Creator Intelligence Script-to-Storyboard Advisory B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, evidence-backed local professional advisories to the existing Storyboard Director Recipe without blocking existing workflow actions or adding external generation.

**Architecture:** A pure Recipe advisory evaluator resolves only the approved local cinematic knowledge pack and returns stable advisory findings with rule IDs and `ckr1_` selection receipts. Recipe schema V3 persists only creator review/ignore decisions; current applicability is derived from current Recipe input and knowledge receipt. The existing intelligence analyzer merges advisories, and the existing evidence inspector renders their controls.

**Tech Stack:** TypeScript, React/Next.js, Creator Skill fingerprints, Node tests through `tsx`, existing Recipe persistence and Canvas browser QA.

---

## File Map

- Create: `apps/web/src/lib/storyboard/recipe/advisory.ts` — pure rule selection, structured-evidence checks, stable IDs, handling state.
- Create: `apps/web/src/lib/storyboard/recipe/advisory.test.ts` — deterministic evaluator and applicability contracts.
- Modify: `apps/web/src/lib/storyboard/recipe/types.ts` — Recipe V3 and advisory data types.
- Modify: `apps/web/src/lib/storyboard/recipe/identity.ts` — input/decision fingerprints.
- Modify: `apps/web/src/lib/storyboard/recipe/persistence.ts` — V1/V2 compatibility and strict V3 validation.
- Modify: `apps/web/src/lib/storyboard/recipe/recipePersistence.test.ts` — compatibility and malformed-decision coverage.
- Modify: `apps/web/src/lib/storyboard/recipe/state-machine.ts` — reviewed, ignored, restore mutations.
- Modify: `apps/web/src/lib/storyboard/recipe/stateMachine.test.ts` — state mutation coverage.
- Modify: `apps/web/src/lib/storyboard/recipe/intelligence.ts` — non-blocking finding merge.
- Modify: `apps/web/src/lib/storyboard/recipe/intelligence.test.ts` — ordering and readiness regression.
- Modify: `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx` — existing evidence inspector UI only.
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.tsx` — linked shot focus wiring.
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.test.tsx` — rendered interaction coverage.
- Create: `scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs` — static forbidden-boundary test.
- Modify: `docs/CURRENT_STATUS.md`, `docs/NEXT_TASKS.md` — only after verified delivery.

## Task 1: Pure Local Advisory Contract

**Files:**
- Create: `apps/web/src/lib/storyboard/recipe/advisory.ts`
- Create: `apps/web/src/lib/storyboard/recipe/advisory.test.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/types.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/identity.ts`

- [ ] **Step 1: Write the failing evaluator tests**

```ts
test('evaluates local advisory families in stable order', () => {
  const result = evaluateStoryboardDirectorAdvisories(advisoryFixture())
  assert.deepEqual(result.findings.map((item) => item.code), [
    'LOCAL_NARRATIVE_PURPOSE_REVIEW',
    'LOCAL_COMPOSITION_HIERARCHY_REVIEW',
    'LOCAL_CONTINUITY_CONFIRMATION',
    'LOCAL_LIGHTING_MOTIVATION_REVIEW',
  ])
  assert(result.findings.every((item) => item.severity === 'advisory'))
  assert.match(result.receipt.selectionFingerprint, /^ckr1_[0-9a-f]{8}$/)
})

test('does not invent advisories without required structured evidence', () => {
  assert.deepEqual(evaluateStoryboardDirectorAdvisories(noSignalFixture()).findings, [])
})
```

- [ ] **Step 2: Verify the test is red**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisory.test.ts
```

Expected: FAIL because evaluator and advisory types do not yet exist.

- [ ] **Step 3: Define exact Recipe V3 contracts**

In `types.ts` set `STORYBOARD_DIRECTOR_RECIPE_VERSION = 3 as const`; add:

```ts
export type StoryboardDirectorAdvisoryHandling = 'open' | 'reviewed' | 'ignored'
export type StoryboardDirectorAdvisoryDecision = {
  advisoryId: string
  inputFingerprint: string
  selectionFingerprint: string
  decision: Exclude<StoryboardDirectorAdvisoryHandling, 'open'>
  decidedAt: string
}
export type StoryboardDirectorAdvisoryMetadata = {
  ruleIds: string[]
  inputFingerprint: string
  selectionFingerprint: string
  handling: StoryboardDirectorAdvisoryHandling
}
```

Extend `StoryboardDirectorFinding` with optional `advisory?: StoryboardDirectorAdvisoryMetadata` and `StoryboardDirectorRecipe` with `advisoryDecisions: StoryboardDirectorAdvisoryDecision[]`.

- [ ] **Step 4: Add stable advisory identity helpers**

In `identity.ts`, add `createStoryboardDirectorAdvisoryInputFingerprint(recipe, ruleIds, scope)` using `createCreatorSkillFingerprint('storyboard-director-advisory-input', '1.0.0', ...)` over `recipe.sourceFingerprint`, approved scene/beat/shot stages, ordered rule IDs, and scope. Prefix with `sdra1_`.

Add `createStoryboardDirectorAdvisoryId(inputFingerprint)` using `createCreatorSkillFingerprint('storyboard-director-advisory', '1.0.0', ...)` and prefix with `sdrf1_`.

- [ ] **Step 5: Implement a pure evaluator**

`advisory.ts` may import only Recipe types/identity helpers and `resolveLocalCinematicKnowledge`. Export:

```ts
export function evaluateStoryboardDirectorAdvisories(recipe: StoryboardDirectorRecipe): {
  findings: StoryboardDirectorFinding[]
  receipt: CreativeKnowledgeSelectionReceipt
}
export function advisoryHandlingFor(recipe: StoryboardDirectorRecipe, advisoryId: string, inputFingerprint: string, selectionFingerprint: string): StoryboardDirectorAdvisoryHandling
```

Use fixed output order: narrative purpose, composition rhythm/hierarchy, continuity confirmation, lighting motivation. Resolve `allowedUse: 'retrieval'` and only required capability domains. Every result has local rule IDs, `ckr1_` fingerprint, evidence IDs, and a stable `sdrf1_` finding ID. Continuity text must say `需要人工确认`; no family may state an error as fact absent approved structured evidence.

- [ ] **Step 6: Verify the evaluator is green**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisory.test.ts
```

Expected: PASS with deterministic order, local receipt, no-evidence silence, and advisory-only severity.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/web/src/lib/storyboard/recipe/types.ts apps/web/src/lib/storyboard/recipe/identity.ts apps/web/src/lib/storyboard/recipe/advisory.ts apps/web/src/lib/storyboard/recipe/advisory.test.ts
git diff --cached --check
git commit -m "feat: add storyboard local advisory contract"
```

## Task 2: Persist Reviewed, Ignored, and Restore Decisions

**Files:**
- Modify: `apps/web/src/lib/storyboard/recipe/persistence.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/recipePersistence.test.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/state-machine.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/stateMachine.test.ts`

- [ ] **Step 1: Write failing persistence and state tests**

```ts
test('upgrades V1 and V2 metadata to V3 with no advisory decisions', () => {
  const read = readStoryboardDirectorRecipe(v2RecipeMetadata())
  assert.equal(read.status, 'valid')
  if (read.status !== 'valid') throw new Error('expected valid')
  assert.equal(read.recipe.schemaVersion, 3)
  assert.deepEqual(read.recipe.advisoryDecisions, [])
})

test('review ignore restore changes only a matching advisory decision', () => {
  const reviewed = setStoryboardAdvisoryDecision(canonicalRecipe(), advisoryFixtureFinding(), 'reviewed', ISO_TIME)
  const ignored = setStoryboardAdvisoryDecision(reviewed, advisoryFixtureFinding(), 'ignored', ISO_TIME)
  const restored = restoreStoryboardAdvisory(ignored, advisoryFixtureFinding(), ISO_TIME)
  assert.equal(reviewed.advisoryDecisions[0]?.decision, 'reviewed')
  assert.equal(ignored.advisoryDecisions[0]?.decision, 'ignored')
  assert.deepEqual(restored.advisoryDecisions, [])
  assert.equal(restored.shot.status, 'approved')
})
```

- [ ] **Step 2: Verify the persistence tests are red**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/recipePersistence.test.ts src/lib/storyboard/recipe/stateMachine.test.ts
```

Expected: FAIL because V3, decision validation, and mutations are absent.

- [ ] **Step 3: Implement strict V3 persistence and compatibility**

Add `advisoryDecisions` to V3 required fields. `readStoryboardDirectorRecipe` must accept versions 1, 2, and 3; V1 upgrades with `sketchBoard: null, advisoryDecisions: []`, V2 upgrades with `advisoryDecisions: []`.

Validate each decision with exactly `advisoryId`, `inputFingerprint`, `selectionFingerprint`, `decision`, and `decidedAt`. Require identifiers, enum `reviewed | ignored`, valid ISO timestamp, no unknown/accessor/symbol fields, unique compound `(advisoryId,inputFingerprint,selectionFingerprint)`, and at most `STORYBOARD_DIRECTOR_MAX_RECEIPTS` entries. Reject persisted `open`.

- [ ] **Step 4: Implement state-machine actions**

Export:

```ts
export function setStoryboardAdvisoryDecision(recipe: StoryboardDirectorRecipe, advisory: Pick<StoryboardDirectorFinding, 'findingId' | 'advisory'>, decision: 'reviewed' | 'ignored', now: string): StoryboardDirectorRecipe
export function restoreStoryboardAdvisory(recipe: StoryboardDirectorRecipe, advisory: Pick<StoryboardDirectorFinding, 'findingId' | 'advisory'>, now: string): StoryboardDirectorRecipe
```

Require advisory metadata, replace only the matching decision tuple, preserve all stages/findings/storyboard/receipts/sketch board, update `audit.updatedAt`, and return the original object when already at requested state.

- [ ] **Step 5: Verify persistence and state behavior**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/recipePersistence.test.ts src/lib/storyboard/recipe/stateMachine.test.ts
```

Expected: PASS. Existing V1/V2 records load, malformed decisions fail closed, and advisory actions never stale stages.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/web/src/lib/storyboard/recipe/persistence.ts apps/web/src/lib/storyboard/recipe/recipePersistence.test.ts apps/web/src/lib/storyboard/recipe/state-machine.ts apps/web/src/lib/storyboard/recipe/stateMachine.test.ts
git diff --cached --check
git commit -m "feat: persist storyboard advisory decisions"
```

## Task 3: Merge Local Advisories into Recipe Intelligence

**Files:**
- Modify: `apps/web/src/lib/storyboard/recipe/intelligence.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/intelligence.test.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/advisory.test.ts`

- [ ] **Step 1: Write failing integration regression**

```ts
test('keeps blockers ahead of local advisories and leaves advisory-only Recipes ready', () => {
  const local = analyzeStoryboardDirectorRecipe(advisoryFixture())
  assert(local.some((item) => item.code === 'LOCAL_CONTINUITY_CONFIRMATION'))
  assert.equal(isStoryboardRecipeMaterializationReady(advisoryFixture()), true)

  const blocked = analyzeStoryboardDirectorRecipe(corruptLineageRecipe())
  assert.equal(blocked[0]?.severity, 'blocking')
  assert.equal(isStoryboardRecipeMaterializationReady(corruptLineageRecipe()), false)
})

test('attaches rule IDs and a local receipt to every local advisory', () => {
  const local = analyzeStoryboardDirectorRecipe(advisoryFixture()).filter((item) => item.advisory)
  assert(local.length > 0)
  assert(local.every((item) => item.advisory?.ruleIds.length))
  assert(local.every((item) => /^ckr1_/.test(item.advisory?.selectionFingerprint ?? '')))
})
```

- [ ] **Step 2: Verify integration is red**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/intelligence.test.ts src/lib/storyboard/recipe/advisory.test.ts
```

Expected: FAIL because current analyzer does not merge local advisory output.

- [ ] **Step 3: Merge without changing blocker semantics**

In `intelligence.ts`, compute local advisories and retain this order:

```ts
const localAdvisories = evaluateStoryboardDirectorAdvisories(recipe).findings
const values = [
  ...blockingFindings(recipe),
  ...advisoryFindings(recipe),
  ...localAdvisories,
]
```

Keep persisted partial-batch blockers first. Extend deduplication identity with `finding.advisory?.inputFingerprint ?? ''`. Do not persist recomputed local findings in `recipe.findings`. `isStoryboardRecipeMaterializationReady` must continue to inspect only `severity === 'blocking'`.

- [ ] **Step 4: Verify intelligence regression**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/intelligence.test.ts src/lib/storyboard/recipe/advisory.test.ts
```

Expected: PASS. Existing blocker/legacy advisory behavior is unchanged and local advisory-only Recipes stay materialization-ready.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/web/src/lib/storyboard/recipe/intelligence.ts apps/web/src/lib/storyboard/recipe/intelligence.test.ts apps/web/src/lib/storyboard/recipe/advisory.test.ts
git diff --cached --check
git commit -m "feat: advise storyboard reviews from local knowledge"
```

## Task 4: Render Controls in the Existing Evidence Inspector

**Files:**
- Modify: `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx`
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.tsx`
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.test.tsx`

- [ ] **Step 1: Write failing rendered interaction tests**

```tsx
test('renders local advisories with rule evidence and review controls', async () => {
  const page = await renderRecipePanel({ recipe: advisoryFixture() })
  await expect(page.getByText('建议审阅')).toBeVisible()
  await expect(page.getByRole('button', { name: '标记已审阅' })).toBeVisible()
  await expect(page.getByRole('button', { name: '忽略本条' })).toBeVisible()
  await expect(page.getByText(/本地已审核规则/)).toBeVisible()
  await expect(page.getByText(/ckr1_/)).toBeVisible()
})

test('restores an ignored advisory without changing a review stage', async () => {
  const page = await renderRecipePanel({ recipe: ignoredAdvisoryFixture() })
  await page.getByRole('button', { name: '已忽略建议' }).click()
  await page.getByRole('button', { name: '恢复提示' }).click()
  expect(lastCommittedRecipe().advisoryDecisions).toHaveLength(0)
  expect(lastCommittedRecipe().shot.status).toBe('approved')
})
```

- [ ] **Step 2: Verify the rendered test is red**

Run:

```bash
pnpm --filter web exec tsx --test src/components/create/StoryboardDirectorPanel.test.tsx
```

Expected: FAIL because advisory labels and controls do not exist.

- [ ] **Step 3: Implement compact in-place advisory UI**

In `RecipeEvidenceInspector`, split findings into blocking, regular advisory, visible local advisory, and ignored local advisory groups. Preserve `下一个问题` over visible groups only. Render local items under `建议审阅` in calm cyan/amber styling, never blocking red.

For a selected local advisory show:

```tsx
<p className="text-[9px] font-semibold text-cyan-100/70">本地已审核规则</p>
<p className="mt-1 text-[10px] text-white/58">{selected.advisory.ruleIds.join(' · ')}</p>
<p className="mt-1 font-mono text-[9px] text-white/32">{selected.advisory.selectionFingerprint}</p>
```

Use `onCommitRecipe(setStoryboardAdvisoryDecision(...))` for `标记已审阅` and `忽略本条`; use `restoreStoryboardAdvisory(...)` for `恢复提示`. Render `跳到关联镜头` only when `selected.shotId` exists. Thread optional `onFocusShot` from `StoryboardDirectorPanel` to the existing active-shot setter; do not create, move, edit, or select any different workflow surface.

- [ ] **Step 4: Verify Director panel regression**

Run:

```bash
pnpm --filter web exec tsx --test src/components/create/StoryboardDirectorPanel.test.tsx
```

Expected: PASS. Existing Recipe editor, stage controls, board controls, and modal sizing remain unchanged.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx apps/web/src/components/create/StoryboardDirectorPanel.tsx apps/web/src/components/create/StoryboardDirectorPanel.test.tsx
git diff --cached --check
git commit -m "feat: review storyboard local advisories"
```

## Task 5: Static Boundary and Safe Browser QA

**Files:**
- Create: `scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs`
- Modify: `apps/web/src/lib/storyboard/recipe/advisory.test.ts`
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.test.tsx`

- [ ] **Step 1: Add AST static boundary coverage**

Recursively scan only `advisory.ts` and direct integration files with TypeScript AST. Fail on imports for `billing`, `payment`, `credits`, `wallet`, `prisma`, `cn-executor`, Provider adapter paths, `/api/generate/`, `http`, `https`, `net`, `undici`; fail on `fetch`, `globalThis.fetch`, `axios`, and `process.env`.

Use this fetch check:

```js
if (ts.isCallExpression(node) && (
  (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') ||
  (ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && node.expression.expression.text === 'globalThis'
    && node.expression.name.text === 'fetch')
)) assert.fail(`${relativePath} must not call fetch`)
```

- [ ] **Step 2: Run boundary test**

Run:

```bash
node --test scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs
```

Expected: PASS with no network, Provider, billing, schema, environment, or executor access.

- [ ] **Step 3: Extend the existing safe browser Director fixture**

Add one non-generation path: open a persisted advisory Recipe, inspect rule IDs and `ckr1_`, mark reviewed, save/reload, then ignore and restore. Assert no asset upload, Provider, generation, payment, billing, credit, wallet, or checkout mutation. If an authenticated Preview fixture is unavailable, report `QA_HARNESS_LIMITATION`; do not claim browser write PASS.

- [ ] **Step 4: Run all targeted suites**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/advisory.test.ts src/lib/storyboard/recipe/intelligence.test.ts src/lib/storyboard/recipe/recipePersistence.test.ts src/lib/storyboard/recipe/stateMachine.test.ts src/components/create/StoryboardDirectorPanel.test.tsx
node --test scripts/creator-intelligence-knowledge-boundary.test.mjs scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs
```

Expected: all targeted tests pass; no advisory blocks materialization; no forbidden dependency is present.

- [ ] **Step 5: Commit Task 5**

```bash
git add scripts/creator-intelligence-storyboard-advisory-boundary.test.mjs apps/web/src/lib/storyboard/recipe/advisory.test.ts apps/web/src/components/create/StoryboardDirectorPanel.test.tsx
git diff --cached --check
git commit -m "test: guard storyboard advisory boundaries"
```

## Task 6: Final Verification, Documentation, and Delivery

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run full repository gates**

Run:

```bash
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check || node scripts/agent-loop-check.mjs
git diff --check
git diff --name-only origin/main...HEAD
```

Expected: type-check, lint, build, agent check, and diff check exit 0. Existing lint warnings may remain only if the command is successful; do not attribute them to Advisory B without evidence.

- [ ] **Step 2: Run an independent final review**

Review `origin/main...HEAD` for any Provider/BYOK/generation/payment/credit/schema/env/executor/Production DB change; all four advisory families must be local, deterministic, evidence-linked, and non-blocking. Confirm decisions cannot apply after changed input or receipt and V1/V2 metadata remains readable. Fix every P0/P1 finding, then rerun Step 1.

- [ ] **Step 3: Update only observed results in status documents**

After all tests and QA complete, record actual commit IDs, test totals, Vercel deployment ID/SHA, browser classification, and exact boundary verification in `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md`. Do not write an outcome before observing it.

- [ ] **Step 4: Commit delivery documents**

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close storyboard advisory layer"
```

- [ ] **Step 5: Push and verify Production only after explicit session approval**

Run only after the user explicitly says `确认推送部署` in the implementation session:

```bash
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
pnpm dlx vercel@53.3.1 ls creator-city --yes
```

Wait until Vercel reports `Ready`, then run:

```bash
curl --max-time 20 --silent --show-error --location --output /dev/null --write-out 'root %{http_code} %{url_effective}\n' https://creator-city-vert.vercel.app/
curl --max-time 20 --silent --show-error --location --output /dev/null --write-out 'create %{http_code} %{url_effective}\n' https://creator-city-vert.vercel.app/create
git status --short
```

Expected: local and remote SHA match; the deployment is Ready; root returns 200; unauthenticated `/create` redirects to login; the worktree is clean.

## Plan Self-Review

- Spec coverage: Tasks 1 and 3 implement all four advisory families, local selection receipts, deterministic ordering, and non-blocking behavior. Task 2 implements version-scoped reviewed/ignored/restore state and V1/V2 compatibility. Task 4 keeps the feature inside the existing Storyboard Director evidence inspector. Task 5 covers static and browser boundaries. Task 6 covers final verification and delivery.
- Completeness scan: no unfinished markers, unspecified error handling, or undefined implementation step remains. Each task names files, test commands, expected outcomes, and a commit.
- Type consistency: `StoryboardDirectorAdvisoryDecision`, `StoryboardDirectorAdvisoryMetadata`, `evaluateStoryboardDirectorAdvisories`, `setStoryboardAdvisoryDecision`, and `restoreStoryboardAdvisory` use the same names throughout. `open` is derived and is never persisted.
