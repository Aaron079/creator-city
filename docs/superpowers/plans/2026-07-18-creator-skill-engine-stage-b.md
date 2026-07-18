# Creator Skill Engine Stage B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Narrative Beat Analysis and replace the existing Shot List Builder's shallow planning core with the independently callable Shot Planning Skill while preserving approved Artifact handoff, grouped canvas materialization, and explicit legacy draft/generate actions.

**Architecture:** Add two strongly typed executable Skills under `apps/web/src/lib/skills`, plus a guarded approved-Artifact metadata reader. Reuse the generic Creator Skill review shell, materialize one approved Text node per scene, and migrate the existing Shot List Builder to consume `shot-planning` rather than introducing a duplicate tool. Keep all analysis local and deterministic; existing media generation remains an explicit, separately confirmed downstream callback.

**Tech Stack:** TypeScript, React, Next.js App Router, Node test runner through `tsx`, existing Creator Skill runtime, existing canvas node/edge persistence, Lucide icons, Chrome authenticated QA, Vercel.

---

## Scope and File Map

Create:

- `apps/web/src/lib/skills/approved-artifacts.ts` - guarded extraction and canonical cloning of approved Artifacts from node metadata.
- `apps/web/src/lib/skills/approvedArtifacts.test.ts` - metadata absence, corruption, accessor, and canonical Artifact tests.
- `apps/web/src/lib/skills/narrative-beat-analysis/types.ts` - `narrative-beat-map` payload contract.
- `apps/web/src/lib/skills/narrative-beat-analysis/parser.ts` - deterministic source-unit and beat classification rules.
- `apps/web/src/lib/skills/narrative-beat-analysis/index.ts` - manifest and executable Skill.
- `apps/web/src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts` - public Skill contract and limit tests.
- `apps/web/src/lib/skills/shot-planning/types.ts` - `shot-plan` payload and normalized option contract.
- `apps/web/src/lib/skills/shot-planning/planner.ts` - deterministic evidence-backed shot planning rules.
- `apps/web/src/lib/skills/shot-planning/index.ts` - manifest and executable Skill.
- `apps/web/src/lib/skills/shot-planning/shotPlanning.test.ts` - direct Text, Artifact, option, evidence, and limit tests.
- `apps/web/src/components/create/canvas/skills/groupedSkillMaterialization.ts` - guarded grouped-plan validation, approved Artifact construction, and dedupe.
- `apps/web/src/components/create/canvas/skills/groupedSkillMaterialization.test.ts` - grouped apply contract tests.
- `apps/web/src/components/create/canvas/skills/NarrativeBeatAnalysisPanel.tsx` - local review state and grouped narrative apply UI.
- `apps/web/src/components/create/ShotListBuilderPanel.test.tsx` - upgraded Shot List Builder state and compatibility tests.
- `scripts/canvas-creator-skill-stage-b-static.test.mjs` - Stage B wiring, compatibility, and forbidden-network static boundaries.

Modify:

- `apps/web/src/lib/skills/types.ts` - shared approved metadata and review item types only where genuinely shared.
- `apps/web/src/lib/skills/artifacts.ts` - export a canonical Artifact clone helper used by metadata extraction.
- `apps/web/src/lib/skills/executable-registry.ts` - register both Stage B Skills.
- `apps/web/src/lib/skills/index.ts` - export Stage B public contracts.
- `apps/web/src/lib/skills/runtime.test.ts` - expect all three executable Skills and preserve runtime boundaries.
- `apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.ts` - embed approved single-scene `scene-breakdown` Artifacts.
- `apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts` - verify new metadata and backward-compatible provenance.
- `apps/web/src/components/create/ShotListBuilderPanel.tsx` - use `shot-planning`, the generic review shell, grouped apply, and approved-only compatibility actions.
- `apps/web/src/lib/canvas/shot-list.ts` - retain presentation/report types and remove the filler-driven planning path.
- `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts` - add Narrative Beat Analysis and expose the existing Shot List Builder for Text nodes.
- `apps/web/src/components/canvas/modal/canvasModalTypes.ts` - add only the narrative modal ID; reuse `shot-list-builder`.
- `apps/web/src/components/create/AssetAgentToolbar.tsx` - dispatch narrative analysis and the existing Shot List Builder callbacks.
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx` - source snapshots, panels, grouped creation, compatibility draft metadata, persistence, and stale guards.
- `scripts/canvas-creator-skill-engine-static.test.mjs` - update existing registry and Stage A metadata expectations.
- `scripts/canvas-creator-skill-panel-static.test.mjs` - preserve generic review-shell and Stage A panel contracts.
- `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` - update only after implementation and Production QA pass.

Forbidden throughout execution:

- Prisma schema, migrations, environment files, Production DB
- Generate routes, Provider adapters, BYOK semantics
- Billing, Credits, Wallet, Ledger, Payment, Recharge, Checkout
- cn-executor, package files, lockfile, `next.config.js`
- real Provider calls and real payments

## Task 1: Approved Artifact Metadata Contract

**Files:**

- Create: `apps/web/src/lib/skills/approvedArtifacts.test.ts`
- Create: `apps/web/src/lib/skills/approved-artifacts.ts`
- Modify: `apps/web/src/lib/skills/artifacts.ts`
- Modify: `apps/web/src/lib/skills/types.ts`
- Modify: `apps/web/src/lib/skills/index.ts`

- [ ] **Step 1: Write the failing metadata contract tests**

Add tests that exercise absent, valid, malformed, inherited, accessor-backed, and mutation-isolation behavior:

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createCreatorSkillArtifact } from './artifacts'
import { readApprovedCreatorSkillArtifact } from './approved-artifacts'

const artifact = createCreatorSkillArtifact({
  artifactId: 'narrative-beat-map-scene-001',
  artifactType: 'narrative-beat-map',
  artifactVersion: 1,
  sourceNodeIds: ['source-1'],
  sourceArtifactIds: ['narrative-beat-map-001'],
  payload: { scenes: [{ sceneId: 'scene-001', beats: [] }] },
})

describe('readApprovedCreatorSkillArtifact', () => {
  test('distinguishes absent, valid, and invalid metadata', () => {
    assert.deepEqual(readApprovedCreatorSkillArtifact(undefined), { status: 'absent' })
    const valid = readApprovedCreatorSkillArtifact({ creatorSkill: { approvedArtifact: artifact } })
    assert.equal(valid.status, 'valid')
    assert.notEqual(valid.status === 'valid' ? valid.artifact : null, artifact)
    assert.equal(
      readApprovedCreatorSkillArtifact({ creatorSkill: { approvedArtifact: { artifactId: '' } } }).status,
      'invalid',
    )
  })

  test('does not execute inherited or accessor-backed metadata', () => {
    const inherited = Object.create({ creatorSkill: { approvedArtifact: artifact } })
    assert.deepEqual(readApprovedCreatorSkillArtifact(inherited), { status: 'absent' })
    const metadata = Object.create(null)
    Object.defineProperty(metadata, 'creatorSkill', { get() { throw new Error('must not run') } })
    assert.equal(readApprovedCreatorSkillArtifact(metadata).status, 'invalid')
  })
})
```

- [ ] **Step 2: Run the test and record RED**

Run:

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/skills/approvedArtifacts.test.ts
```

Expected: FAIL because `approved-artifacts.ts` does not exist.

- [ ] **Step 3: Add the shared approved metadata types and guarded reader**

Add this public result contract to `approved-artifacts.ts` and implement reads with own property descriptors only:

```ts
export type ApprovedArtifactReadResult =
  | { status: 'absent' }
  | { status: 'valid'; artifact: CreatorSkillArtifact }
  | { status: 'invalid'; issue: CreatorSkillIssue }

export function readApprovedCreatorSkillArtifact(
  metadataJson: unknown,
): ApprovedArtifactReadResult {
  if (!isRecord(metadataJson)) return { status: 'absent' }
  const creatorSkill = ownData(metadataJson, 'creatorSkill')
  if (creatorSkill === MISSING) return { status: 'absent' }
  if (!isRecord(creatorSkill)) return invalid('APPROVED_ARTIFACT_INVALID')
  const value = ownData(creatorSkill, 'approvedArtifact')
  if (value === MISSING) return { status: 'absent' }
  try {
    return { status: 'valid', artifact: cloneCreatorSkillArtifact(value) }
  } catch {
    return invalid('APPROVED_ARTIFACT_INVALID')
  }
}
```

Export `cloneCreatorSkillArtifact(value: unknown)` from `artifacts.ts`. It must validate with `isCreatorSkillArtifact`, clone source ID arrays and recursively clone the payload using the same supported plain-data constraints as runtime input normalization. Add an optional `approvedArtifact: CreatorSkillArtifact` field to the shared creator-Skill metadata type; do not loosen the rest of the metadata contract.

Define the shared metadata surface in `types.ts` and replace the Stage A materializer's local duplicate in Task 5:

```ts
export type CreatorSkillNodeMetadata = {
  creatorSkill: {
    skillId: string
    skillVersion: string
    runFingerprint: string
    sourceNodeIds: string[]
    sourceArtifactIds: string[]
    resultType: string
    resultId: string
    reviewStatus: 'approved'
    evidence: CreatorSkillEvidence[]
    approvedArtifact?: CreatorSkillArtifact
  }
}
```

Reuse the existing `CreatorSkillReviewStatus = 'pending' | 'approved' | 'rejected'` for panel decisions. Do not introduce a second review-status union.

- [ ] **Step 4: Run approved Artifact tests GREEN**

Run the Task 1 command. Expected: all tests PASS.

- [ ] **Step 5: Run existing Artifact and runtime regressions**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/skills/fingerprint.test.ts src/lib/skills/runtime.test.ts
```

Expected: existing tests PASS before registry expectations are changed in Task 4.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/web/src/lib/skills
git commit -m "feat: add approved creator skill artifact contract"
```

## Task 2: Narrative Beat Analysis Skill

**Files:**

- Create: `apps/web/src/lib/skills/narrative-beat-analysis/types.ts`
- Create: `apps/web/src/lib/skills/narrative-beat-analysis/parser.ts`
- Create: `apps/web/src/lib/skills/narrative-beat-analysis/index.ts`
- Create: `apps/web/src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts`
- Modify: `apps/web/src/lib/skills/index.ts`

- [ ] **Step 1: Write the public contract and behavior tests**

Define fixtures for Chinese, English, direct Text, and `scene-breakdown`. Assert this exact payload surface:

```ts
export type NarrativeBeatType =
  | 'setup'
  | 'goal'
  | 'action'
  | 'reaction'
  | 'turn'
  | 'closure'
  | 'unclassified'

export type NarrativeBeatDraft = {
  beatId: string
  sceneId: string
  order: number
  type: NarrativeBeatType
  sourceText: string
  summary: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending'
  needsReviewReason?: string
}

export type NarrativeBeatMapPayload = {
  scenes: Array<{
    sceneId: string
    order: number
    heading: string
    beats: NarrativeBeatDraft[]
  }>
}
```

Use this exact fixture and projection:

```ts
const source = [
  '外景 天台 夜',
  '林夏想要在暴雨前修好天线。',
  '然而电源突然熄灭。',
].join('\n')
const result = runWithText(source)
const payload = result.artifacts[0]?.payload as NarrativeBeatMapPayload
assert.deepEqual(payload.scenes[0]?.beats.map((beat) => ({
  beatId: beat.beatId,
  order: beat.order,
  type: beat.type,
  sourceText: beat.sourceText,
  summary: beat.summary,
  lineStart: beat.lineStart,
  lineEnd: beat.lineEnd,
  reviewStatus: beat.reviewStatus,
})), [
  {
    beatId: 'scene-001-beat-001', order: 1, type: 'setup',
    sourceText: '外景 天台 夜', summary: '外景 天台 夜',
    lineStart: 1, lineEnd: 1, reviewStatus: 'pending',
  },
  {
    beatId: 'scene-001-beat-002', order: 2, type: 'goal',
    sourceText: '林夏想要在暴雨前修好天线。', summary: '林夏想要在暴雨前修好天线。',
    lineStart: 2, lineEnd: 2, reviewStatus: 'pending',
  },
  {
    beatId: 'scene-001-beat-003', order: 3, type: 'turn',
    sourceText: '然而电源突然熄灭。', summary: '然而电源突然熄灭。',
    lineStart: 3, lineEnd: 3, reviewStatus: 'pending',
  },
])
assert.equal(unclassified.status, 'needs-review')
assert.equal(unclassified.warnings[0]?.code, 'NARRATIVE_BEAT_UNCLASSIFIED')
assert.equal(over120.status, 'blocked')
assert.equal(over120.blockers[0]?.code, 'NARRATIVE_BEAT_LIMIT_EXCEEDED')
assert.deepEqual(runAgain, firstRun)
```

Also test Artifact-only execution with `sourceNodes: []`, conflict rejection when Text and Artifact disagree, 40-scene acceptance, 41-scene rejection, and exact one-to-one evidence IDs.

- [ ] **Step 2: Run Narrative Beat tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts
```

Expected: FAIL because the Skill module does not exist.

- [ ] **Step 3: Implement deterministic source segmentation and classification**

Use ordered cue rules so the same segment cannot receive multiple types:

```ts
const CUES: ReadonlyArray<[NarrativeBeatType, RegExp]> = [
  ['turn', /但是|然而|却|突然|不料|反而|but\b|however\b|suddenly\b|instead\b/iu],
  ['goal', /想要|必须|决定|试图|希望|目标|want(?:s|ed)?\b|must\b|decides?\b|tries?\b|goal\b/iu],
  ['reaction', /反应|愣住|震惊|哭|笑|退后|沉默|reacts?\b|stares?\b|gasps?\b|smiles?\b|cries?\b/iu],
  ['closure', /最终|终于|结束|离开|消失|落幕|finally\b|ends?\b|leaves?\b|fades?\b/iu],
  ['action', /走|跑|拿|推|拉|打开|关闭|看向|进入|冲|walks?\b|runs?\b|takes?\b|opens?\b|closes?\b|enters?\b/iu],
]

export function classifyNarrativeUnit(
  unit: SourceUnit,
  index: number,
): NarrativeBeatType {
  for (const [type, pattern] of CUES) if (pattern.test(unit.text)) return type
  if (index === 0 && /内景|外景|场景|INT\.?|EXT\.?|清晨|夜|房间|街道|room\b|street\b|night\b/iu.test(unit.text)) {
    return 'setup'
  }
  return 'unclassified'
}
```

`splitSourceUnits` must preserve 1-based line numbers, split only on explicit line/sentence boundaries, skip blank units, and never synthesize text. Scene Artifact parsing must preserve scene order and line ranges. Build `scene-001-beat-001` IDs and `narrative-beat-evidence-001-001` evidence IDs from order only.

- [ ] **Step 4: Implement the manifest and executable Skill**

```ts
export const NARRATIVE_BEAT_ANALYSIS_MANIFEST: CreatorSkillManifest = {
  id: 'narrative-beat-analysis',
  version: '1.0.0',
  name: '叙事节拍分析',
  description: '识别可审核的建立、目标、行动、反应、转折与收束',
  category: 'story',
  executionPolicy: 'deterministic-local',
  acceptedNodeKinds: ['text'],
  acceptedArtifactTypes: ['scene-breakdown'],
  outputArtifactTypes: ['narrative-beat-map'],
  independentlyCallable: true,
}
```

The executable must return no Artifact for blocked input, one `narrative-beat-map-001` Artifact for valid input, `needs-review` when at least one beat is unclassified, and one evidence entry per beat.

- [ ] **Step 5: Run Narrative Beat tests GREEN**

Run the Task 2 command. Expected: all tests PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/web/src/lib/skills/narrative-beat-analysis apps/web/src/lib/skills/index.ts
git commit -m "feat: add narrative beat analysis skill"
```

## Task 3: Shot Planning Skill

**Files:**

- Create: `apps/web/src/lib/skills/shot-planning/types.ts`
- Create: `apps/web/src/lib/skills/shot-planning/planner.ts`
- Create: `apps/web/src/lib/skills/shot-planning/index.ts`
- Create: `apps/web/src/lib/skills/shot-planning/shotPlanning.test.ts`
- Modify: `apps/web/src/lib/skills/index.ts`

- [ ] **Step 1: Write failing direct and Artifact input tests**

Use this contract:

```ts
export type PlannedShotSize = 'wide' | 'full' | 'medium' | 'close' | 'extreme-close'
export type ShotOutputKind = 'image' | 'video'
export type ShotPlanningOptions = {
  requestedShotCount: number
  outputMode: 'image' | 'video' | 'mixed'
  pacing: 'slow_cinematic' | 'standard' | 'fast_social'
  shotSizeStrategy: 'auto' | 'wide_to_close' | 'close_heavy' | 'wide_heavy'
  userInstruction: string
}
export type ShotPlanDraft = {
  shotId: string
  sceneId: string
  beatId?: string
  order: number
  objective: string
  subject: string
  action: string
  suggestedShotSize: PlannedShotSize
  sourceText: string
  lineStart: number
  lineEnd: number
  outputKind: ShotOutputKind
  duration: 5 | 10
  reviewStatus: 'pending'
  needsReviewReason?: string
}
export type ShotPlanPayload = {
  scenes: Array<{ sceneId: string; order: number; heading: string; shots: ShotPlanDraft[] }>
}
```

Tests must prove:

- one primary shot per beat;
- an explicit reaction or turn can add one evidence-backed supplemental shot;
- no supplemental shot appears without a matching source clause;
- a requested count larger than evidence returns fewer shots plus `SHOT_COUNT_TARGET_UNDERSUPPLIED`;
- a requested count below explicit beat count preserves all primary shots plus `SHOT_COUNT_TARGET_EXCEEDED`;
- no description equals any old filler string;
- direct Text, `scene-breakdown`, and `narrative-beat-map` all work independently;
- malformed or conflicting input blocks;
- 120 shots pass and 121 block;
- repeated normalized input is deeply equal.

- [ ] **Step 2: Run Shot Planning tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/skills/shot-planning/shotPlanning.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement option normalization and evidence-backed planning**

Normalize only plain values and clamp the requested target to `1..120`:

```ts
export function normalizeShotPlanningOptions(value: Record<string, unknown> | undefined): ShotPlanningOptions {
  const requested = Number(value?.requestedShotCount ?? 5)
  return {
    requestedShotCount: Number.isInteger(requested) ? Math.min(120, Math.max(1, requested)) : 5,
    outputMode: isOutputMode(value?.outputMode) ? value.outputMode : 'mixed',
    pacing: isPacing(value?.pacing) ? value.pacing : 'standard',
    shotSizeStrategy: isStrategy(value?.shotSizeStrategy) ? value.shotSizeStrategy : 'auto',
    userInstruction: typeof value?.userInstruction === 'string' ? value.userInstruction.trim() : '',
  }
}
```

Implement the automatic size decision in this priority order:

```ts
export function chooseShotSize(unit: ShotSourceUnit): PlannedShotSize {
  if (/特写|眼睛|手指|细节|表情|extreme close|insert\b/iu.test(unit.text)) return 'extreme-close'
  if (/反应|愣住|震惊|哭|笑|reaction\b|gasps?\b|smiles?\b/iu.test(unit.text)) return 'close'
  if (/环境|城市|街道|房间|全貌|establishing|landscape|street\b|room\b/iu.test(unit.text)) return 'wide'
  if (/全身|站起|奔跑|走过|full body|runs?\b|walks?\b/iu.test(unit.text)) return 'full'
  return 'medium'
}
```

`objective`, `subject`, and `action` must be derived from source text or Artifact fields. When a reliable subject or action cannot be isolated, preserve the source unit as `action`, leave `subject` empty, attach `needsReviewReason`, and return `needs-review`. Never insert a generic character, object, motivation, transition, reaction, or ending.

- [ ] **Step 4: Implement Shot Planning manifest and result assembly**

```ts
export const SHOT_PLANNING_MANIFEST: CreatorSkillManifest = {
  id: 'shot-planning',
  version: '1.0.0',
  name: '分镜清单生成器',
  description: '根据明确叙事证据规划可审核镜头',
  category: 'camera',
  executionPolicy: 'deterministic-local',
  acceptedNodeKinds: ['text'],
  acceptedArtifactTypes: ['scene-breakdown', 'narrative-beat-map'],
  outputArtifactTypes: ['shot-plan'],
  independentlyCallable: true,
}
```

Create one `shot-plan-001` Artifact and stable `scene-001-shot-001` IDs. Supplemental shot IDs continue the scene order and reference the same evidence range. Apply explicit user strategy only after evidence-based automatic selection; strategy may alter shot size, not source content.

- [ ] **Step 5: Run Shot Planning tests GREEN**

Run the Task 3 command. Expected: all tests PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/web/src/lib/skills/shot-planning apps/web/src/lib/skills/index.ts
git commit -m "feat: add deterministic shot planning skill"
```

## Task 4: Register All Executable Skills

**Files:**

- Modify: `apps/web/src/lib/skills/executable-registry.ts`
- Modify: `apps/web/src/lib/skills/runtime.test.ts`
- Modify: `apps/web/src/lib/skills/script-segmentation/scriptSegmentation.test.ts`

- [ ] **Step 1: Update registry tests first**

Replace the Stage A single-Skill assertion with:

```ts
assert.equal(CREATOR_EXECUTABLE_SKILL_REGISTRY.size, 3)
assert.deepEqual(Array.from(CREATOR_EXECUTABLE_SKILL_REGISTRY.keys()), [
  'script-segmentation@1.0.0',
  'narrative-beat-analysis@1.0.0',
  'shot-planning@1.0.0',
])
```

Rename the Script Segmentation manifest test so it asserts registration without claiming exclusivity. Add runtime tests showing Artifact-only calls are accepted for each Stage B Skill and unsupported Artifact types block before execution.

- [ ] **Step 2: Run registry tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/skills/runtime.test.ts src/lib/skills/script-segmentation/scriptSegmentation.test.ts
```

Expected: FAIL because the registry still contains only Script Segmentation.

- [ ] **Step 3: Register Stage B Skills in dependency order**

```ts
import { NARRATIVE_BEAT_ANALYSIS_SKILL } from './narrative-beat-analysis'
import { SCRIPT_SEGMENTATION_SKILL } from './script-segmentation'
import { SHOT_PLANNING_SKILL } from './shot-planning'

export const CREATOR_EXECUTABLE_SKILL_REGISTRY = createCreatorExecutableSkillRegistry([
  SCRIPT_SEGMENTATION_SKILL,
  NARRATIVE_BEAT_ANALYSIS_SKILL,
  SHOT_PLANNING_SKILL,
])
```

Do not add automatic chaining or Recipe logic to the registry or runtime.

- [ ] **Step 4: Run all Skill core tests GREEN**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/fingerprint.test.ts \
  src/lib/skills/runtime.test.ts \
  src/lib/skills/approvedArtifacts.test.ts \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts \
  src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts \
  src/lib/skills/shot-planning/shotPlanning.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/web/src/lib/skills
git commit -m "feat: register creator skill engine stage b"
```

## Task 5: Grouped Materialization and Stage A Artifact Handoff

**Files:**

- Create: `apps/web/src/components/create/canvas/skills/groupedSkillMaterialization.ts`
- Create: `apps/web/src/components/create/canvas/skills/groupedSkillMaterialization.test.ts`
- Modify: `apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.ts`
- Modify: `apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts`

- [ ] **Step 1: Write failing grouped materialization tests**

Test Narrative Beat and Shot Plan result fixtures with edited, reordered, deleted, approved, duplicate, malformed, and frozen inputs. Assert the planner returns:

```ts
export type GroupedSkillNodePlan = {
  resultId: string
  title: string
  prompt: string
  metadataJson: {
    creatorSkill: {
      skillId: string
      skillVersion: string
      runFingerprint: string
      sourceNodeIds: string[]
      sourceArtifactIds: string[]
      resultType: 'narrative-beat-map' | 'shot-plan'
      resultId: string
      reviewStatus: 'approved'
      evidence: CreatorSkillEvidence[]
      approvedArtifact: CreatorSkillArtifact
    }
  }
}
```

Require Artifact scene order, approval-context fingerprint and source Artifact ID, immutable IDs/evidence ranges, approved-only payloads, exact reviewed order, and dedupe by `skillId + runFingerprint + resultId`.

- [ ] **Step 2: Extend Stage A test expectations before code**

Add an exact assertion that each Script Segmentation plan now contains:

```ts
approvedArtifact: {
  artifactId: 'scene-breakdown-scene-001-approved',
  artifactType: 'scene-breakdown',
  artifactVersion: 1,
  sourceNodeIds: ['script-1'],
  sourceArtifactIds: ['scene-breakdown-001'],
  payload: {
    format: 'headed-script',
    scenes: [{
      sceneId: 'scene-001',
      order: 1,
      heading: 'EXT. ROOFTOP - NIGHT',
      characters: [],
      actionSummary: 'EXT. ROOFTOP - NIGHT\nMaya crosses the roof.',
      sourceText: 'EXT. ROOFTOP - NIGHT\nMaya crosses the roof.',
      lineStart: 1,
      lineEnd: 2,
      reviewStatus: 'pending',
    }],
  },
}
```

The canonical Artifact remains an analysis input, so its scene retains the Artifact contract's `pending` status; user approval is represented by the enclosing metadata `reviewStatus: 'approved'`.

- [ ] **Step 3: Run materialization tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/components/create/canvas/skills/groupedSkillMaterialization.test.ts \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts
```

Expected: FAIL because the grouped planner is absent and Stage A metadata lacks `approvedArtifact`.

- [ ] **Step 4: Implement guarded grouped materialization**

Expose two entry points with a shared private validator:

```ts
export function planNarrativeBeatMaterialization(
  input: NarrativeBeatMaterializationInput,
): GroupedMaterializationResult

export function planShotPlanMaterialization(
  input: ShotPlanMaterializationInput,
): GroupedMaterializationResult
```

Build human-readable prompts with stable field labels, one scene per plan, and no timestamps. Create the approved single-scene Artifact with the original analyzed Artifact in `sourceArtifactIds`. Validate caller-controlled values with own data descriptors and dense-array snapshots, matching the defensive Stage A materializer.

- [ ] **Step 5: Embed Stage A approved scene Artifacts**

Extend `CreatorSkillNodeMetadata` and the existing create plan at the point where evidence is already validated. Build the single-scene Artifact from the approved heading/text plus immutable Artifact fields. Do not change Stage A dedupe keys, titles, prompts, edge labels, or source mutation behavior.

- [ ] **Step 6: Run materialization tests GREEN**

Run the Task 5 command. Expected: all tests PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/web/src/components/create/canvas/skills
git commit -m "feat: persist approved grouped skill artifacts"
```

## Task 6: Narrative Beat Review Panel

**Files:**

- Create: `apps/web/src/components/create/canvas/skills/NarrativeBeatAnalysisPanel.tsx`
- Modify: `scripts/canvas-creator-skill-panel-static.test.mjs`

- [ ] **Step 1: Add failing review-state and static tests**

Export pure helpers and test them through `tsx --eval`:

```ts
export type NarrativeBeatReviewDraft = NarrativeBeatDraft & {
  decision: CreatorSkillReviewStatus
}
export function createNarrativeBeatPanelState(sourceNode: CreatorSkillSourceNode): NarrativeBeatPanelState
export function resetNarrativeBeatPanelStateForSource(
  current: NarrativeBeatPanelState,
  sourceNode: CreatorSkillSourceNode,
): NarrativeBeatPanelState
export function moveNarrativeBeatDraft(
  drafts: NarrativeBeatReviewDraft[],
  beatId: string,
  direction: -1 | 1,
): NarrativeBeatReviewDraft[]
```

Assert every initial decision is `pending`; edit, remove, move, approve, and reject are immutable; equal source identity preserves dirty review; changed effective text resets it; stale source disables apply; duplicates remain visible; partial callback failure locks apply. Materialization receives only `decision === 'approved'`; rejected and removed entries remain distinct in review state.

- [ ] **Step 2: Run panel tests and record RED**

```bash
node --test scripts/canvas-creator-skill-panel-static.test.mjs
```

Expected: FAIL because `NarrativeBeatAnalysisPanel.tsx` does not exist.

- [ ] **Step 3: Implement local review state and panel UI**

Use `CreatorSkillRunPanel` with:

- scene sections without nested cards;
- a compact segmented decision control for pending, approved, and rejected states;
- a select for beat type;
- text inputs for summary;
- Lucide `ArrowUp`, `ArrowDown`, and `Trash2` icon buttons with titles;
- source line and evidence details;
- duplicate and apply-error bands;
- apply label `创建叙事节拍节点 (N)`.

Use this run boundary:

```ts
const result = runCreatorSkill('narrative-beat-analysis', {
  sourceNodes: [sourceNodeSnapshot(sourceNode)],
  ...(approvedSceneArtifact ? { artifacts: [approvedSceneArtifact] } : {}),
})
```

Absent Artifact falls back to Text. Invalid present Artifact creates a blocked display result with `APPROVED_ARTIFACT_INVALID`; it does not fall back.

- [ ] **Step 4: Run panel tests GREEN**

Run the Task 6 command. Expected: all tests PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add apps/web/src/components/create/canvas/skills/NarrativeBeatAnalysisPanel.tsx scripts/canvas-creator-skill-panel-static.test.mjs
git commit -m "feat: add narrative beat review panel"
```

## Task 7: Migrate the Existing Shot List Builder

**Files:**

- Modify: `apps/web/src/components/create/ShotListBuilderPanel.tsx`
- Modify: `apps/web/src/lib/canvas/shot-list.ts`
- Create: `apps/web/src/components/create/ShotListBuilderPanel.test.tsx`
- Modify: `scripts/canvas-creator-skill-panel-static.test.mjs`

- [ ] **Step 1: Write failing migration and compatibility tests**

Test these public boundaries:

- opening and explicit rerun call `runCreatorSkill('shot-planning')`;
- source node `approvedArtifact` is passed only when valid and current draft text equals source text;
- edited source draft runs independently without the stale Artifact;
- malformed present Artifact blocks;
- every shot begins with a `pending` decision;
- edit, order, remove, approve, reject, and rerun work;
- grouped apply receives only approved shots;
- compatibility draft creation receives only approved nonduplicates;
- auto-generate receives only newly created nonduplicate IDs after second confirmation;
- no analysis callback invokes `fetch` or auto-generate.

Add a static assertion that `ShotListBuilderPanel.tsx` no longer imports `parseShotList`.

- [ ] **Step 2: Run Shot List tests and record RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/components/create/ShotListBuilderPanel.test.tsx
cd ../..
node --test scripts/canvas-creator-skill-panel-static.test.mjs
```

Expected: FAIL because the panel still uses the filler-based parser and has no approved Artifact review path.

- [ ] **Step 3: Remove the filler planning core but retain presentation exports**

Delete `FILLER_POOL`, `guessSize`, `applyStrategy`, `assignKind`, `assignDuration`, `guessCinematicNote`, `applyInstructionHints`, and `parseShotList` from `shot-list.ts`. Keep the option labels, `ShotDraft` compatibility type, and `buildShotListReport`. Change report construction to consume reviewed approved shots; report timestamps remain export-only and never enter Skill output or fingerprinting.

- [ ] **Step 4: Rebuild the panel around Shot Planning**

Keep the exported component name and existing global entry. Extend source nodes with `metadataJson?: unknown`. Normalize panel options into:

```ts
const options: ShotPlanningOptions = {
  requestedShotCount: effectiveCount,
  outputMode,
  pacing,
  shotSizeStrategy: strategy,
  userInstruction: instruction,
}
```

Use `CreatorSkillRunPanel` for the review shell. Preserve the existing source selector and editable source draft. Add approved-only grouped apply as the main action. Render compatibility actions in a full-width section below results:

- `创建已批准分镜节点`
- `生成已批准镜头`
- a second explicit confirmation with cost warning

The confirm handler must call the workspace callback only with IDs returned during that exact create operation.

- [ ] **Step 5: Run Shot List migration tests GREEN**

Run the Task 7 commands. Expected: all tests PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add apps/web/src/components/create/ShotListBuilderPanel.tsx \
  apps/web/src/components/create/ShotListBuilderPanel.test.tsx \
  apps/web/src/lib/canvas/shot-list.ts \
  scripts/canvas-creator-skill-panel-static.test.mjs
git commit -m "feat: upgrade shot list builder with shot planning"
```

## Task 8: Canvas Tool Wiring and Persistence

**Files:**

- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
- Modify: `apps/web/src/components/canvas/modal/canvasModalTypes.ts`
- Modify: `apps/web/src/components/create/AssetAgentToolbar.tsx`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Create: `scripts/canvas-creator-skill-stage-b-static.test.mjs`

- [ ] **Step 1: Write failing wiring and mutation-boundary tests**

Require:

```ts
{
  id: 'narrative-beat-analysis',
  label: '叙事节拍分析',
  supportedKinds: ['text'],
  openActionId: 'narrative-beat-analysis',
}
{
  id: 'shot-list-builder',
  label: '分镜清单生成器',
  supportedKinds: ['text'],
  openActionId: 'shot-list-builder',
}
```

The static test must reject a second `shot-planning` tool entry. It must locate both workspace apply callbacks and assert stale-source guards return before `createNode`, grouped Text nodes use evolving occupancy, source nodes are never patched, and analysis/panel integration contains no `fetch`, Generate route, Provider, Billing, Credits, Wallet, or Payment term.

- [ ] **Step 2: Run Stage B static test and record RED**

```bash
node --test scripts/canvas-creator-skill-stage-b-static.test.mjs
```

Expected: FAIL because Stage B tools and panels are not wired.

- [ ] **Step 3: Add modal and toolbar dispatch**

Add `'narrative-beat-analysis'` to `CanvasModalId`. Add `onOpenNarrativeBeatAnalysis` and `onOpenShotListBuilder` callbacks to `AssetAgentToolbar`; route action IDs to those callbacks. Reuse the existing `'shot-list-builder'` modal and state.

- [ ] **Step 4: Add Narrative Beat source state and grouped apply**

Snapshot the selected Text node as `CreatorSkillSourceNode`. Apply plans only after re-reading `latestNodesRef.current` and confirming the node still exists, remains Text, and its effective text equals the analyzed source text.

Create grouped Text nodes with:

```ts
createNode('text', {
  title: plan.title,
  prompt: plan.prompt,
  parentNodeId: analyzedSource.id,
  metadataJson: plan.metadataJson,
  edgeLabel: '叙事节拍',
  edgeToolId: 'narrative-beat-analysis',
  edgeToolIcon: '◆',
  position,
})
```

After the batch, call `flushLocalSnapshot()` and `scheduleCanvasSave(0)` exactly once.

- [ ] **Step 5: Add Shot Plan grouped and compatibility apply callbacks**

Grouped Text creation uses edge label `镜头规划` and tool ID `shot-planning`. Compatibility Image/Video nodes use approved shot text, reviewed output kind/duration, and metadata with `runFingerprint + shotId`. Before creation, compare against all current node metadata and skip duplicates. Return only actual new node IDs to the panel. Existing `pendingAutoGenerateIds` receives only IDs returned after the second confirmation.

- [ ] **Step 6: Render panels and close stale/deleted contexts**

Render `NarrativeBeatAnalysisPanel` only when its live source remains Text. Pass all Text-capable nodes, including `metadataJson`, to the existing Shot List Builder. Node deletion or project change must close/reset both panels through the existing modal coordinator.

- [ ] **Step 7: Run Stage B static test GREEN**

Run the Task 8 command. Expected: all tests PASS.

- [ ] **Step 8: Run existing canvas static regressions**

```bash
node --test \
  scripts/canvas-creator-skill-engine-static.test.mjs \
  scripts/canvas-creator-skill-panel-static.test.mjs \
  scripts/canvas-creator-skill-stage-b-static.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 9: Commit Task 8**

```bash
git add apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts \
  apps/web/src/components/canvas/modal/canvasModalTypes.ts \
  apps/web/src/components/create/AssetAgentToolbar.tsx \
  apps/web/src/components/create/VisualCanvasWorkspace.tsx \
  scripts/canvas-creator-skill-stage-b-static.test.mjs
git commit -m "feat: wire creator skill engine stage b into canvas"
```

## Task 9: Full Verification and Forbidden-Zone Audit

**Files:**

- Modify only files already named if a verified failure requires a scoped correction.

- [ ] **Step 1: Run all targeted Stage A and Stage B tests**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/fingerprint.test.ts \
  src/lib/skills/runtime.test.ts \
  src/lib/skills/approvedArtifacts.test.ts \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts \
  src/lib/skills/narrative-beat-analysis/narrativeBeatAnalysis.test.ts \
  src/lib/skills/shot-planning/shotPlanning.test.ts \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts \
  src/components/create/canvas/skills/groupedSkillMaterialization.test.ts \
  src/components/create/ShotListBuilderPanel.test.tsx
cd ../..
node --test \
  scripts/canvas-creator-skill-engine-static.test.mjs \
  scripts/canvas-creator-skill-panel-static.test.mjs \
  scripts/canvas-creator-skill-stage-b-static.test.mjs
```

Expected: all tests PASS with zero skipped Stage B tests.

- [ ] **Step 2: Run repository validation**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Audit forbidden paths**

```bash
git diff --name-only c875843..HEAD
git diff --name-only c875843..HEAD | rg '(^|/)(prisma|migrations|\.env)|api/generate/(image|video)|provider|billing|credits|wallet|ledger|payment|recharge|checkout|cn-executor|package\.json|pnpm-lock\.yaml|next\.config\.js' && exit 1 || true
```

Expected: the first command lists only approved Stage B files; the second produces no forbidden match.

- [ ] **Step 4: Inspect final implementation diff**

```bash
git diff --stat c875843..HEAD
git diff --check c875843..HEAD
git status --short
```

Expected: diff check passes and worktree is clean after all implementation commits.

## Task 10: Chrome QA, Push, Production Verification, and Closeout

**Files:**

- Modify after Production QA: `docs/CURRENT_STATUS.md`
- Modify after Production QA: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run authenticated local or Preview Chrome QA**

Use the user's Google Chrome session. Create a disposable QA project and execute:

1. Text -> Narrative Beat Analysis -> edit/reorder/delete/approve -> grouped node.
2. Save -> reload -> project reopen -> verify `approvedArtifact` survives.
3. Narrative Beats node -> existing Shot List Builder -> verify Artifact handoff.
4. Plain Text -> existing Shot List Builder -> verify independent direct execution.
5. Repeat grouped apply -> verify duplicate feedback and no new node.
6. Create approved individual draft nodes twice -> verify duplicates skip.
7. Click Generate approved shots -> verify the second confirmation appears; cancel it.

Record Network and Console. Expected: no automatic `/api/generate/*`, Provider, Billing, Credits, Wallet, Payment, Recharge, or Checkout mutation; no new product console error.

- [ ] **Step 2: Push implementation commits**

```bash
git status --short
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: clean worktree and matching local/remote SHA.

- [ ] **Step 3: Wait for Vercel Production Ready**

Use the existing linked Vercel project and inspect the deployment for the pushed implementation SHA. Expected: Production status `Ready`; do not promote an unrelated deployment and do not modify environment variables.

- [ ] **Step 4: Run safe Production Chrome QA**

Repeat the two independent Skill paths, grouped apply, save/reload, Artifact handoff, and duplicate checks at `https://creator-city-vert.vercel.app`. Open but cancel the generation confirmation. Expected: no real Provider call and no new Product API 5xx or console error.

- [ ] **Step 5: Update status documents only after Production passes**

Record in `docs/CURRENT_STATUS.md`:

```text
P0-CANVAS-CREATOR-SKILL-ENGINE-STAGE-B:
STAGE_B_VALIDATED / CLOSED

- narrative-beat-analysis independently callable and Production validated
- existing Shot List Builder upgraded to shot-planning; no duplicate tool
- approved Artifact handoff, grouped apply, dedupe, save/reload validated
- no Generate/Provider/Billing/Schema/env changes
```

Record in `docs/NEXT_TASKS.md` that Stage B is closed, Stage C remains not started, and no next task begins automatically.

- [ ] **Step 6: Validate and commit docs**

```bash
git diff --check
git diff --stat
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close creator skill engine stage b"
git push origin main
```

- [ ] **Step 7: Wait for final docs deployment and verify clean Git**

Confirm the docs commit deployment is `Ready`, then run:

```bash
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Expected: both SHAs match and status is empty. Stop without starting Stage C.
