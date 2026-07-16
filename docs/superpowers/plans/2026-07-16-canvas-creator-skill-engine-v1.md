# Canvas Creator Skill Engine V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Creator City's first independently callable, deterministic canvas Skill by implementing the shared Skill runtime and a `script-segmentation` Skill that turns an existing Text node into reviewable scene artifacts and, only after explicit approval, derived Text nodes.

**Architecture:** Keep the existing prompt-oriented `CREATOR_SKILL_REGISTRY` unchanged and add a separate executable registry under `apps/web/src/lib/skills`. Pure TypeScript owns normalization, stable fingerprints, parsing, result validation, and materialization planning; React only displays editable drafts and applies approved plans through the existing canvas `createNode` path. Analysis never mutates canvas state, makes network requests, or calls a Provider.

**Tech Stack:** TypeScript, React, Next.js, Node test runner, `tsx`, existing canvas modal and node-tool infrastructure.

---

## Scope Guard

This plan implements only stage A from the approved design:

- shared executable Skill contracts, Artifact contracts, fingerprinting, registry, and runtime;
- one independently callable Skill: `script-segmentation`;
- a reusable Skill result shell plus the Script Segmentation review UI;
- explicit approval and idempotent materialization into derived Text nodes;
- save/reload, network-boundary, and browser verification.

Do not implement `narrative-beat-analysis`, `shot-planning`, `camera-direction`, `lighting-direction`, `continuity-audit`, `annotation-edit-brief`, `storyboard-materialize`, or Storyboard Director Recipe in this task.

Do not modify Prisma schema or migrations, env files, Production DB, payment/credits/wallet/billing, Provider adapters, BYOK semantics, `/api/generate/image`, `/api/generate/video`, `cn-executor`, `package.json`, `pnpm-lock.yaml`, `next.config.js`, or `apps/web/src/lib/ai/skills`.

## Stable Public Contracts

The implementation must preserve the current `CreatorSkill` prompt type and `CREATOR_SKILL_REGISTRY`. Add these executable contracts to `apps/web/src/lib/skills/types.ts`:

```ts
export type CreatorSkillExecutionPolicy =
  | 'deterministic-local'
  | 'self-hosted-optional'
  | 'external-media'

export type CreatorSkillRunStatus = 'ready' | 'needs-review' | 'blocked'

export type CreatorSkillReviewStatus = 'pending' | 'approved' | 'rejected'

export type CreatorSkillManifest = {
  id: string
  version: string
  name: string
  description: string
  category: CreatorSkillCategory
  executionPolicy: CreatorSkillExecutionPolicy
  acceptedNodeKinds: CreatorSkillTarget[]
  acceptedArtifactTypes: string[]
  outputArtifactTypes: string[]
  independentlyCallable: true
}

export type CreatorSkillSourceNode = {
  id: string
  kind: CreatorSkillTarget
  title: string
  prompt: string
  resultText?: string
  metadataJson?: unknown
}

export type CreatorSkillProjectContext = {
  projectId?: string
  workflowId?: string
}

export type CreatorSkillArtifact<TPayload = unknown> = {
  artifactId: string
  artifactType: string
  artifactVersion: number
  sourceNodeIds: string[]
  sourceArtifactIds: string[]
  payload: TPayload
}

export type CreatorSkillEvidence = {
  evidenceId: string
  ruleId: string
  sourceNodeId: string
  lineStart: number
  lineEnd: number
  excerpt: string
  explanation: string
}

export type CreatorSkillIssue = {
  code: string
  message: string
  sourceNodeId?: string
  artifactId?: string
}

export type CreatorSkillRunInput = {
  sourceNodes: CreatorSkillSourceNode[]
  artifacts?: CreatorSkillArtifact[]
  projectContext?: CreatorSkillProjectContext
  options?: Record<string, unknown>
}

export type CreatorSkillRunResult = {
  skillId: string
  skillVersion: string
  runFingerprint: string
  status: CreatorSkillRunStatus
  artifacts: CreatorSkillArtifact[]
  evidence: CreatorSkillEvidence[]
  warnings: CreatorSkillIssue[]
  blockers: CreatorSkillIssue[]
}

export type CreatorExecutableSkill = {
  manifest: CreatorSkillManifest
  run: (input: CreatorSkillRunInput, runFingerprint: string) => CreatorSkillRunResult
}
```

Use the metadata namespace below for every materialized scene node:

```ts
type CreatorSkillNodeMetadata = {
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
  }
}
```

### Task 1: Add deterministic contracts and fingerprints

**Files:**
- Modify: `apps/web/src/lib/skills/types.ts`
- Create: `apps/web/src/lib/skills/artifacts.ts`
- Create: `apps/web/src/lib/skills/fingerprint.ts`
- Create: `apps/web/src/lib/skills/fingerprint.test.ts`
- Modify: `apps/web/src/lib/skills/index.ts`

- [ ] **Step 1: Write fingerprint RED tests**

Create `fingerprint.test.ts` using `node:test` and `node:assert/strict`. Cover:

```ts
const sourceA = {
  id: 'text-1',
  kind: 'text' as const,
  title: 'Opening',
  prompt: 'EXT. CITY - NIGHT\nRain falls.',
}

assert.equal(
  createCreatorSkillFingerprint('script-segmentation', '1.0.0', {
    sourceNodes: [sourceA],
    options: { maxScenes: 40, mode: 'safe' },
  }),
  createCreatorSkillFingerprint('script-segmentation', '1.0.0', {
    sourceNodes: [sourceA],
    options: { mode: 'safe', maxScenes: 40 },
  }),
)
```

Also require node-order normalization, Artifact-order normalization, metadata key-order normalization, version sensitivity, text sensitivity, and no timestamp/random fields in the fingerprint input.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/skills/fingerprint.test.ts
```

Expected: FAIL because `fingerprint.ts` and the new contracts do not exist.

- [ ] **Step 3: Add the executable contracts without changing legacy types**

Append the public contracts from this plan to `types.ts`. Keep `CreatorSkill`, `CreatorSkillTarget`, `ProjectStyleBible`, and all existing exported names source-compatible.

- [ ] **Step 4: Implement Artifact helpers**

In `artifacts.ts`, export:

```ts
export function createCreatorSkillArtifact<TPayload>(input: {
  artifactId: string
  artifactType: string
  artifactVersion: number
  sourceNodeIds: string[]
  sourceArtifactIds?: string[]
  payload: TPayload
}): CreatorSkillArtifact<TPayload>

export function isCreatorSkillArtifact(
  value: unknown,
): value is CreatorSkillArtifact
```

Trim IDs, sort and deduplicate source IDs, reject empty IDs/types, reject non-positive artifact versions, and never add dates or random values.

- [ ] **Step 5: Implement canonical fingerprinting**

In `fingerprint.ts`:

1. recursively sort object keys;
2. preserve array order inside payloads but sort top-level source nodes by `id` and top-level Artifacts by `artifactType + artifactId`;
3. omit `undefined` values;
4. serialize the normalized `{ skillId, skillVersion, input }`;
5. hash with an in-repo synchronous FNV-1a implementation;
6. return `csf1_<eight lowercase hex characters>`.

Public export:

```ts
export function createCreatorSkillFingerprint(
  skillId: string,
  skillVersion: string,
  input: CreatorSkillRunInput,
): string
```

- [ ] **Step 6: Export only the stable modules and verify GREEN**

Add `artifacts` and `fingerprint` exports to `index.ts`. Re-run the focused test and require all cases to pass.

- [ ] **Step 7: Commit the contract layer**

```bash
git add apps/web/src/lib/skills/types.ts \
  apps/web/src/lib/skills/artifacts.ts \
  apps/web/src/lib/skills/fingerprint.ts \
  apps/web/src/lib/skills/fingerprint.test.ts \
  apps/web/src/lib/skills/index.ts
git commit -m "feat: add creator skill runtime contracts"
```

### Task 2: Add a separate executable registry and runtime

**Files:**
- Create: `apps/web/src/lib/skills/executable-registry.ts`
- Create: `apps/web/src/lib/skills/runtime.ts`
- Create: `apps/web/src/lib/skills/runtime.test.ts`
- Modify: `apps/web/src/lib/skills/index.ts`

- [ ] **Step 1: Write runtime RED tests**

Use small in-test deterministic Skills to prove:

- registration rejects duplicate `id@version`;
- lookup supports exact `id@version` and latest registered version for an ID;
- unsupported source-node and Artifact inputs return `blocked` with `UNSUPPORTED_SKILL_INPUT`;
- malformed Artifacts return `blocked` with `INVALID_SKILL_ARTIFACT`;
- execution exceptions return `blocked` with `SKILL_EXECUTION_FAILED` and no Artifacts;
- returned Skill ID/version/fingerprint are forced to the registered manifest values;
- the same normalized input returns deep-equal results;
- the runtime never mutates caller-owned input arrays or objects.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/skills/runtime.test.ts
```

Expected: FAIL because the executable registry and runtime do not exist.

- [ ] **Step 3: Implement registry construction and validation**

Export:

```ts
export function createCreatorExecutableSkillRegistry(
  skills: CreatorExecutableSkill[],
): ReadonlyMap<string, CreatorExecutableSkill>

export function getExecutableCreatorSkill(
  skillId: string,
  skillVersion?: string,
): CreatorExecutableSkill | null
```

Use `id@version` as the internal exact key. Validate trimmed IDs, semantic numeric versions in `major.minor.patch` form, non-empty output types, `independentlyCallable === true`, and a deterministic-local policy for stage A.

Do not rename or modify `CREATOR_SKILL_REGISTRY`, `getCreatorSkillById`, `getDefaultCreatorSkillIds`, or `resolveCreatorSkills` in `registry.ts`.

- [ ] **Step 4: Implement runtime validation and failure isolation**

Export:

```ts
export function runCreatorSkill(
  skillId: string,
  input: CreatorSkillRunInput,
  skillVersion?: string,
): CreatorSkillRunResult
```

Normalize source strings and top-level ordering, validate that at least one accepted node kind or accepted Artifact type exists, calculate the fingerprint, call the pure executor in `try/catch`, validate output Artifact types against the manifest, and return a blocked result rather than throwing across the canvas boundary.

- [ ] **Step 5: Export the runtime and verify GREEN**

Add `executable-registry` and `runtime` exports to `index.ts`, re-run `runtime.test.ts`, then run both Skill-core tests together:

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/fingerprint.test.ts \
  src/lib/skills/runtime.test.ts
```

- [ ] **Step 6: Commit the runtime layer**

```bash
git add apps/web/src/lib/skills/executable-registry.ts \
  apps/web/src/lib/skills/runtime.ts \
  apps/web/src/lib/skills/runtime.test.ts \
  apps/web/src/lib/skills/index.ts
git commit -m "feat: add independent creator skill runtime"
```

### Task 3: Implement the independent Script Segmentation Skill

**Files:**
- Create: `apps/web/src/lib/skills/script-segmentation/types.ts`
- Create: `apps/web/src/lib/skills/script-segmentation/parser.ts`
- Create: `apps/web/src/lib/skills/script-segmentation/index.ts`
- Create: `apps/web/src/lib/skills/script-segmentation/scriptSegmentation.test.ts`
- Modify: `apps/web/src/lib/skills/executable-registry.ts`
- Modify: `apps/web/src/lib/skills/index.ts`

- [ ] **Step 1: Define scene-breakdown payload types in the RED test**

The public payload contract is:

```ts
export type ScriptSceneDraft = {
  sceneId: string
  order: number
  heading: string
  location?: string
  timeOfDay?: string
  characters: string[]
  actionSummary: string
  sourceText: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending'
}

export type SceneBreakdownPayload = {
  format: 'headed-script' | 'paragraph-fallback'
  scenes: ScriptSceneDraft[]
}
```

Test by calling the public runtime, not the parser directly:

```ts
const result = runCreatorSkill('script-segmentation', {
  sourceNodes: [{
    id: 'script-1',
    kind: 'text',
    title: '雨夜追逐',
    prompt: '第一场 外景 城市街道 夜\n林夏冲入雨中。\n\n第二场 内景 车站 日\n林夏停在检票口。',
  }],
})
```

Cover Chinese numbered headings, `INT.`, `EXT.`, `INT/EXT.`, mixed Chinese/English, character cue lines, action text, blank-line fallback, exact source line ranges, deterministic `scene-001` IDs, 40-scene truncation warning, empty/whitespace input, text under 8 meaningful characters, image-only input, multiple Text-node rejection, and no-heading `needs-review` status.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts
```

Expected: FAIL because the Skill is not registered.

- [ ] **Step 3: Implement pure line-preserving parsing**

Normalize CRLF to LF and identify headings using anchored rules for:

```text
第1场 / 第一场 / 场景 1
内景 / 外景 / 内外景
INT. / EXT. / INT/EXT. / I/E.
```

Do not infer missing plot content. Preserve the exact scene text and 1-based source line range. Character extraction may only use explicit standalone cue lines or names followed by a full-width/ASCII colon. Deduplicate character names in first-seen order.

When no heading exists, split on two or more line breaks into non-empty paragraphs. Return `needs-review` with `FALLBACK_SCENE_BOUNDARIES` because the boundaries are heuristic.

- [ ] **Step 4: Implement and register the Skill**

Manifest:

```ts
export const SCRIPT_SEGMENTATION_MANIFEST: CreatorSkillManifest = {
  id: 'script-segmentation',
  version: '1.0.0',
  name: '剧本分场',
  description: '将文本剧本拆分为可审核的场景结构',
  category: 'story',
  executionPolicy: 'deterministic-local',
  acceptedNodeKinds: ['text'],
  acceptedArtifactTypes: [],
  outputArtifactTypes: ['scene-breakdown'],
  independentlyCallable: true,
}
```

The single output Artifact ID is `scene-breakdown-001`, version `1`, and references the source Text node. Each scene emits one evidence item with stable IDs `scene-evidence-001`, `scene-evidence-002`, and so on. Blocked results emit no Artifacts.

- [ ] **Step 5: Verify parser and runtime GREEN**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/fingerprint.test.ts \
  src/lib/skills/runtime.test.ts \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts
```

Expected: all deterministic runtime and segmentation cases PASS.

- [ ] **Step 6: Commit the first independent Skill**

```bash
git add apps/web/src/lib/skills/script-segmentation \
  apps/web/src/lib/skills/executable-registry.ts \
  apps/web/src/lib/skills/index.ts
git commit -m "feat: add independent script segmentation skill"
```

### Task 4: Add pure approval and idempotent materialization planning

**Files:**
- Create: `apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.ts`
- Create: `apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts`

- [ ] **Step 1: Write materialization RED tests**

Define this pure UI-to-canvas boundary:

```ts
export type ApprovedSceneDraft = ScriptSceneDraft & {
  heading: string
  sourceText: string
  reviewStatus: 'approved'
}

export type SceneNodeMaterializationPlan = {
  resultId: string
  title: string
  prompt: string
  metadataJson: CreatorSkillNodeMetadata
  evidence: CreatorSkillEvidence[]
}

export function planScriptSceneMaterialization(input: {
  sourceNodeId: string
  result: CreatorSkillRunResult
  approvedScenes: ApprovedSceneDraft[]
  existingNodes: Array<{ metadataJson?: unknown }>
}): {
  create: SceneNodeMaterializationPlan[]
  duplicates: string[]
}
```

Cover approved-only output, stable scene order, edited heading/text preservation, exact metadata, scene-specific evidence, rejection of blocked results, rejection of stale source identity, and duplicate detection by `runFingerprint + resultId`.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts
```

Expected: FAIL because the planner does not exist.

- [ ] **Step 3: Implement a side-effect-free planner**

The helper must not import React, workspace state, fetch, UUID helpers, or `Date`. It must validate that:

- result Skill ID is `script-segmentation`;
- result status is not `blocked`;
- the `scene-breakdown` Artifact references the provided source node;
- approved scene IDs exist in the Artifact;
- an existing `metadataJson.creatorSkill` record with the same fingerprint/result ID is reported as a duplicate and omitted from `create`.

Do not generate canvas node IDs in this helper. Canvas IDs remain an application-layer concern and never enter the Skill fingerprint.

- [ ] **Step 4: Verify GREEN and commit**

```bash
cd apps/web
node_modules/.bin/tsx --test \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts
```

```bash
git add apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.ts \
  apps/web/src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts
git commit -m "feat: plan idempotent skill scene materialization"
```

### Task 5: Add the reusable result shell and Script Segmentation review panel

**Files:**
- Create: `apps/web/src/components/create/canvas/skills/CreatorSkillRunPanel.tsx`
- Create: `apps/web/src/components/create/canvas/skills/ScriptSegmentationPanel.tsx`
- Create: `scripts/canvas-creator-skill-panel-static.test.mjs`

- [ ] **Step 1: Write static UI boundary RED tests**

Assert the new components:

- import `runCreatorSkill` and call it with Skill ID `script-segmentation` plus the selected Text-node input;
- expose stable test IDs for panel, status, scene list, scene checkbox, rerun, apply, and close;
- render version, warnings, blockers, and evidence excerpts;
- initialize every scene as unapproved;
- allow heading and source text edits in local draft state;
- disable apply for blocked results or zero approved scenes;
- do not contain `fetch(`, `/api/generate/`, Provider, billing, credits, wallet, payment, recharge, or checkout calls;
- do not import `apps/web/src/lib/ai/skills`.

- [ ] **Step 2: Run the static test and verify RED**

```bash
node --test scripts/canvas-creator-skill-panel-static.test.mjs
```

Expected: FAIL because the panel files do not exist.

- [ ] **Step 3: Implement the generic result shell**

`CreatorSkillRunPanel` owns the modal frame, title/version, status treatment, warnings, blockers, evidence section, close control, and action footer. Use existing canvas panel visual conventions and Lucide icons already installed in the repository. Do not add packages or explanatory feature marketing copy.

Required props:

```ts
type CreatorSkillRunPanelProps = {
  manifest: CreatorSkillManifest
  result: CreatorSkillRunResult
  canApply: boolean
  applyLabel: string
  onRerun: () => void
  onApply: () => void
  onClose: () => void
  children: React.ReactNode
}
```

- [ ] **Step 4: Implement Script Segmentation review state**

Required props:

```ts
type ScriptSegmentationPanelProps = {
  sourceNode: CreatorSkillSourceNode
  existingNodes: Array<{ metadataJson?: unknown }>
  onApply: (plans: SceneNodeMaterializationPlan[]) => void
  onClose: () => void
}
```

On open and explicit rerun, call the local runtime synchronously from a fresh source snapshot. Keep checkboxes unselected until the user approves each scene. Editing a heading or scene text changes only the panel draft. Applying calls `planScriptSceneMaterialization`; duplicates stay visible as warnings and are not silently recreated.

Use a compact scrollable scene list with checkboxes, editable heading input, editable scene text area, source line label, and expandable evidence. Do not nest decorative cards or add automatic generation controls.

- [ ] **Step 5: Verify static GREEN and compile the focused surface**

```bash
node --test scripts/canvas-creator-skill-panel-static.test.mjs
pnpm type-check
```

Expected: the static boundaries pass and TypeScript exits 0.

- [ ] **Step 6: Commit the review UI**

```bash
git add apps/web/src/components/create/canvas/skills/CreatorSkillRunPanel.tsx \
  apps/web/src/components/create/canvas/skills/ScriptSegmentationPanel.tsx \
  scripts/canvas-creator-skill-panel-static.test.mjs
git commit -m "feat: add script segmentation review panel"
```

### Task 6: Wire independent invocation and approved scene application into canvas

**Files:**
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
- Modify: `apps/web/src/components/canvas/modal/canvasModalTypes.ts`
- Modify: `apps/web/src/components/create/AssetAgentToolbar.tsx`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Create: `scripts/canvas-creator-skill-engine-static.test.mjs`

- [ ] **Step 1: Write canvas integration RED tests**

Assert:

- `nodeToolRegistry.ts` contains an available `script-segmentation` panel tool supporting only `text`;
- modal union contains `script-segmentation`;
- toolbar forwards `onOpenScriptSegmentation` and handles the action ID;
- workspace opens the panel only for the active Text node;
- source node data is converted to `CreatorSkillSourceNode` without mutation;
- approved plans call the existing `createNode` with `kind: 'text'`, `parentNodeId: sourceNode.id`, `edgeLabel: '剧本分场'`, and `edgeToolId: 'script-segmentation'`;
- plan metadata is passed unchanged;
- the workspace does not add Generate, Provider, Billing, Credits, Wallet, Payment, or upload calls for this feature;
- the implementation does not call `handleNodePatch` for the source node during analysis or apply.

- [ ] **Step 2: Run the static test and verify RED**

```bash
node --test scripts/canvas-creator-skill-engine-static.test.mjs
```

Expected: FAIL because no canvas entry or modal wiring exists.

- [ ] **Step 3: Add the Text-node tool and modal ID**

Add this registry entry under prompt/direction tools:

```ts
{
  id: 'script-segmentation',
  label: '剧本分场',
  icon: '§',
  description: '将文本拆分为可审核的场景节点',
  category: 'prompt-direction',
  executionType: 'panel',
  supportedKinds: ['text'],
  requiresMedia: false,
  requiresAsset: false,
  available: true,
  openActionId: 'script-segmentation',
},
```

Add `'script-segmentation'` to `CanvasModalId`.

- [ ] **Step 4: Forward the toolbar action**

Add optional prop `onOpenScriptSegmentation?: () => void`, accept it in the component arguments, and add:

```ts
case 'script-segmentation': onOpenScriptSegmentation?.(); break
```

Do not add a second hard-coded toolbar button; NodeToolCenter remains the canonical entry.

- [ ] **Step 5: Add minimal workspace state and panel rendering**

Use the existing modal coordinator through `openNodeScopedTool('script-segmentation', activeNode)`. Render `ScriptSegmentationPanel` only when the modal is open and its source node still exists and is Text. Closing or project change must discard the in-memory analysis draft.

Build the source snapshot from immutable node fields:

```ts
const sourceNode: CreatorSkillSourceNode = {
  id: activeNode.id,
  kind: 'text',
  title: activeNode.title,
  prompt: activeNode.prompt ?? '',
  resultText: typeof activeNode.resultText === 'string'
    ? activeNode.resultText
    : undefined,
  metadataJson: activeNode.metadataJson,
}
```

Before apply, verify the current node's effective text still matches the analyzed source snapshot. If it changed, close the stale result and show a user-visible warning to rerun.

- [ ] **Step 6: Apply approved plans through existing canvas creation**

For each non-duplicate plan, call the existing `createNode` sequentially:

```ts
createNode('text', {
  title: plan.title,
  prompt: plan.prompt,
  parentNodeId: sourceNode.id,
  metadataJson: plan.metadataJson,
  edgeLabel: '剧本分场',
  edgeToolId: 'script-segmentation',
  edgeToolIcon: '§',
})
```

Do not patch or replace the source Text node. Use the current workspace save pipeline; do not issue direct canvas PUT requests from the Skill panel.

- [ ] **Step 7: Verify integration GREEN**

```bash
node --test \
  scripts/canvas-creator-skill-panel-static.test.mjs \
  scripts/canvas-creator-skill-engine-static.test.mjs

cd apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/fingerprint.test.ts \
  src/lib/skills/runtime.test.ts \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts
```

- [ ] **Step 8: Commit canvas wiring**

```bash
git add apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts \
  apps/web/src/components/canvas/modal/canvasModalTypes.ts \
  apps/web/src/components/create/AssetAgentToolbar.tsx \
  apps/web/src/components/create/VisualCanvasWorkspace.tsx \
  scripts/canvas-creator-skill-engine-static.test.mjs
git commit -m "feat: wire script segmentation into canvas"
```

### Task 7: Run repository gates and forbidden-zone audit

**Files:**
- Test: all files introduced above

- [ ] **Step 1: Run all targeted tests from a clean shell**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test \
  src/lib/skills/fingerprint.test.ts \
  src/lib/skills/runtime.test.ts \
  src/lib/skills/script-segmentation/scriptSegmentation.test.ts \
  src/components/create/canvas/skills/scriptSegmentationMaterialization.test.ts

cd /Users/aaron/creator-city
node --test \
  scripts/canvas-creator-skill-panel-static.test.mjs \
  scripts/canvas-creator-skill-engine-static.test.mjs
```

Expected: all focused unit and static boundary tests PASS.

- [ ] **Step 2: Run full repository gates**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits 0. Existing repository lint warnings may be reported separately; do not introduce a new warning.

- [ ] **Step 3: Audit the complete task diff against forbidden zones**

```bash
git diff --name-only c57f47c..HEAD
git diff --stat c57f47c..HEAD
git diff --check c57f47c..HEAD
```

Require the diff to contain only the files listed by this plan. Explicitly reject schema/migrations, env, APIs, Generate routes, Provider adapters, BYOK, Billing, Credits, Wallet, Ledger, Payment, `cn-executor`, packages, lockfiles, and Next config.

- [ ] **Step 4: Review the implementation before browser QA**

Use the required code-review workflow to inspect determinism, input immutability, Artifact validation, stale-source handling, duplicate prevention, accessibility labels, and accidental network boundaries. Resolve findings and rerun targeted/full gates before proceeding.

### Task 8: Local authenticated browser QA

**Files:**
- No product file changes unless QA finds a scoped defect
- Temporary outputs allowed only under ignored Playwright/test-results paths

- [ ] **Step 1: Start the local web application on a free port**

Use the repository's existing local start command and existing authorized local authentication setup. Do not create or alter env files.

- [ ] **Step 2: Verify independent Text-node invocation**

In Chrome:

1. log in and open an existing QA project on `/create`;
2. create or select a Text node containing a two-scene script;
3. open NodeToolCenter and choose `剧本分场`;
4. verify no canvas node or edge is added during analysis;
5. verify Skill ID/version status, two scene drafts, line evidence, and zero preselected approvals;
6. edit one heading and one scene body;
7. approve only one scene and apply;
8. verify exactly one derived Text node and one labeled source edge appear;
9. verify the source node text and metadata are unchanged;
10. reopen and apply the same scene again, verifying no silent duplicate appears.

- [ ] **Step 3: Verify persistence and isolation**

Manually save, refresh, reopen the project, and verify the derived node, edge, and `creatorSkill` metadata restore. Switch projects and confirm the prior project's in-memory analysis cannot be applied.

- [ ] **Step 4: Verify error cases**

Check an empty Text node returns blocked, unheaded prose returns needs-review, closing discards unsaved review edits, and editing the source after analysis requires a rerun before apply.

- [ ] **Step 5: Verify Network and Console boundaries**

During analysis and apply, require:

- `/api/generate/*`: 0
- Provider requests: 0
- Billing/Credits/Wallet/Payment mutations: 0
- upload requests: 0
- canvas request storm: No
- new product console errors: 0
- React uncaught exceptions: 0

Classify browser harness or authentication limitations separately from product defects.

### Task 9: Publish, Production QA, and close documentation

**Files:**
- Modify after Production verification: `docs/CURRENT_STATUS.md`
- Modify after Production verification: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Confirm implementation history and push main**

```bash
git status --short
git log --oneline -10
git push origin main
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Require a clean worktree and matching local/remote SHA.

- [ ] **Step 2: Wait for matching Vercel Production Ready**

Do not claim deployment success until the Vercel Production deployment for the exact implementation SHA is Ready.

- [ ] **Step 3: Repeat the authenticated Production golden path**

Repeat independent invocation, analysis-no-mutation, single approved scene application, source immutability, duplicate prevention, manual save, refresh/reopen, project isolation, Network, and Console checks in Production Chrome. Do not call a real media Provider and do not perform payment actions.

- [ ] **Step 4: Update status documents only after evidence exists**

Record:

- task `P0-CANVAS-CREATOR-SKILL-ENGINE-V1` status;
- implementation SHA and Production SHA;
- unit/static/full-gate results;
- exact browser evidence;
- independent-call and no-network proof;
- remaining P0/P1/P2 issues;
- stage B remains not started.

Keep the next recommended task listed but do not begin it.

- [ ] **Step 5: Commit and push documentation**

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git diff --cached --stat
git commit -m "docs: close creator skill engine v1"
git push origin main
```

- [ ] **Step 6: Wait for docs SHA and stop**

Require the docs SHA to reach Vercel Production Ready, local `main` and `origin/main` to match, and `git status --short` to be empty. Stop without implementing stage B or Storyboard Director Recipe.

## Completion Evidence

The final report must include:

- implementation and docs commits;
- exact Production deployment SHA;
- changed-file list and forbidden-zone audit;
- targeted test counts, type-check, lint, build, and diff-check;
- local and Production Chrome results;
- Network and Console counts;
- proof that analysis did not mutate canvas and apply did not mutate the source;
- proof that duplicate application was blocked;
- remaining P0/P1/P2 issues;
- explicit statement that later Skills and Recipe were not started.
