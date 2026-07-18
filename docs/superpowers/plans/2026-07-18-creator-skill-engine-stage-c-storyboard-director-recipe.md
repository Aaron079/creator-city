# Creator Skill Engine Stage C Storyboard Director Recipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Storyboard Director with a cloud-recoverable, evidence-backed Recipe that orchestrates Script Segmentation, Narrative Beat Analysis, and Shot Planning while preserving each Skill as an independent tool.

**Architecture:** Add a pure, versioned Recipe domain under `apps/web/src/lib/storyboard/recipe` for identity, strict persistence, state transitions, and cross-stage intelligence. Keep canvas materialization in a pure helper beside the existing guarded Skill materializers, keep React presentation in one new Recipe workspace component, strengthen the existing `StoryboardDirectorPanel` with two tabs, and limit `VisualCanvasWorkspace` to source snapshots, control-node mutations, existing canvas save scheduling, and explicit downstream callbacks.

**Tech Stack:** TypeScript, React 18, Next.js 14 App Router, Node test runner through `tsx`, existing Creator Skill runtime and Artifact contracts, existing canvas node/edge persistence, Lucide icons, authenticated Google Chrome QA, Vercel.

---

## Scope and File Map

Create:

- `apps/web/src/lib/storyboard/recipe/types.ts` - versioned Recipe, stage, review, provenance, finding, receipt, and persisted metadata contracts.
- `apps/web/src/lib/storyboard/recipe/identity.ts` - canonical source snapshots and stable Recipe/materialization identities.
- `apps/web/src/lib/storyboard/recipe/persistence.ts` - strict own-data-property metadata reader and safe persisted snapshot clone.
- `apps/web/src/lib/storyboard/recipe/recipePersistence.test.ts` - identity, corruption, bounds, accessor, source-stale, and round-trip tests.
- `apps/web/src/lib/storyboard/recipe/state-machine.ts` - start, review edit, approval, automatic next-Skill execution, rerun, and invalidation transitions.
- `apps/web/src/lib/storyboard/recipe/stateMachine.test.ts` - public-runtime, approval gate, automatic progression, invalidation, and stale completion tests.
- `apps/web/src/lib/storyboard/recipe/intelligence.ts` - deterministic blocking and advisory cross-stage checks.
- `apps/web/src/lib/storyboard/recipe/intelligence.test.ts` - coverage, lineage, missing-field, repetition, establishing-shot, pacing, and naming tests.
- `apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.ts` - control-node dedupe, existing grouped planners, shot-board sync, compatibility drafts, and receipts.
- `apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts` - stable dedupe, manual-shot preservation, legacy import, and partial-failure planning tests.
- `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx` - stage navigation, review workspace, evidence inspector, intelligence strip, and explicit final actions.
- `apps/web/src/components/create/StoryboardDirectorPanel.test.tsx` - tab, Recipe state, shot-board source-of-truth, and UI action helper tests.
- `scripts/canvas-creator-skill-stage-c-static.test.mjs` - Director wiring, source immutability, persistence bounds, public runtime, and forbidden-network checks.

Modify:

- `apps/web/src/lib/storyboard/types.ts` - optional Recipe provenance on Recipe-derived `ShotCard` values without changing manual-card requirements.
- `apps/web/src/lib/storyboard/director.ts` - expose guarded legacy-state reading and deterministic Recipe shot-card helpers; keep manual shot creation behavior.
- `apps/web/src/lib/storyboard/index.ts` - export the Recipe public contracts.
- `apps/web/src/components/create/StoryboardDirectorPanel.tsx` - add `剧本编排` and `镜头板` tabs while preserving the existing timeline and detail editor.
- `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts` - add a Text-node route to the existing Director, not a second Director implementation.
- `apps/web/src/components/create/AssetAgentToolbar.tsx` - dispatch `storyboard-director` to the existing Director callback.
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx` - create/open/update one control node, use cloud-backed shot-board state, schedule existing saves, and delegate explicit apply callbacks.
- `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` - update only after implementation and authenticated Production validation pass.

Do not modify:

- Prisma schema, migrations, Production DB, or environment files
- Generate routes, Provider adapters, BYOK semantics, or `cn-executor`
- Billing, Credits, Wallet, Ledger, Payment, Recharge, or Checkout
- `package.json`, `pnpm-lock.yaml`, or `next.config.js`
- Script Segmentation, Narrative Beat Analysis, or Shot Planning internal parser semantics

Do not run a real Provider request or real payment. If implementation requires any forbidden file, stop with `SCOPE_EXPANSION_REQUIRED`.

## Execution Preparation

Before Task 1, confirm the approved plan commit is the clean execution baseline and retain it for every final diff audit:

```bash
git branch --show-current
git status --short
export STAGE_C_BASE_SHA="$(git rev-parse HEAD)"
printf 'STAGE_C_BASE_SHA=%s\n' "$STAGE_C_BASE_SHA"
```

Require `main`, an empty status, and a nonempty SHA. Do not reset, stash, or change branches.

## Task 1: Recipe Contracts, Stable Identity, and Strict Persistence

**Files:**

- Create: `apps/web/src/lib/storyboard/recipe/types.ts`
- Create: `apps/web/src/lib/storyboard/recipe/identity.ts`
- Create: `apps/web/src/lib/storyboard/recipe/persistence.ts`
- Create: `apps/web/src/lib/storyboard/recipe/recipePersistence.test.ts`
- Modify: `apps/web/src/lib/storyboard/index.ts`

- [ ] **Step 1: Write failing persistence and identity tests**

Create fixtures with one source Text node and assert the public contract:

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createStoryboardDirectorRecipeIdentity,
  readStoryboardDirectorRecipe,
  storyboardDirectorRecipeMetadata,
} from './index'

const context = { projectId: 'project-1', workflowId: 'workflow-1' }
const source = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Pilot',
  prompt: 'INT. LAB - NIGHT\nMara opens the sealed case.',
}

describe('Storyboard Director Recipe identity', () => {
  test('is deterministic and ignores title and audit time', () => {
    const first = createStoryboardDirectorRecipeIdentity(context, source)
    const second = createStoryboardDirectorRecipeIdentity(context, {
      ...source,
      title: 'Renamed only',
    })
    assert.equal(first.recipeId, second.recipeId)
    assert.equal(first.sourceFingerprint, second.sourceFingerprint)
    assert.match(first.recipeId, /^sdr1_[0-9a-f]{8}$/)
  })

  test('changes with project, workflow, source node, or effective source text', () => {
    const base = createStoryboardDirectorRecipeIdentity(context, source)
    assert.notEqual(
      createStoryboardDirectorRecipeIdentity({ ...context, workflowId: 'workflow-2' }, source).recipeId,
      base.recipeId,
    )
    assert.notEqual(
      createStoryboardDirectorRecipeIdentity(context, { ...source, id: 'source-2' }).recipeId,
      base.recipeId,
    )
    assert.notEqual(
      createStoryboardDirectorRecipeIdentity(context, { ...source, prompt: `${source.prompt}\nA siren starts.` }).recipeId,
      base.recipeId,
    )
  })
})

describe('Storyboard Director Recipe persistence', () => {
  test('round-trips a valid owned metadata value without sharing references', () => {
    const recipe = validRecipeFixture()
    const metadata = storyboardDirectorRecipeMetadata(recipe)
    const read = readStoryboardDirectorRecipe(metadata)
    assert.equal(read.status, 'valid')
    assert.notEqual(read.status === 'valid' ? read.recipe : null, recipe)
    assert.deepEqual(read.status === 'valid' ? read.recipe : null, recipe)
  })

  test('distinguishes absent, invalid, unsupported, and oversized metadata', () => {
    assert.deepEqual(readStoryboardDirectorRecipe(undefined), { status: 'absent' })
    assert.equal(readStoryboardDirectorRecipe({ storyboardDirectorRecipe: {} }).status, 'invalid')
    assert.equal(readStoryboardDirectorRecipe(unsupportedVersionFixture()).status, 'unsupported')
    assert.equal(readStoryboardDirectorRecipe(over120ShotsFixture()).status, 'invalid')
  })

  test('does not execute accessors or accept inherited metadata', () => {
    const inherited = Object.create({ storyboardDirectorRecipe: validRecipeFixture() })
    assert.deepEqual(readStoryboardDirectorRecipe(inherited), { status: 'absent' })
    const metadata = Object.create(null)
    Object.defineProperty(metadata, 'storyboardDirectorRecipe', {
      get() { throw new Error('must not execute') },
    })
    assert.equal(readStoryboardDirectorRecipe(metadata).status, 'invalid')
  })
})
```

Include explicit tests for sparse arrays, duplicate scene/beat/shot IDs, more than 40 scenes, more than 120 beats, more than 120 shots, nonfinite numbers, inherited nested fields, and a control node whose persisted identity conflicts with its source snapshot.

- [ ] **Step 2: Run the tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/storyboard/recipe/recipePersistence.test.ts
```

Expected: FAIL because the Recipe modules do not exist.

- [ ] **Step 3: Add the versioned contracts**

Define these exact top-level contracts in `types.ts`:

```ts
import type {
  CreatorSkillArtifact,
  CreatorSkillEvidence,
  CreatorSkillIssue,
  CreatorSkillReviewStatus,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
  ScriptSceneDraft,
  NarrativeBeatDraft,
  ShotPlanDraft,
  ShotPlanningOptions,
} from '../../skills'
import type { StoryboardState } from '../types'

export const STORYBOARD_DIRECTOR_RECIPE_VERSION = 1 as const
export const STORYBOARD_DIRECTOR_RECIPE_SKILL_VERSION = '1.0.0' as const

export type StoryboardDirectorStageId =
  | 'source'
  | 'scene-review'
  | 'beat-review'
  | 'shot-review'

export type StoryboardDirectorStageStatus =
  | 'idle'
  | 'running'
  | 'needs-review'
  | 'approved'
  | 'stale'
  | 'blocked'

export type RecipeReviewItem<T> = T & {
  decision: CreatorSkillReviewStatus
}

export type StoryboardDirectorStage<T> = {
  status: StoryboardDirectorStageStatus
  generation: number
  sourceFingerprint: string
  result: CreatorSkillRunResult | null
  drafts: T[]
  approvedArtifact: CreatorSkillArtifact | null
  staleResult: CreatorSkillRunResult | null
}

export type StoryboardDirectorFinding = {
  findingId: string
  severity: 'blocking' | 'advisory'
  code: string
  message: string
  sceneId?: string
  beatId?: string
  shotId?: string
  evidenceIds: string[]
}

export type StoryboardDirectorMaterializationReceipt = {
  identity: string
  kind: 'scene' | 'beat' | 'shot-plan' | 'shot-card' | 'draft-node'
  resultId: string
  targetId: string
}

export type StoryboardDirectorRecipe = {
  schemaVersion: typeof STORYBOARD_DIRECTOR_RECIPE_VERSION
  recipeId: string
  projectId: string
  workflowId: string
  sourceNode: CreatorSkillSourceNode
  sourceFingerprint: string
  activeStage: StoryboardDirectorStageId
  scene: StoryboardDirectorStage<RecipeReviewItem<ScriptSceneDraft>>
  beat: StoryboardDirectorStage<RecipeReviewItem<NarrativeBeatDraft>>
  shot: StoryboardDirectorStage<RecipeReviewItem<ShotPlanDraft>> & {
    options: ShotPlanningOptions
  }
  findings: StoryboardDirectorFinding[]
  storyboard: StoryboardState
  receipts: StoryboardDirectorMaterializationReceipt[]
  legacyImportStatus: 'not-offered' | 'available' | 'imported' | 'dismissed'
  audit: { createdAt: string; updatedAt: string }
}
```

Keep timestamps in `audit` only. They must not participate in any stable identity.

- [ ] **Step 4: Implement stable identity using the existing canonical fingerprint**

In `identity.ts`, normalize the effective source text and call the existing fingerprint implementation with a metadata-free source snapshot:

```ts
export function createStoryboardDirectorRecipeIdentity(
  context: { projectId: string; workflowId: string },
  source: CreatorSkillSourceNode,
) {
  const projectId = requireId(context.projectId, 'projectId')
  const workflowId = requireId(context.workflowId, 'workflowId')
  const sourceNodeId = requireId(source.id, 'sourceNode.id')
  if (source.kind !== 'text') throw new TypeError('Recipe source must be Text')
  const sourceText = (source.resultText?.trim() ? source.resultText : source.prompt).trim()
  if (!sourceText) throw new TypeError('Recipe source text is empty')
  const sourceFingerprint = createCreatorSkillFingerprint(
    'storyboard-director-source',
    STORYBOARD_DIRECTOR_RECIPE_SKILL_VERSION,
    {
      sourceNodes: [{ id: sourceNodeId, kind: 'text', title: '', prompt: sourceText }],
      projectContext: { projectId, workflowId },
    },
  )
  return {
    sourceFingerprint,
    recipeId: sourceFingerprint.replace(/^csf1_/, 'sdr1_'),
    sourceText,
  }
}

export function createRecipeMaterializationIdentity(
  recipeId: string,
  kind: StoryboardDirectorMaterializationReceipt['kind'],
  artifactId: string,
  resultId: string,
) {
  return createCreatorSkillFingerprint('storyboard-director-materialization', '1.0.0', {
    sourceNodes: [{ id: recipeId, kind: 'text', title: '', prompt: `${kind}\n${artifactId}\n${resultId}` }],
  }).replace(/^csf1_/, 'sdrm1_')
}
```

- [ ] **Step 5: Implement the strict reader and clone**

`persistence.ts` must inspect own data descriptors only, validate the exact version and bounds, clone every array and plain object, and return:

```ts
export type StoryboardDirectorRecipeReadResult =
  | { status: 'absent' }
  | { status: 'valid'; recipe: StoryboardDirectorRecipe }
  | { status: 'invalid'; issue: CreatorSkillIssue }
  | { status: 'unsupported'; issue: CreatorSkillIssue }

export function storyboardDirectorRecipeMetadata(recipe: StoryboardDirectorRecipe) {
  return { storyboardDirectorRecipe: cloneStoryboardDirectorRecipe(recipe) }
}

export function readStoryboardDirectorRecipe(
  metadataJson: unknown,
): StoryboardDirectorRecipeReadResult {
  if (!isObject(metadataJson)) return { status: 'absent' }
  const property = ownData(metadataJson, 'storyboardDirectorRecipe')
  if (property.status === 'absent') return { status: 'absent' }
  if (property.status !== 'value') return invalid('STORYBOARD_RECIPE_INVALID')
  try {
    const version = readPositiveInteger(property.value, 'schemaVersion')
    if (version !== STORYBOARD_DIRECTOR_RECIPE_VERSION) {
      return unsupported('STORYBOARD_RECIPE_VERSION_UNSUPPORTED')
    }
    return { status: 'valid', recipe: cloneStoryboardDirectorRecipe(property.value) }
  } catch {
    return invalid('STORYBOARD_RECIPE_INVALID')
  }
}
```

After cloning, recompute the Recipe identity from its project, workflow, and source snapshot and reject any mismatch. Require unique IDs and enforce all design limits before returning `valid`.

- [ ] **Step 6: Export the Recipe public surface and run GREEN**

Add `export * from './recipe/types'`, `identity`, and `persistence` to `apps/web/src/lib/storyboard/index.ts`.

Run the Task 1 command. Expected: all persistence and identity tests PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/web/src/lib/storyboard
git commit -m "feat: add storyboard director recipe contract"
```

## Task 2: Recipe State Machine and Automatic Skill Progression

**Files:**

- Create: `apps/web/src/lib/storyboard/recipe/state-machine.ts`
- Create: `apps/web/src/lib/storyboard/recipe/stateMachine.test.ts`
- Modify: `apps/web/src/lib/storyboard/index.ts`

- [ ] **Step 1: Write failing state-machine tests**

Use an injected runner wrapper to record public Skill calls while delegating to `runCreatorSkill`:

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { runCreatorSkill } from '../../skills'
import {
  approveBeatStage,
  approveSceneStage,
  approveShotStage,
  createStoryboardDirectorRecipe,
  invalidateRecipeAfter,
  markRecipeSourceFreshness,
  setRecipeDecision,
  updateRecipeDraft,
} from './state-machine'

const calls: string[] = []
const runner: typeof runCreatorSkill = (skillId, input, version) => {
  calls.push(skillId)
  return runCreatorSkill(skillId, input, version)
}

test('start runs only public script-segmentation and leaves every scene pending', () => {
  const recipe = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)
  assert.deepEqual(calls, ['script-segmentation'])
  assert.equal(recipe.activeStage, 'scene-review')
  assert.equal(recipe.scene.status, 'needs-review')
  assert.ok(recipe.scene.drafts.every((scene) => scene.decision === 'pending'))
  assert.equal(recipe.beat.status, 'idle')
  assert.equal(recipe.shot.status, 'idle')
})

test('scene approval automatically runs narrative analysis with approved Artifact only', () => {
  const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)
  const decided = decideAll(started, 'scene-review', 'approved')
  const next = approveSceneStage(decided, ISO_TIME, runner)
  assert.deepEqual(calls.slice(-1), ['narrative-beat-analysis'])
  assert.equal(next.scene.status, 'approved')
  assert.equal(next.activeStage, 'beat-review')
  assert.ok(next.scene.approvedArtifact)
  assert.ok(next.beat.result?.artifacts[0]?.sourceArtifactIds.includes(
    next.scene.approvedArtifact!.artifactId,
  ))
  assert.ok(next.beat.drafts.every((beat) => beat.decision === 'pending'))
})

test('beat approval automatically runs shot planning and final approval never generates', () => {
  const throughBeat = approvedBeatRecipe(runner)
  const shotReview = approveBeatStage(throughBeat, ISO_TIME, runner)
  assert.equal(calls.at(-1), 'shot-planning')
  assert.equal(shotReview.activeStage, 'shot-review')
  const approved = approveShotStage(decideAll(shotReview, 'shot-review', 'approved'), ISO_TIME)
  assert.equal(approved.shot.status, 'approved')
  assert.equal(calls.filter((id) => id === 'shot-planning').length, 1)
})

test('pending decisions, blocked results, and empty approvals cannot advance', () => {
  const started = createStoryboardDirectorRecipe(context, source, ISO_TIME, runner)
  assert.throws(() => approveSceneStage(started, ISO_TIME, runner), /unresolved/i)
  assert.throws(
    () => approveSceneStage(decideAll(started, 'scene-review', 'rejected'), ISO_TIME, runner),
    /at least one approved/i,
  )
})

test('editing approved scene invalidates beat and shot but preserves stale results', () => {
  const completed = completedRecipe(runner)
  const edited = updateRecipeDraft(completed, 'scene-review', completed.scene.drafts[0]!.sceneId, {
    actionSummary: 'Reviewed action',
  }, ISO_TIME)
  assert.equal(edited.scene.status, 'needs-review')
  assert.equal(edited.beat.status, 'stale')
  assert.equal(edited.shot.status, 'stale')
  assert.ok(edited.beat.staleResult)
  assert.ok(edited.shot.staleResult)
})

test('source changes block every materialization path without transferring decisions', () => {
  const completed = completedRecipe(runner)
  const stale = markRecipeSourceFreshness(completed, {
    ...source,
    prompt: `${source.prompt}\nThe alarm sounds.`,
  }, ISO_TIME)
  assert.equal(stale.activeStage, 'source')
  assert.equal(stale.scene.status, 'stale')
  assert.equal(stale.beat.status, 'stale')
  assert.equal(stale.shot.status, 'stale')
})
```

Also test rejected items are omitted from approved Artifacts, reviewed order is preserved, mutable fields change only approved payloads, immutable identity and source-evidence fields cannot be patched, rerun resets decisions, a stale async completion token is rejected, timestamps do not alter fingerprints, and `changeImpactForStage` returns exact downstream beat and shot counts.

- [ ] **Step 2: Run the state-machine tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/storyboard/recipe/stateMachine.test.ts
```

Expected: FAIL because `state-machine.ts` does not exist.

- [ ] **Step 3: Implement empty stages, source snapshot, and start transition**

Use a dependency type that defaults to the public runtime:

```ts
export type StoryboardRecipeSkillRunner = typeof runCreatorSkill

function emptyStage<T>(sourceFingerprint: string): StoryboardDirectorStage<T> {
  return {
    status: 'idle',
    generation: 0,
    sourceFingerprint,
    result: null,
    drafts: [],
    approvedArtifact: null,
    staleResult: null,
  }
}

export function createStoryboardDirectorRecipe(
  context: { projectId: string; workflowId: string },
  source: CreatorSkillSourceNode,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
): StoryboardDirectorRecipe {
  const identity = createStoryboardDirectorRecipeIdentity(context, source)
  const sourceNode = {
    id: source.id,
    kind: 'text' as const,
    title: source.title,
    prompt: identity.sourceText,
  }
  const sceneResult = runner('script-segmentation', {
    sourceNodes: [sourceNode],
    projectContext: context,
  })
  const sceneArtifact = requireSingleArtifact(sceneResult, 'scene-breakdown')
  return {
    schemaVersion: STORYBOARD_DIRECTOR_RECIPE_VERSION,
    recipeId: identity.recipeId,
    projectId: context.projectId,
    workflowId: context.workflowId,
    sourceNode,
    sourceFingerprint: identity.sourceFingerprint,
    activeStage: 'scene-review',
    scene: stageFromSceneResult(sceneResult, sceneArtifact, identity.sourceFingerprint),
    beat: emptyStage(identity.sourceFingerprint),
    shot: {
      ...emptyStage(identity.sourceFingerprint),
      options: DEFAULT_SHOT_PLANNING_OPTIONS,
    },
    findings: [],
    storyboard: { version: '2', shots: [], updatedAt: now },
    receipts: [],
    legacyImportStatus: 'not-offered',
    audit: { createdAt: now, updatedAt: now },
  }
}
```

Define the local default once and do not import the legacy filler planner:

```ts
export const DEFAULT_SHOT_PLANNING_OPTIONS: ShotPlanningOptions = {
  requestedShotCount: 5,
  outputMode: 'mixed',
  pacing: 'standard',
  shotSizeStrategy: 'auto',
  userInstruction: '',
}
```

`stageFromSceneResult` must block on a blocked or malformed result and otherwise clone every scene with `decision: 'pending'`.

- [ ] **Step 4: Implement immutable review helpers and precise invalidation**

Expose one guarded update path and one decision path:

```ts
export function setRecipeDecision(
  recipe: StoryboardDirectorRecipe,
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
  itemId: string,
  decision: CreatorSkillReviewStatus,
  now: string,
): StoryboardDirectorRecipe

export function updateRecipeDraft(
  recipe: StoryboardDirectorRecipe,
  stageId: Exclude<StoryboardDirectorStageId, 'source'>,
  itemId: string,
  patch: Record<string, unknown>,
  now: string,
): StoryboardDirectorRecipe
```

Allow only these fields:

```ts
const EDITABLE_FIELDS = {
  'scene-review': new Set(['heading', 'location', 'timeOfDay', 'characters', 'actionSummary']),
  'beat-review': new Set(['summary', 'type']),
  'shot-review': new Set(['objective', 'subject', 'action', 'suggestedShotSize', 'outputKind', 'duration']),
} as const
```

Reject changes to scene/beat/shot IDs, source text, line ranges, order through generic patching, and evidence IDs. Reordering must use a dedicated same-scene function. Editing an approved stage moves it to `needs-review`, clears its approved Artifact, and calls `invalidateRecipeAfter` to move downstream results into `staleResult`.

- [ ] **Step 5: Build approved checkpoint Artifacts and automatic next runs**

Approval must require zero pending decisions, at least one approved item, a nonblocked current result, and matching source fingerprints. Build stable approved checkpoint IDs from the current result Artifact:

```ts
function approvedArtifactId(type: string, sourceArtifactId: string) {
  return `${type}-${sourceArtifactId}-recipe-approved`
}

export function approveSceneStage(
  recipe: StoryboardDirectorRecipe,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
) {
  const approvedArtifact = approvedSceneArtifact(recipe.scene)
  const result = runner('narrative-beat-analysis', {
    sourceNodes: [],
    artifacts: [approvedArtifact],
    projectContext: { projectId: recipe.projectId, workflowId: recipe.workflowId },
  })
  return withBeatReview(recipe, approvedArtifact, result, now)
}

export function approveBeatStage(
  recipe: StoryboardDirectorRecipe,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
) {
  const approvedArtifact = approvedBeatArtifact(recipe.beat)
  const result = runner('shot-planning', {
    sourceNodes: [],
    artifacts: [approvedArtifact],
    projectContext: { projectId: recipe.projectId, workflowId: recipe.workflowId },
    options: recipe.shot.options,
  })
  return withShotReview(recipe, approvedArtifact, result, now)
}
```

The approved payloads retain the Skill parsers' canonical `reviewStatus: 'pending'`; user approval is represented by the Recipe checkpoint and `sourceArtifactIds`. Preserve approved reviewed order and omit rejected items. `approveShotStage` creates a final approved `shot-plan` checkpoint but runs no further callback.

- [ ] **Step 6: Add rerun, source freshness, impact preview, and operation tokens**

Use a stable operation token to prevent stale UI completion:

```ts
export type StoryboardRecipeOperationToken = {
  recipeId: string
  sourceFingerprint: string
  stageId: StoryboardDirectorStageId
  runFingerprint: string
  generation: number
}

export function isRecipeOperationCurrent(
  token: StoryboardRecipeOperationToken,
  recipe: StoryboardDirectorRecipe,
) {
  const stage = stageForId(recipe, token.stageId)
  return token.recipeId === recipe.recipeId
    && token.sourceFingerprint === recipe.sourceFingerprint
    && token.runFingerprint === stage.result?.runFingerprint
    && token.generation === stage.generation
}
```

Every rerun increments that stage's `generation`. `markRecipeSourceFreshness` recomputes the identity using the live source and marks all analysis stages stale when it differs. Add `markRecipeSourceMissing(recipe, now)` to set `activeStage: 'source'`, mark all analysis stages stale, and add a `SOURCE_NODE_MISSING` blocking finding without deleting prior results. `changeImpactForStage` counts only currently retained downstream drafts. Rerun uses the last approved upstream Artifact, clears decisions and transient findings for that stage, and leaves upstream approval unchanged.

- [ ] **Step 7: Export and run state-machine tests GREEN**

Export `state-machine.ts` from `apps/web/src/lib/storyboard/index.ts` and run the Task 2 command. Expected: all tests PASS.

- [ ] **Step 8: Run existing Skill regressions**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/runtime.test.ts \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts \
  src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts \
  src/lib/skills/shot-planning/shotPlanning.test.ts
```

Expected: all existing Skills remain independently callable and PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add apps/web/src/lib/storyboard
git commit -m "feat: add storyboard director recipe state machine"
```

## Task 3: Director Intelligence Quality Engine

**Files:**

- Create: `apps/web/src/lib/storyboard/recipe/intelligence.ts`
- Create: `apps/web/src/lib/storyboard/recipe/intelligence.test.ts`
- Modify: `apps/web/src/lib/storyboard/index.ts`

- [ ] **Step 1: Write failing intelligence tests**

Build small approved Recipe fixtures and assert exact deterministic findings:

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  analyzeStoryboardDirectorRecipe,
  isStoryboardRecipeMaterializationReady,
} from './intelligence'

test('blocks uncovered scenes and beats with stable item identities', () => {
  const findings = analyzeStoryboardDirectorRecipe(recipeWithCoverageGaps())
  assert.deepEqual(findings.filter((item) => item.severity === 'blocking').map((item) => ({
    code: item.code,
    sceneId: item.sceneId,
    beatId: item.beatId,
  })), [
    { code: 'SCENE_WITHOUT_APPROVED_BEAT', sceneId: 'scene-002', beatId: undefined },
    { code: 'BEAT_WITHOUT_APPROVED_SHOT', sceneId: 'scene-001', beatId: 'scene-001-beat-002' },
  ])
})

test('blocks lineage mismatch, stale source, orphan references, and missing shot fields', () => {
  const findings = analyzeStoryboardDirectorRecipe(corruptLineageRecipe())
  const codes = findings.map((item) => item.code)
  assert.ok(codes.includes('RECIPE_SOURCE_STALE'))
  assert.ok(codes.includes('ARTIFACT_LINEAGE_MISMATCH'))
  assert.ok(codes.includes('SHOT_SCENE_REFERENCE_MISSING'))
  assert.ok(codes.includes('SHOT_BEAT_REFERENCE_MISSING'))
  assert.ok(codes.includes('SHOT_SUBJECT_MISSING'))
  assert.ok(codes.includes('SHOT_ACTION_MISSING'))
  assert.equal(isStoryboardRecipeMaterializationReady(corruptLineageRecipe()), false)
})

test('advises on repetition, establishing coverage, reaction coverage, pacing, and naming', () => {
  const findings = analyzeStoryboardDirectorRecipe(advisoryFixture())
  assert.deepEqual(findings.map((item) => item.code), [
    'SCENE_ESTABLISHING_SHOT_MISSING',
    'REACTION_VISUAL_RESPONSE_MISSING',
    'ADJACENT_SHOT_DUPLICATE',
    'SHOT_SIZE_REPETITION',
    'OUTPUT_KIND_MOTION_MISMATCH',
    'PACING_DURATION_MISMATCH',
    'CHARACTER_NAME_INCONSISTENT',
  ])
  assert.ok(findings.every((item) => item.findingId.startsWith('sdrf1_')))
})

test('reports exact coverage counts without opaque confidence', () => {
  const summary = summarizeStoryboardDirectorRecipe(healthyRecipe())
  assert.deepEqual(summary, {
    approvedScenes: 2,
    approvedBeats: 5,
    approvedShots: 6,
    coveredBeats: 5,
    blockingCount: 0,
    advisoryCount: 1,
    sourceFresh: true,
    ready: true,
  })
})
```

Also test deterministic finding order, evidence ID propagation, one finding per affected identity, advisory findings never override blocking readiness, unresolved pending items block final readiness, and current materialization receipt conflicts block.

- [ ] **Step 2: Run the intelligence tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/storyboard/recipe/intelligence.test.ts
```

Expected: FAIL because the intelligence module does not exist.

- [ ] **Step 3: Implement stable findings and blocking rules**

Use stable data only:

```ts
function finding(
  recipe: StoryboardDirectorRecipe,
  value: Omit<StoryboardDirectorFinding, 'findingId'>,
): StoryboardDirectorFinding {
  const identity = createCreatorSkillFingerprint(
    'storyboard-director-finding',
    '1.0.0',
    {
      sourceNodes: [{
        id: recipe.recipeId,
        kind: 'text',
        title: '',
        prompt: JSON.stringify({
          code: value.code,
          sceneId: value.sceneId ?? '',
          beatId: value.beatId ?? '',
          shotId: value.shotId ?? '',
        }),
      }],
    },
  )
  return { ...value, findingId: identity.replace(/^csf1_/, 'sdrf1_') }
}
```

Implement blocking rules in this fixed order:

```ts
const BLOCKING_RULE_ORDER = [
  'RECIPE_SOURCE_STALE',
  'ARTIFACT_LINEAGE_MISMATCH',
  'REVIEW_ITEMS_UNRESOLVED',
  'SCENE_WITHOUT_APPROVED_BEAT',
  'BEAT_WITHOUT_APPROVED_SHOT',
  'SHOT_SCENE_REFERENCE_MISSING',
  'SHOT_BEAT_REFERENCE_MISSING',
  'SHOT_SUBJECT_MISSING',
  'SHOT_ACTION_MISSING',
  'SHOT_EVIDENCE_MISSING',
  'MATERIALIZATION_RECEIPT_CONFLICT',
] as const
```

Lineage validation requires `scene approvedArtifact -> beat result sourceArtifactIds -> beat approvedArtifact -> shot result sourceArtifactIds -> shot approvedArtifact`. Never infer a valid link from display text.

- [ ] **Step 4: Implement bounded advisory rules**

Advisory checks must use reviewed values and explicit evidence only:

```ts
function normalizedWords(value: string) {
  return new Set(value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))
}

function overlapRatio(left: string, right: string) {
  const a = normalizedWords(left)
  const b = normalizedWords(right)
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection += 1
  return intersection / Math.max(a.size, b.size)
}
```

- `ADJACENT_SHOT_DUPLICATE`: adjacent shots in one scene have the same size and objective/action overlap of at least `0.8`.
- `SHOT_SIZE_REPETITION`: four or more consecutive approved shots use one shot size.
- `SCENE_ESTABLISHING_SHOT_MISSING`: a scene with explicit location/setup evidence has no `wide` or `full` shot.
- `REACTION_VISUAL_RESPONSE_MISSING`: an approved reaction/turn beat has no linked approved shot.
- `OUTPUT_KIND_MOTION_MISMATCH`: explicit sustained movement evidence is assigned an image output.
- `PACING_DURATION_MISMATCH`: `fast_social` has a 10-second shot or `slow_cinematic` has three consecutive 5-second shots.
- naming inconsistency: compare exact normalized names from approved scene characters and reviewed shot subjects; report variants without choosing a replacement.

Do not add a confidence score or generate replacement content.

- [ ] **Step 5: Implement summary and readiness**

```ts
export function isStoryboardRecipeMaterializationReady(recipe: StoryboardDirectorRecipe) {
  return recipe.scene.status === 'approved'
    && recipe.beat.status === 'approved'
    && recipe.shot.status === 'approved'
    && analyzeStoryboardDirectorRecipe(recipe).every((item) => item.severity !== 'blocking')
}

export function summarizeStoryboardDirectorRecipe(
  recipe: StoryboardDirectorRecipe,
): StoryboardDirectorSummary {
  const findings = analyzeStoryboardDirectorRecipe(recipe)
  const approvedBeats = approvedBeatDrafts(recipe)
  const approvedShots = approvedShotDrafts(recipe)
  const covered = new Set(approvedShots.map((shot) => shot.beatId).filter(Boolean))
  return {
    approvedScenes: approvedSceneDrafts(recipe).length,
    approvedBeats: approvedBeats.length,
    approvedShots: approvedShots.length,
    coveredBeats: approvedBeats.filter((beat) => covered.has(beat.beatId)).length,
    blockingCount: findings.filter((item) => item.severity === 'blocking').length,
    advisoryCount: findings.filter((item) => item.severity === 'advisory').length,
    sourceFresh: !findings.some((item) => item.code === 'RECIPE_SOURCE_STALE'),
    ready: findings.every((item) => item.severity !== 'blocking'),
  }
}
```

- [ ] **Step 6: Export and run intelligence tests GREEN**

Export `intelligence.ts` and run the Task 3 command. Expected: all tests PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/web/src/lib/storyboard
git commit -m "feat: add storyboard director intelligence"
```

## Task 4: Cloud Shot Board, Legacy Import, and Materialization Planning

**Files:**

- Create: `apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.ts`
- Create: `apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts`
- Modify: `apps/web/src/lib/storyboard/types.ts`
- Modify: `apps/web/src/lib/storyboard/director.ts`

- [ ] **Step 1: Write failing materialization and migration tests**

Cover the control node, existing grouped planners, shot-board sync, compatibility drafts, and legacy local state:

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  importLegacyShotBoard,
  planStoryboardDirectorControlNode,
  planStoryboardDirectorGroupedNodes,
  planStoryboardDirectorShotBoardSync,
  planStoryboardDirectorDraftNodes,
  recordStoryboardDirectorReceipts,
} from './storyboardDirectorMaterialization'

test('finds the existing control node by stable Recipe identity', () => {
  const recipe = completedRecipe()
  const first = planStoryboardDirectorControlNode(recipe, [])
  assert.equal(first.status, 'create')
  assert.equal(first.plan.metadataJson.storyboardDirectorRecipe.recipeId, recipe.recipeId)
  const second = planStoryboardDirectorControlNode(recipe, [{
    id: 'control-1',
    metadataJson: first.plan.metadataJson,
  }])
  assert.deepEqual(second, { status: 'existing', nodeId: 'control-1' })
})

test('blocks duplicate or malformed matching control nodes', () => {
  const recipe = completedRecipe()
  assert.equal(planStoryboardDirectorControlNode(recipe, duplicateControlNodes(recipe)).status, 'conflict')
  assert.equal(planStoryboardDirectorControlNode(recipe, malformedMatchingControl(recipe.recipeId)).status, 'conflict')
})

test('uses existing grouped materializers and deduplicates repeat apply', () => {
  const recipe = completedRecipe()
  const first = planStoryboardDirectorGroupedNodes(recipe, ['scene', 'beat', 'shot-plan'], [])
  assert.ok(first.create.length > 0)
  const existing = first.create.map((plan, index) => ({
    id: `node-${index}`,
    metadataJson: plan.metadataJson,
  }))
  const repeat = planStoryboardDirectorGroupedNodes(recipe, ['scene', 'beat', 'shot-plan'], existing)
  assert.equal(repeat.create.length, 0)
  assert.equal(repeat.duplicates.length, first.create.length)
})

test('shot-board sync preserves manual shots and updates only same-Recipe shots', () => {
  const recipe = completedRecipe()
  const manual = manualShot('manual-1')
  const first = planStoryboardDirectorShotBoardSync(recipe, {
    version: '2', shots: [manual], updatedAt: ISO_TIME,
  }, ISO_TIME)
  assert.equal(first.state.shots[0]?.id, manual.id)
  assert.ok(first.createdShotIds.length > 0)
  const repeat = planStoryboardDirectorShotBoardSync(recipe, first.state, ISO_TIME)
  assert.equal(repeat.createdShotIds.length, 0)
  assert.deepEqual(repeat.state.shots.map((shot) => shot.id), first.state.shots.map((shot) => shot.id))
})

test('compatibility drafts have stable identities and no generation callback', () => {
  const recipe = completedRecipe()
  const first = planStoryboardDirectorDraftNodes(recipe, [])
  const repeat = planStoryboardDirectorDraftNodes(recipe, first.create.map(planAsExistingNode))
  assert.ok(first.create.every((plan) => plan.kind === 'image' || plan.kind === 'video'))
  assert.equal(repeat.create.length, 0)
  assert.equal(repeat.duplicates.length, first.create.length)
})

test('legacy import is explicit, preserves the local state, and cannot replace cloud shots', () => {
  const legacy = { version: '1', shots: [manualShot('legacy-1')], updatedAt: ISO_TIME }
  const empty = importLegacyShotBoard(emptyRecipe(), legacy, ISO_TIME)
  assert.equal(empty.storyboard.shots.length, 1)
  assert.equal(empty.legacyImportStatus, 'imported')
  assert.throws(() => importLegacyShotBoard(recipeWithCloudShots(), legacy, ISO_TIME), /nonempty/i)
  assert.deepEqual(legacy.shots.map((shot) => shot.id), ['legacy-1'])
})
```

Also test selected stage subsets, stable plan order, a Recipe with blocking Intelligence findings, conflicting receipts, receipt idempotency, a callback-success subset recorded without claiming rollback, Recipe shot updates after reviewed fields change, and manual cards with identical titles remaining untouched.

- [ ] **Step 2: Run the materialization tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Add optional Recipe provenance to shot cards and guard legacy state**

Extend `ShotCard` without changing manual-card requirements:

```ts
export type StoryboardRecipeShotProvenance = {
  recipeId: string
  sourceArtifactId: string
  sceneId: string
  beatId?: string
  shotId: string
}

export type ShotCard = {
  // existing fields unchanged
  recipe?: StoryboardRecipeShotProvenance
}
```

In `director.ts`, preserve `readDirectorState` for existing callers and add:

```ts
export type LegacyDirectorStateReadResult =
  | { status: 'absent' }
  | { status: 'valid'; state: StoryboardState }
  | { status: 'invalid' }

export function readLegacyDirectorState(projectId?: string): LegacyDirectorStateReadResult {
  if (typeof window === 'undefined') return { status: 'absent' }
  const raw = window.localStorage.getItem(directorStorageKey(projectId))
  if (!raw) return { status: 'absent' }
  try {
    const state = cloneAndValidateStoryboardState(JSON.parse(raw))
    return { status: 'valid', state }
  } catch {
    return { status: 'invalid' }
  }
}
```

Make `readDirectorState` return the valid state or the existing empty fallback. Do not delete or rewrite legacy storage during import.

- [ ] **Step 4: Implement control-node planning and conflicts**

Use a visible Text node plan:

```ts
export type StoryboardDirectorControlNodePlan = {
  title: '分镜导演'
  prompt: string
  metadataJson: { storyboardDirectorRecipe: StoryboardDirectorRecipe }
  edgeLabel: '分镜导演'
  edgeToolId: 'storyboard-director'
  edgeToolIcon: '🎬'
}

export function planStoryboardDirectorControlNode(
  recipe: StoryboardDirectorRecipe,
  existingNodes: Array<{ id: string; metadataJson?: unknown }>,
):
  | { status: 'create'; plan: StoryboardDirectorControlNodePlan }
  | { status: 'existing'; nodeId: string }
  | { status: 'conflict'; nodeIds: string[] } {
  const matches = findRecipeIdentityMatches(recipe.recipeId, existingNodes)
  if (matches.invalid.length || matches.valid.length > 1) {
    return { status: 'conflict', nodeIds: [...matches.valid, ...matches.invalid] }
  }
  if (matches.valid.length === 1) return { status: 'existing', nodeId: matches.valid[0]! }
  return { status: 'create', plan: controlNodePlan(recipe) }
}
```

Export the same pure summary formatter for later control-node patches:

```ts
export function storyboardDirectorRecipeSummary(recipe: StoryboardDirectorRecipe) {
  const summary = summarizeStoryboardDirectorRecipe(recipe)
  return [
    '分镜导演 Recipe',
    `当前阶段: ${recipe.activeStage}`,
    `已批准: ${summary.approvedScenes} 场景 / ${summary.approvedBeats} 节拍 / ${summary.approvedShots} 镜头`,
    `节拍覆盖: ${summary.coveredBeats}/${summary.approvedBeats}`,
    `待处理: ${summary.blockingCount} 阻塞 / ${summary.advisoryCount} 提醒`,
    `来源: ${summary.sourceFresh ? '有效' : '已变化'}`,
    `落地: ${summary.ready ? '可执行' : '未就绪'}`,
  ].join('\n')
}
```

The prompt summary reports current stage, approved counts, unresolved findings, source freshness, and readiness. It must contain no secret or Provider data.

- [ ] **Step 5: Reuse the three existing grouped planners**

Keep this helper in the canvas skill directory so importing the existing materializers does not invert the `lib` dependency direction:

```ts
export function planStoryboardDirectorGroupedNodes(
  recipe: StoryboardDirectorRecipe,
  kinds: Array<'scene' | 'beat' | 'shot-plan'>,
  existingNodes: Array<{ metadataJson?: unknown }>,
) {
  assertRecipeReadyForRequestedKinds(recipe, kinds)
  const scene = kinds.includes('scene')
    ? planScriptSceneMaterialization(sceneMaterializationInput(recipe, existingNodes))
    : { create: [], duplicates: [] }
  const beat = kinds.includes('beat')
    ? planNarrativeBeatMaterialization(beatMaterializationInput(recipe, existingNodes))
    : { create: [], duplicates: [] }
  const shot = kinds.includes('shot-plan')
    ? planShotPlanMaterialization(shotMaterializationInput(recipe, existingNodes))
    : { create: [], duplicates: [] }
  return {
    create: [...scene.create, ...beat.create, ...shot.create],
    duplicates: [...scene.duplicates, ...beat.duplicates, ...shot.duplicates],
  }
}
```

Adapters must pass the stage's actual run result, source Artifact ID, reviewed approved values, and current nodes. Do not reconstruct evidence or bypass existing validators.

- [ ] **Step 6: Implement deterministic shot-board synchronization**

Create Recipe-derived cards from approved shots only:

```ts
function recipeShotCard(
  recipe: StoryboardDirectorRecipe,
  shot: ApprovedShotPlan,
  index: number,
  now: string,
): ShotCard {
  const shotType = {
    wide: 'ELS',
    full: 'LS',
    medium: 'MS',
    close: 'CU',
    'extreme-close': 'ECU',
  }[shot.suggestedShotSize]
  return {
    id: `recipe-${recipe.recipeId}-${shot.shotId}`,
    index,
    title: `S${String(index + 1).padStart(2, '0')}`,
    shotType,
    durationSec: shot.duration,
    directorNote: `${shot.objective}\n${shot.action}`.trim(),
    nodeIds: [],
    createdAt: now,
    updatedAt: now,
    recipe: {
      recipeId: recipe.recipeId,
      sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
      sceneId: shot.sceneId,
      ...(shot.beatId ? { beatId: shot.beatId } : {}),
      shotId: shot.shotId,
    },
  }
}
```

Preserve manual cards in their current order. Update a card only when both `recipeId` and `shotId` match, preserving its original `id`, `createdAt`, manual node bindings, and thumbnail. Append new Recipe cards in reviewed order and reindex all cards once. Never delete a manual card or a Recipe card from a different Recipe.

- [ ] **Step 7: Implement compatibility draft plans and receipts**

Return data only; never accept a generation callback:

```ts
export type StoryboardDirectorDraftNodePlan = {
  identity: string
  resultId: string
  kind: 'image' | 'video'
  title: string
  prompt: string
  metadataJson: Record<string, unknown>
}

export function recordStoryboardDirectorReceipts(
  recipe: StoryboardDirectorRecipe,
  completed: Array<{ identity: string; kind: StoryboardDirectorMaterializationReceipt['kind']; resultId: string; targetId: string }>,
  now: string,
) {
  const byIdentity = new Map(recipe.receipts.map((receipt) => [receipt.identity, receipt]))
  for (const item of completed) {
    const existing = byIdentity.get(item.identity)
    if (existing && existing.targetId !== item.targetId) throw new TypeError('receipt conflict')
    byIdentity.set(item.identity, item)
  }
  return { ...recipe, receipts: [...byIdentity.values()], audit: { ...recipe.audit, updatedAt: now } }
}
```

Compatibility metadata includes Recipe ID, shot ID, source Artifact ID, stable materialization identity, output kind, duration, and existing Creator Skill provenance. Existing-node scanning must use stable metadata identities, not title or prompt matching.

- [ ] **Step 8: Implement explicit legacy import**

`importLegacyShotBoard` requires `recipe.storyboard.shots.length === 0`, clones valid legacy shots, marks `legacyImportStatus: 'imported'`, and leaves the input untouched. A nonempty cloud-backed board fails closed.

- [ ] **Step 9: Run materialization tests GREEN and regress existing planners**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts \
  src/components/create/canvas/skills/groupedSkillMaterialization.test.ts
```

Expected: all tests PASS.

- [ ] **Step 10: Commit Task 4**

```bash
git add apps/web/src/lib/storyboard \
  apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.ts \
  apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts
git commit -m "feat: plan storyboard director materialization"
```

## Task 5: Upgrade the Existing Storyboard Director UI

**Files:**

- Create: `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx`
- Create: `apps/web/src/components/create/StoryboardDirectorPanel.test.tsx`
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.tsx`

- [ ] **Step 1: Write failing panel-state and action tests**

Keep logic testable without a DOM renderer by exporting small pure helpers from the two panel modules:

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createStoryboardDirectorPanelState,
  selectStoryboardDirectorTab,
} from './StoryboardDirectorPanel'
import {
  approveActiveRecipeStage,
  batchDecideRecipeScene,
  nextUnresolvedFinding,
} from './StoryboardDirectorRecipePanel'

test('opening from a Recipe selects the Recipe tab and global opening preserves board', () => {
  assert.equal(createStoryboardDirectorPanelState({ hasRecipe: true, openedFromRecipe: true }).tab, 'recipe')
  assert.equal(createStoryboardDirectorPanelState({ hasRecipe: false, openedFromRecipe: false }).tab, 'board')
  assert.equal(selectStoryboardDirectorTab({ tab: 'board' }, 'recipe').tab, 'recipe')
})

test('stage approval invokes the state machine and returns the next review', () => {
  const next = approveActiveRecipeStage(decidedSceneRecipe(), ISO_TIME, runner)
  assert.equal(next.activeStage, 'beat-review')
  assert.equal(next.beat.status, 'needs-review')
})

test('scene batch approval leaves needs-review items pending', () => {
  const recipe = sceneRecipeWithWarning()
  const next = batchDecideRecipeScene(recipe, 'scene-001', 'approved', ISO_TIME)
  assert.equal(next.scene.drafts.find((item) => item.needsReviewReason)?.decision, 'pending')
  assert.ok(next.scene.drafts.filter((item) => !item.needsReviewReason).every(
    (item) => item.decision === 'approved',
  ))
})

test('next issue navigation is deterministic and wraps once', () => {
  const findings = healthyOrderedFindings()
  assert.equal(nextUnresolvedFinding(findings, null)?.findingId, findings[0]?.findingId)
  assert.equal(nextUnresolvedFinding(findings, findings[0]!.findingId)?.findingId, findings[1]?.findingId)
  assert.equal(nextUnresolvedFinding(findings, findings.at(-1)!.findingId)?.findingId, findings[0]?.findingId)
})
```

Also test tab switching does not mutate Recipe or shot-board state, final action availability follows Intelligence readiness, source-stale state exposes only the new-version action, legacy import is disabled for a nonempty cloud board, and manual shot edit helpers preserve Recipe provenance.

- [ ] **Step 2: Run the panel tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/components/create/StoryboardDirectorPanel.test.tsx
```

Expected: FAIL because the Recipe panel and helpers do not exist.

- [ ] **Step 3: Define the Recipe workspace props and action boundary**

```ts
export type StoryboardDirectorRecipePanelProps = {
  recipe: StoryboardDirectorRecipe | null
  availableSources: Array<{ id: string; title: string }>
  availableRecipes: Array<{ nodeId: string; recipeId: string; title: string; status: string }>
  saveState: 'local' | 'saving' | 'cloud' | 'failed'
  legacyState: LegacyDirectorStateReadResult
  onStartRecipe: (sourceNodeId: string) => void
  onOpenRecipe: (controlNodeId: string) => void
  onCommitRecipe: (recipe: StoryboardDirectorRecipe) => void
  onFocusSource: (sourceNodeId: string) => void
  onMaterializeGrouped: (kinds: Array<'scene' | 'beat' | 'shot-plan'>) => void
  onSyncShotBoard: () => void
  onCreateDraftNodes: () => void
  onImportLegacy: () => void
}
```

The component must not accept `fetch`, Provider, billing, or generation callbacks. Compatibility draft creation returns to the existing Shot List generation flow only after nodes exist; the Recipe UI itself cannot submit generation.

- [ ] **Step 4: Implement source/Recipe selection and the intelligence header**

When `recipe` is null, render two unframed lists: existing Recipe control nodes and eligible Text sources. Starting from a source uses one explicit button. Opening the Director alone must not create a node.

When a Recipe is active, render exact summary values:

```tsx
const summary = summarizeStoryboardDirectorRecipe(recipe)

<div data-testid="director-intelligence" className="grid grid-cols-2 gap-px border-y border-white/10 bg-white/10 md:grid-cols-6">
  <Metric label="场景" value={summary.approvedScenes} />
  <Metric label="节拍" value={summary.approvedBeats} />
  <Metric label="镜头" value={summary.approvedShots} />
  <Metric label="覆盖" value={`${summary.coveredBeats}/${summary.approvedBeats}`} />
  <Metric label="问题" value={summary.blockingCount + summary.advisoryCount} />
  <Metric label="状态" value={summary.ready ? '可落地' : '需处理'} />
</div>
```

Show `本地已保留`, `同步中`, `已同步到云端`, or `云端保存失败` from the real canvas save state. Do not derive a cloud-success label from local state.

- [ ] **Step 5: Implement the three-region Recipe review workspace**

Use a stable layout, not nested cards:

```tsx
<div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[180px_minmax(0,1fr)_300px]">
  <StageNavigation recipe={recipe} />
  <RecipeReviewEditor recipe={recipe} onCommit={onCommitRecipe} />
  <RecipeEvidenceInspector recipe={recipe} selectedFindingId={selectedFindingId} />
</div>
```

- Stage navigation shows source, scene, beat, and shot status.
- Review filters are a segmented control: pending, warnings, approved, rejected, all.
- Render one expanded scene group at a time; collapsed groups show counts only.
- Use Lucide icons for approve, reject, move, rerun, warning, and close controls.
- Every unfamiliar icon has `title` and `aria-label`.
- Keep button and control dimensions stable so status changes do not shift layout.
- On narrow screens, use a segmented `阶段 / 审核 / 证据` view rather than three squeezed columns.

Use local input drafts and commit to Recipe state only on field blur, Enter-confirm, explicit decision, reorder, or stage action. Do not call `onCommitRecipe` for each keystroke or pointer move.

- [ ] **Step 6: Implement stage approval, rerun, invalidation preview, and issue navigation**

The approval helper chooses exactly one state-machine function:

```ts
export function approveActiveRecipeStage(
  recipe: StoryboardDirectorRecipe,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
) {
  if (recipe.activeStage === 'scene-review') return approveSceneStage(recipe, now, runner)
  if (recipe.activeStage === 'beat-review') return approveBeatStage(recipe, now, runner)
  if (recipe.activeStage === 'shot-review') return approveShotStage(recipe, now)
  throw new TypeError('Current Recipe stage cannot be approved')
}
```

Before editing an approved scene or beat, show the exact `changeImpactForStage` counts. Confirming calls the pure update helper; canceling changes nothing. A source-stale Recipe hides apply actions and offers focus-source or explicit start-new-version actions only.

- [ ] **Step 7: Strengthen the existing Director with two tabs**

Extend the existing component props without replacing its shot-board contract:

```ts
interface StoryboardDirectorPanelProps {
  open: boolean
  state: StoryboardState
  activeShotId: string | null
  recipe: StoryboardDirectorRecipe | null
  openedFromRecipe: boolean
  availableSources: Array<{ id: string; title: string }>
  availableRecipes: Array<{ nodeId: string; recipeId: string; title: string; status: string }>
  saveState: 'local' | 'saving' | 'cloud' | 'failed'
  legacyState: LegacyDirectorStateReadResult
  // existing canvasNodes and shot-board callbacks
  onStartRecipe: (sourceNodeId: string) => void
  onOpenRecipe: (controlNodeId: string) => void
  onCommitRecipe: (recipe: StoryboardDirectorRecipe) => void
  onMaterializeGrouped: StoryboardDirectorRecipePanelProps['onMaterializeGrouped']
  onSyncShotBoard: () => void
  onCreateDraftNodes: () => void
  onImportLegacy: () => void
  onClose: () => void
}
```

Header tabs use `data-testid="storyboard-director-tab-recipe"` and `...-board`. Preserve the current Timeline and shot detail UI under `镜头板`. Add provenance links and quality markers only for `shot.recipe`; manual shots remain editable exactly as before.

Replace the text `×` close and unbind controls with Lucide `X` icons while preserving their labels and behavior. Keep cards at 8px radius or less in newly touched UI.

- [ ] **Step 8: Run panel tests GREEN**

Run the Task 5 command. Expected: all tests PASS.

- [ ] **Step 9: Run TypeScript early**

```bash
pnpm --filter web type-check
```

Expected: PASS before workspace integration.

- [ ] **Step 10: Commit Task 5**

```bash
git add apps/web/src/components/create/StoryboardDirectorPanel.tsx \
  apps/web/src/components/create/StoryboardDirectorPanel.test.tsx \
  apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx
git commit -m "feat: upgrade storyboard director recipe workspace"
```

## Task 6: Canvas Control Node, Persistence, and Tool Wiring

**Files:**

- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
- Modify: `apps/web/src/components/create/AssetAgentToolbar.tsx`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Create: `scripts/canvas-creator-skill-stage-c-static.test.mjs`

- [ ] **Step 1: Write the failing Stage C static boundary test**

Read only the Stage C files and named workspace blocks. Assert:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

const recipeFiles = [
  '../apps/web/src/lib/storyboard/recipe/identity.ts',
  '../apps/web/src/lib/storyboard/recipe/persistence.ts',
  '../apps/web/src/lib/storyboard/recipe/state-machine.ts',
  '../apps/web/src/lib/storyboard/recipe/intelligence.ts',
  '../apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.ts',
  '../apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')

test('Recipe files contain no network, Provider, billing, or generation integration', () => {
  assert.doesNotMatch(recipeFiles, /\bfetch\s*\(|axios|\/api\/generate\//)
  assert.doesNotMatch(recipeFiles, /billing|credits|wallet|ledger|payment|recharge|checkout/iu)
  assert.doesNotMatch(recipeFiles, /providerAdapter|DATABASE_URL|process\.env/)
})

test('state machine calls all Skills through the public runtime', () => {
  assert.match(stateMachine, /runner\(\s*['"]script-segmentation['"]/)
  assert.match(stateMachine, /runner\(\s*['"]narrative-beat-analysis['"]/)
  assert.match(stateMachine, /runner\(\s*['"]shot-planning['"]/)
  assert.doesNotMatch(stateMachine, /from\s+['"][^'"]+\/(parser|planner)['"]/)
})

test('workspace creates or patches only the control and derived nodes', () => {
  const start = namedBlock(workspace, 'const handleStartStoryboardDirectorRecipe', 'const handleOpenStoryboardDirectorRecipe')
  const commit = namedBlock(workspace, 'const handleCommitStoryboardDirectorRecipe', 'const handleMaterializeStoryboardDirectorRecipe')
  assert.match(start, /planStoryboardDirectorControlNode/)
  assert.match(start, /createNode\(\s*['"]text['"]/)
  assert.match(start, /parentNodeId:\s*sourceNode\.id/)
  assert.doesNotMatch(start, /handleNodePatch\(\s*sourceNode\.id/)
  assert.match(commit, /handleNodePatch\(\s*controlNode\.id/)
  assert.equal(count(commit, /flushLocalSnapshot\(\)/g), 1)
  assert.equal(count(commit, /scheduleCanvasSave\(/g), 1)
})

test('Recipe opening and review never auto-materialize or auto-generate', () => {
  const open = namedBlock(workspace, 'const handleOpenStoryboardDirectorRecipe', 'const handleCommitStoryboardDirectorRecipe')
  assert.doesNotMatch(open, /createNode|handleRegenerateNodeFromPrompt|pendingAutoGenerate/)
  assert.doesNotMatch(recipePanel, /onAutoGenerate|handleRegenerate|\/api\/generate/)
})
```

Also require exactly one `storyboard-director` node-tool entry, Text-only support, dispatch to the existing Director, stale source checking before explicit apply, evolving occupancy during grouped creation, one local flush and one scheduled save per batch, receipt recording for only successful targets, cloud Recipe state winning over legacy local state, and panel close when the active control node is deleted or project changes.

- [ ] **Step 2: Run the static test and record RED**

```bash
node --test scripts/canvas-creator-skill-stage-c-static.test.mjs
```

Expected: FAIL because Stage C is not wired.

- [ ] **Step 3: Add the Text-node route to the existing Director**

Add one registry entry:

```ts
{
  id: 'storyboard-director',
  label: '分镜导演',
  icon: '🎬',
  description: '编排剧本分场、叙事节拍与镜头规划',
  category: 'prompt-direction',
  executionType: 'panel',
  supportedKinds: ['text'],
  requiresMedia: false,
  requiresAsset: false,
  available: true,
  openActionId: 'storyboard-director',
}
```

Add `onOpenStoryboardDirector?: () => void` to `AssetAgentToolbar` and dispatch that action ID. Do not add a second component or a second top-level Director state.

- [ ] **Step 4: Add active control-node state and valid Recipe discovery**

In `VisualCanvasWorkspace` add:

```ts
const [activeDirectorControlNodeId, setActiveDirectorControlNodeId] = useState('')
const [storyboardDirectorOpenedFromRecipe, setStoryboardDirectorOpenedFromRecipe] = useState(false)

const availableDirectorRecipes = useMemo(() => nodes.flatMap((node) => {
  const read = readStoryboardDirectorRecipe(node.metadataJson)
  return read.status === 'valid'
    ? [{
        nodeId: node.id,
        recipeId: read.recipe.recipeId,
        title: node.title,
        status: read.recipe.activeStage,
      }]
    : []
}), [nodes])

const activeDirectorRecipe = useMemo(() => {
  const node = nodes.find((item) => item.id === activeDirectorControlNodeId)
  const read = readStoryboardDirectorRecipe(node?.metadataJson)
  return read.status === 'valid' ? read.recipe : null
}, [activeDirectorControlNodeId, nodes])
```

Eligible sources are current Text nodes without a valid `storyboardDirectorRecipe` payload.

- [ ] **Step 5: Implement explicit start and open handlers**

Start from a fresh source snapshot and dedupe before mutation:

```ts
const handleStartStoryboardDirectorRecipe = useCallback((sourceNodeId: string) => {
  const sourceNode = latestNodesRef.current.find((node) => node.id === sourceNodeId)
  if (!sourceNode || sourceNode.kind !== 'text' || !projectId || !workflowId) return
  const recipe = createStoryboardDirectorRecipe(
    { projectId, workflowId },
    creatorSkillSourceSnapshot(sourceNode),
    new Date().toISOString(),
  )
  const planned = planStoryboardDirectorControlNode(recipe, latestNodesRef.current)
  if (planned.status === 'conflict') {
    showCanvasFeedback('分镜导演状态冲突，请检查现有控制节点。')
    return
  }
  if (planned.status === 'existing') {
    setActiveDirectorControlNodeId(planned.nodeId)
  } else {
    const controlNode = createNode('text', {
      ...planned.plan,
      parentNodeId: sourceNode.id,
    })
    setActiveDirectorControlNodeId(controlNode.id)
    flushLocalSnapshot()
    scheduleCanvasSave(0)
  }
  setStoryboardDirectorOpenedFromRecipe(true)
  setStoryboardDirectorOpen(true)
}, [createNode, flushLocalSnapshot, projectId, scheduleCanvasSave, showCanvasFeedback, workflowId])
```

`handleOpenStoryboardDirectorRecipe` only selects an existing valid control node and opens the existing Director. It creates nothing.

- [ ] **Step 6: Implement bounded Recipe commits and source freshness**

Merge metadata without dropping unrelated control-node fields:

```ts
const handleCommitStoryboardDirectorRecipe = useCallback((nextRecipe: StoryboardDirectorRecipe) => {
  const controlNode = latestNodesRef.current.find((node) => node.id === activeDirectorControlNodeId)
  if (!controlNode) return
  const liveSource = latestNodesRef.current.find((node) => node.id === nextRecipe.sourceNode.id)
  const freshRecipe = liveSource?.kind === 'text'
    ? markRecipeSourceFreshness(nextRecipe, creatorSkillSourceSnapshot(liveSource), new Date().toISOString())
    : markRecipeSourceMissing(nextRecipe, new Date().toISOString())
  handleNodePatch(controlNode.id, {
    prompt: storyboardDirectorRecipeSummary(freshRecipe),
    metadataJson: {
      ...metadataRecord(controlNode.metadataJson),
      ...storyboardDirectorRecipeMetadata(freshRecipe),
    },
  })
  flushLocalSnapshot()
  scheduleCanvasSave()
}, [activeDirectorControlNodeId, flushLocalSnapshot, handleNodePatch, scheduleCanvasSave])
```

The UI commits only on explicit decisions, reorders, blur, stage actions, import, sync, or materialization receipt updates, so this callback cannot create a keystroke PUT storm.

- [ ] **Step 7: Use cloud Recipe shot-board state as source of truth**

Compute the Director board passed to the existing panel:

```ts
const effectiveDirectorState = activeDirectorRecipe
  ? activeDirectorRecipe.storyboard
  : directorState
```

When a Recipe is active, `onStateChange` patches `activeDirectorRecipe.storyboard` through `handleCommitStoryboardDirectorRecipe`; it must not call `writeDirectorState`. When no Recipe is active, preserve the existing local manual Director behavior.

Offer legacy import only from `readLegacyDirectorState(projectId)`. Import is explicit and blocked when the cloud board is nonempty.

- [ ] **Step 8: Implement explicit grouped materialization with stale guard and receipts**

Before planning, re-read the control node and live source. If either identity changed, close or refresh the review and create nothing. Use current-node occupancy and create plans in order:

```ts
const handleMaterializeStoryboardDirectorRecipe = useCallback((kinds) => {
  const context = currentStoryboardRecipeContext()
  if (!context || !isLiveStoryboardRecipeContext(context)) return
  const plans = planStoryboardDirectorGroupedNodes(
    context.recipe,
    kinds,
    latestNodesRef.current,
  )
  const occupancy = [...latestNodesRef.current]
  const completed = []
  try {
    for (const plan of plans.create) {
      const position = nextDirectorPlanPosition(context.controlNode, occupancy)
      const node = createNode('text', {
        ...plan,
        parentNodeId: context.controlNode.id,
        position,
      })
      occupancy.push(node)
      completed.push(receiptFromCreatedPlan(context.recipe, plan, node.id))
    }
  } finally {
    if (completed.length) {
      handleCommitStoryboardDirectorRecipe(recordStoryboardDirectorReceipts(
        context.recipe,
        completed,
        new Date().toISOString(),
      ))
    }
  }
}, [createNode, handleCommitStoryboardDirectorRecipe])
```

Define the local context helpers in the same workspace block:

```ts
type LiveStoryboardRecipeContext = {
  controlNode: VisualCanvasNode
  sourceNode: VisualCanvasNode
  recipe: StoryboardDirectorRecipe
}

function creatorSkillSourceSnapshot(node: VisualCanvasNode): CreatorSkillSourceNode {
  return {
    id: node.id,
    kind: 'text',
    title: node.title,
    prompt: node.prompt ?? '',
    ...(typeof node.resultText === 'string' ? { resultText: node.resultText } : {}),
  }
}

const currentStoryboardRecipeContext = (): LiveStoryboardRecipeContext | null => {
  const controlNode = latestNodesRef.current.find((node) => node.id === activeDirectorControlNodeId)
  const read = readStoryboardDirectorRecipe(controlNode?.metadataJson)
  if (!controlNode || read.status !== 'valid') return null
  const sourceNode = latestNodesRef.current.find((node) => node.id === read.recipe.sourceNode.id)
  if (!sourceNode || sourceNode.kind !== 'text') return null
  return { controlNode, sourceNode, recipe: read.recipe }
}

const isLiveStoryboardRecipeContext = (context: LiveStoryboardRecipeContext) => {
  const identity = createStoryboardDirectorRecipeIdentity(
    { projectId: context.recipe.projectId, workflowId: context.recipe.workflowId },
    creatorSkillSourceSnapshot(context.sourceNode),
  )
  return identity.recipeId === context.recipe.recipeId
    && identity.sourceFingerprint === context.recipe.sourceFingerprint
}

const receiptFromCreatedPlan = (
  recipe: StoryboardDirectorRecipe,
  plan: GroupedSkillNodePlan,
  targetId: string,
) => ({
  identity: createRecipeMaterializationIdentity(
    recipe.recipeId,
    plan.metadataJson.creatorSkill.resultType === 'shot-plan'
      ? 'shot-plan'
      : plan.metadataJson.creatorSkill.resultType === 'narrative-beat-map'
        ? 'beat'
        : 'scene',
    plan.metadataJson.creatorSkill.approvedArtifact!.artifactId,
    plan.resultId,
  ),
  kind: plan.metadataJson.creatorSkill.resultType === 'shot-plan'
    ? 'shot-plan' as const
    : plan.metadataJson.creatorSkill.resultType === 'narrative-beat-map'
      ? 'beat' as const
      : 'scene' as const,
  resultId: plan.resultId,
  targetId,
})
```

For placement, call the existing `resolveNonOverlappingPosition` directly with a candidate to the right of the control node and the evolving `occupancy` list, then push every created node into that list. Do not add a second placement engine.

On partial failure, show created and uncreated counts, lock the active batch in Recipe state, and require inspection. Do not auto-delete created nodes or blindly rerun.

- [ ] **Step 9: Implement explicit shot-board sync and draft-node creation**

Shot-board sync calls the pure planner and commits the returned Recipe. Draft creation scans current metadata, creates only returned plans, records only successful IDs, flushes once, and schedules one save. It does not set `pendingAutoGenerateIds` and does not open generation automatically.

The existing generation confirmation remains available when the user later opens an Image/Video draft node through the existing flow.

- [ ] **Step 10: Render the upgraded Director and close stale contexts**

Pass Recipe, source list, Recipe list, save state, legacy state, and explicit callbacks to `StoryboardDirectorPanel`. Opening from the Text node action calls `handleStartStoryboardDirectorRecipe(node.id)`. The existing topbar Director button opens with `openedFromRecipe: false` and creates nothing.

When the active control node is deleted or the project/workflow changes, clear `activeDirectorControlNodeId`, close the Director, and discard stale operation tokens. Deleting a source marks its Recipe blocked; it does not delete the control or derived nodes.

- [ ] **Step 11: Run Stage C static test GREEN**

```bash
node --test scripts/canvas-creator-skill-stage-c-static.test.mjs
```

Expected: all Stage C static assertions PASS.

- [ ] **Step 12: Run all Stage A/B static regressions**

```bash
node --test \
  scripts/canvas-creator-skill-engine-static.test.mjs \
  scripts/canvas-creator-skill-panel-static.test.mjs \
  scripts/canvas-creator-skill-stage-b-static.test.mjs \
  scripts/canvas-creator-skill-stage-c-static.test.mjs
```

Expected: all static tests PASS.

- [ ] **Step 13: Commit Task 6**

```bash
git add apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts \
  apps/web/src/components/create/AssetAgentToolbar.tsx \
  apps/web/src/components/create/VisualCanvasWorkspace.tsx \
  scripts/canvas-creator-skill-stage-c-static.test.mjs
git commit -m "feat: wire storyboard director recipe into canvas"
```

## Task 7: Full Automated Verification and Forbidden-Zone Audit

**Files:**

- Modify only files already named if a verified failure requires a scoped correction.

- [ ] **Step 1: Run the full focused Stage A/B/C suite**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/fingerprint.test.ts \
  src/lib/skills/runtime.test.ts \
  src/lib/skills/approvedArtifacts.test.ts \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts \
  src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts \
  src/lib/skills/shot-planning/shotPlanning.test.ts \
  src/lib/storyboard/recipe/recipePersistence.test.ts \
  src/lib/storyboard/recipe/stateMachine.test.ts \
  src/lib/storyboard/recipe/intelligence.test.ts \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts \
  src/components/create/canvas/skills/groupedSkillMaterialization.test.ts \
  src/components/create/canvas/skills/storyboardDirectorMaterialization.test.ts \
  src/components/create/ShotListBuilderPanel.test.tsx \
  src/components/create/StoryboardDirectorPanel.test.tsx
cd ../..
node --test \
  scripts/canvas-creator-skill-engine-static.test.mjs \
  scripts/canvas-creator-skill-panel-static.test.mjs \
  scripts/canvas-creator-skill-stage-b-static.test.mjs \
  scripts/canvas-creator-skill-stage-c-static.test.mjs
```

Expected: all focused tests PASS with zero skipped Stage C tests.

- [ ] **Step 2: Run repository validation**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits 0. Existing lint warnings may be recorded but no new Stage C warning is accepted.

- [ ] **Step 3: Audit exact changed files and forbidden zones**

Set the execution baseline to the plan commit recorded before Task 1:

```bash
git diff --name-only "$STAGE_C_BASE_SHA"..HEAD
git diff --name-only "$STAGE_C_BASE_SHA"..HEAD | \
  rg '(^|/)(prisma|migrations|\.env)|api/generate/(image|video)|provider|billing|credits|wallet|ledger|payment|recharge|checkout|cn-executor|package\.json|pnpm-lock\.yaml|next\.config\.js' \
  && exit 1 || true
git diff --check "$STAGE_C_BASE_SHA"..HEAD
```

Expected: only approved Stage C implementation and test files are listed; the forbidden search prints nothing.

- [ ] **Step 4: Check source immutability and network boundaries semantically**

```bash
rg -n "handleNodePatch\(|commitNodes\(" \
  apps/web/src/lib/storyboard/recipe \
  apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx || true
rg -n "fetch\(|axios|/api/generate/|billing|credits|wallet|ledger|payment|recharge|checkout|providerAdapter|process\.env" \
  apps/web/src/lib/storyboard/recipe \
  apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.ts \
  apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx || true
```

Expected: both searches return no implementation match. Workspace mutation is separately constrained by the Stage C static test.

- [ ] **Step 5: Perform the required code-review workflow**

Review the complete implementation for:

- identity stability and timestamp independence;
- strict metadata parsing and size bounds;
- public Skill runtime use;
- correct approved Artifact lineage;
- source immutability and precise invalidation;
- cloud Recipe precedence over legacy local state;
- duplicate prevention and partial-failure receipts;
- no keystroke or pointer-move save storm;
- accessibility, focus, overflow, and responsive layout;
- accidental Generate, Provider, Billing, Schema, or env boundary changes.

Resolve every P0/P1 finding in scope, rerun the focused suite and repository gates, and commit corrections separately with a descriptive message.

- [ ] **Step 6: Verify clean implementation history**

```bash
git status --short
git log --oneline -15
git diff --stat "$STAGE_C_BASE_SHA"..HEAD
```

Expected: worktree clean; implementation commits are focused and reviewable.

## Task 8: Authenticated Chrome QA, Production Deployment, and Closeout

**Files:**

- Modify after Production QA: `docs/CURRENT_STATUS.md`
- Modify after Production QA: `docs/NEXT_TASKS.md`
- Temporary screenshots: `/tmp/creator-city-stage-c-*.png`

- [ ] **Step 1: Run local or Preview browser QA before pushing main**

Use Google Chrome and an existing authorized QA account. Do not modify env files. In a disposable QA project:

1. Create a two-scene Text source with setup, action, reaction, and turn evidence.
2. Open NodeToolCenter and choose the existing `分镜导演` entry.
3. Verify exactly one visible Director control node is created and the source remains unchanged.
4. Verify Scene review opens with every item pending and exact source evidence.
5. Edit one scene field on blur, approve/reject items, approve the stage, and verify Beat review opens automatically.
6. Review beats, approve the stage, and verify Shot review opens automatically.
7. Verify Director Intelligence counts, coverage, and one explainable advisory.
8. Close the Director, refresh, reopen the control node, and resume the same stage.
9. Edit an approved scene and verify the exact beat/shot invalidation preview before confirming.
10. Change the source Text and verify `source-stale` blocks apply.
11. Restore a fresh Recipe version and reach final readiness.
12. Materialize grouped Scene, Beat, and Shot Plan nodes; repeat and verify no duplicates.
13. Add one manual shot, sync approved shots, repeat, and verify the manual shot remains exactly once.
14. Create compatibility Image/Video draft nodes, repeat, and verify no duplicate drafts.
15. Open one draft's existing generation dialog, verify the existing second confirmation, and cancel before submission.
16. Manually save, refresh, and verify the control node, Recipe, shot board, provenance, and receipts restore.

Capture at least:

- `/tmp/creator-city-stage-c-recipe-review.png`
- `/tmp/creator-city-stage-c-intelligence.png`
- `/tmp/creator-city-stage-c-shot-board.png`
- `/tmp/creator-city-stage-c-reload.png`

Check desktop and one narrow viewport for clipped text, overlapping controls, inaccessible close actions, and incoherent panel resizing.

- [ ] **Step 2: Verify local/Preview Network, Console, and performance boundaries**

During the complete Recipe path require:

- automatic `/api/generate/*`: 0
- Provider requests: 0
- Billing/Credits/Wallet/Payment mutations: 0
- asset uploads: 0
- Recipe analysis network requests: 0
- Canvas PUT during pointer movement or typing: 0
- bounded Canvas PUT after explicit commit: no storm
- React uncaught exceptions: 0
- hydration errors: 0
- unhandled rejections: 0
- Product API 5xx introduced by Stage C: 0

Repeat review navigation with supported 20-scene and 40-scene fixtures. Record wall-clock observations and request counts; do not claim a performance PASS if Chrome instrumentation cannot observe them. Classify tooling, auth, environment, and product failures separately.

- [ ] **Step 3: Push implementation commits and verify remote SHA**

```bash
git status --short
git rev-parse HEAD
git push origin main
git ls-remote origin refs/heads/main
```

Expected: worktree clean and local/remote SHA equal.

- [ ] **Step 4: Wait for the exact Vercel Production deployment**

Use the existing linked Vercel project. Match the deployment's Git commit SHA to the pushed implementation SHA and wait until status is `Ready`. Do not modify environment variables, promote an unrelated deployment, or claim success from a Preview deployment.

- [ ] **Step 5: Run the authenticated Production Chrome Golden Path**

At <https://creator-city-vert.vercel.app>, repeat:

- start from Text and create/open exactly one Recipe control node;
- scene approval -> automatic beat review;
- beat approval -> automatic shot review;
- source evidence and Intelligence findings;
- close/refresh/project reopen recovery;
- source-stale blocking and new version;
- grouped materialization and repeat dedupe;
- manual plus Recipe shot-board sync and repeat dedupe;
- compatibility drafts without generation;
- generation confirmation opened and canceled;
- cloud save and reload restoration.

Use a second authenticated Chrome profile or independent authenticated browser context to verify the Recipe and shot board restore from cloud metadata rather than `localStorage`. If independent authentication is unavailable, status remains blocked for the cross-browser release gate; do not substitute same-profile refresh.

- [ ] **Step 6: Verify Production Network, Console, and screenshots**

Require the same zero-mutation boundaries as Step 2. Capture final Production screenshots and record exact request counts when the browser tooling exposes them. A Chrome bridge limitation is `QA_HARNESS_LIMITATION`, not a product PASS or product failure.

- [ ] **Step 7: Update the two status documents only after Production passes**

Add to `docs/CURRENT_STATUS.md`:

```text
P0-CANVAS-CREATOR-SKILL-ENGINE-STAGE-C-STORYBOARD-DIRECTOR-RECIPE:
STAGE_C_VALIDATED / CLOSED

- existing Storyboard Director strengthened; no duplicate Director
- Script Segmentation, Narrative Beat Analysis, and Shot Planning remain independently callable
- approved-stage automatic local progression and human review gates validated
- cloud Recipe control node, source-stale invalidation, Director Intelligence, grouped apply, shot-board sync, draft dedupe, save/reload, and second-browser recovery validated
- no Generate/Provider/Billing/Schema/env changes and no automatic billable request
```

Add or update one Stage C row in `docs/NEXT_TASKS.md` with implementation commits, exact test counts, Production SHA, browser evidence, and remaining P1/P2 issues. Keep the next task listed but do not begin it.

- [ ] **Step 8: Validate and commit docs-only closeout**

```bash
git diff --check
git diff --stat
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git diff --cached --stat
git commit -m "docs: close creator skill engine stage c"
git push origin main
```

- [ ] **Step 9: Wait for docs deployment and verify final Git state**

Require the docs commit's exact Vercel deployment to reach `Ready`, then run:

```bash
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Expected: local `main` equals `origin/main` and worktree is clean.

## Completion Evidence

The final report must include:

- implementation and docs commit SHAs;
- exact Vercel Production deployment SHA and Ready status;
- changed-file list and forbidden-zone audit;
- focused test counts, type-check, lint, build, and diff-check;
- local/Preview and Production Google Chrome results;
- screenshot paths;
- Network and Console counts or an explicit harness limitation;
- proof that the existing Director was strengthened rather than duplicated;
- proof that all three Skills remain independently callable;
- proof of automatic analysis progression with manual approval gates;
- proof of cloud and independent-browser recovery;
- proof of source immutability, source-stale blocking, and downstream invalidation;
- proof of grouped, shot-board, and draft deduplication;
- proof that no automatic Provider or billable request occurred;
- remaining P0/P1/P2 issues;
- explicit statement that no next task was started.
