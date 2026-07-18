# Creator Skill Engine Stage B Design

Date: 2026-07-18

Status: Founder-approved design; awaiting written-spec review

Task: `P0-CANVAS-CREATOR-SKILL-ENGINE-STAGE-B`

## 1. Purpose

Stage B strengthens Creator City's owned, deterministic planning capability without adding another overlapping storyboard tool. It adds `narrative-beat-analysis` and upgrades the existing Shot List Builder so that `shot-planning` becomes its structured planning engine.

Both Skills remain independently callable. They can exchange approved Artifacts when available, but neither Skill requires the other. No Skill analysis invokes a media Provider or modifies the canvas.

## 2. Approved Product Decisions

1. Materialized Skill results are grouped by scene instead of creating one canvas Text node per beat or shot.
2. Shot Planning produces one primary shot per narrative beat. It may add a supplemental shot only when the source explicitly contains a reaction, turn, or spatial transition.
3. Stage B uses independent, strongly typed Skills with persisted approved Artifacts.
4. The existing Shot List Builder is strengthened rather than duplicated:
   - keep its user-facing name and existing director-tool entry;
   - expose the same tool from eligible Text nodes;
   - replace its shallow planning core with `shot-planning`;
   - retain explicit draft-node creation and separately confirmed generation as compatibility actions.
5. `narrative-beat-analysis` is a new capability.
6. Stage B does not implement Storyboard Director Recipe, Camera Direction, Lighting Direction, Continuity Audit, or Annotation Edit Brief.

## 3. Existing Capability Relationship

| Existing capability | Stage B action |
| --- | --- |
| Script Segmentation | Strengthen approved Artifact handoff; preserve behavior |
| Shot List Builder | Preserve entry and name; replace the internal planning core |
| Shot Sequencer | Preserve; it continues to order existing shot nodes |
| Storyboard Grid Split | Preserve; it crops storyboard images and has a separate responsibility |
| Camera Control / Camera Lexicon | Preserve for Stage C |
| Prompt Booster | Preserve; it is not a structural planning Skill |
| Narrative Beat Analysis | Add as a new independent Text-node Skill |

The existing `FILLER_POOL` behavior in `apps/web/src/lib/canvas/shot-list.ts` must not remain in the new planning path. Insufficient evidence produces fewer shots and a review warning; it must not invent story events to satisfy a requested count.

## 4. Architecture

```text
Text node or approved scene-breakdown
  -> narrative-beat-analysis
  -> review narrative-beat-map
  -> apply one grouped Narrative Beats Text node per approved scene

Text node, approved scene-breakdown, or approved narrative-beat-map
  -> shot-planning
  -> review shot-plan
  -> apply one grouped Shot Plan Text node per approved scene
  -> optional explicit compatibility action: create approved Image/Video draft nodes
  -> optional existing second confirmation: generate newly created shots
```

The executable registry and runtime in `apps/web/src/lib/skills` remain the single core. Both new Skills use `deterministic-local`, produce canonical Artifacts and evidence, and are programmatically callable without React state.

The runtime does not automatically invoke one Skill from another. Shared low-level text utilities are allowed, but they must not contain hidden Recipe behavior.

## 5. Artifact Persistence and Handoff

Applied grouped nodes store an approved Artifact in:

```ts
metadataJson.creatorSkill.approvedArtifact
```

The value uses the canonical `CreatorSkillArtifact` shape. It contains only the approved, edited, ordered entries for one scene and references the original analyzed Artifact through `sourceArtifactIds`.

The existing provenance fields remain present:

```ts
metadataJson.creatorSkill = {
  skillId,
  skillVersion,
  runFingerprint,
  sourceNodeIds,
  sourceArtifactIds,
  resultType,
  resultId,
  reviewStatus: 'approved',
  evidence,
  approvedArtifact,
}
```

New Script Segmentation scene nodes also receive a single-scene approved `scene-breakdown` Artifact. Existing deployed nodes without `approvedArtifact` remain valid and fall back to their Text content. If the property is present but malformed, the consumer blocks with a specific issue instead of silently ignoring corrupted structured input.

## 6. Narrative Beat Analysis

### 6.1 Manifest

- ID: `narrative-beat-analysis`
- Version: `1.0.0`
- Execution: `deterministic-local`
- Accepted node kinds: `text`
- Accepted Artifacts: `scene-breakdown`
- Output Artifact: `narrative-beat-map`
- Independently callable: `true`

### 6.2 Inputs

The Skill accepts one of these independent inputs:

1. One Text source node.
2. One canonical `scene-breakdown` Artifact.
3. A Text source node together with its canonical `scene-breakdown` Artifact.

When both are supplied, the Artifact provides scene structure and the Text node supplies the current canvas identity. Conflicting or malformed canonical input blocks the run.

### 6.3 Beat payload

Each scene contains ordered beats with:

- `beatId`
- `sceneId`
- `order`
- `type`: `setup`, `goal`, `action`, `reaction`, `turn`, `closure`, or `unclassified`
- `sourceText`
- `summary`
- `lineStart`
- `lineEnd`
- `reviewStatus: 'pending'`
- optional `needsReviewReason`

### 6.4 Rules

- Recognize explicit Chinese and English setup, goal, action, reaction, turn, and closure cues.
- The first contextual segment can be classified as setup when it explicitly establishes place, time, subject, or initial state.
- Preserve source order and exact line ranges.
- Use `unclassified` when the evidence does not support a reliable beat type.
- Never add motivations, events, reactions, transitions, or endings absent from the source.
- Return `needs-review` when any beat is unclassified or structurally ambiguous.
- Return `blocked` for empty, too-short, conflicting, or structurally invalid input.
- Process at most 40 scenes and 120 beats. Exceeding either limit blocks the run rather than truncating silently.

## 7. Shot Planning

### 7.1 Manifest

- ID: `shot-planning`
- Version: `1.0.0`
- Execution: `deterministic-local`
- Accepted node kinds: `text`
- Accepted Artifacts: `scene-breakdown`, `narrative-beat-map`
- Output Artifact: `shot-plan`
- Independently callable: `true`

### 7.2 Inputs

The Skill can run from:

1. One Text source node without an Artifact.
2. One approved `scene-breakdown` Artifact.
3. One approved `narrative-beat-map` Artifact.
4. A Text source node with one matching optional Artifact.

The Skill does not call `narrative-beat-analysis` internally. Direct Text and scene inputs use deterministic, low-level source segmentation sufficient to create evidence-backed shot units.

### 7.3 Options

The existing Shot List Builder controls become explicit normalized options:

- requested shot count
- output mode: image, video, or mixed
- pacing
- shot-size strategy
- user instruction

Options may influence selection and presentation but cannot authorize invented story content. A requested count is a target, not a required minimum:

- when the source supports fewer shots, return fewer shots and a review warning;
- when explicit beats require more primary shots than the requested count, preserve one primary shot per beat and warn that the target was exceeded;
- add evidence-backed supplemental shots only while doing so moves the result toward the requested target;
- the only hard output limit is 120 shots.

### 7.4 Shot payload

Each scene contains ordered shots with:

- `shotId`
- `sceneId`
- optional `beatId`
- `order`
- `objective`
- `subject`
- `action`
- `suggestedShotSize`: `wide`, `full`, `medium`, `close`, or `extreme-close`
- `sourceText`
- `lineStart`
- `lineEnd`
- compatibility presentation fields for image/video draft choice and duration where explicitly selected by the user
- `reviewStatus: 'pending'`
- optional `needsReviewReason`

### 7.5 Rules

- Produce one primary shot for each supported narrative beat or direct source unit.
- Add a supplemental shot only for an explicit reaction, narrative turn, or spatial transition present in the same evidence range.
- Do not omit an explicit beat merely to match a lower requested shot-count target.
- Prefer wide/full shots for explicit environment establishment.
- Prefer medium shots for explicit character action or dialogue action.
- Prefer close/extreme-close shots for explicit reactions, expressions, or important details.
- Mark missing subject, action, or reliable size guidance as `needs-review`; do not fabricate it.
- Output no more than 120 shots. Exceeding the limit blocks the run rather than truncating.
- Do not use current time, randomness, network results, or confidence percentages.

## 8. Review UX

Both panels reuse `CreatorSkillRunPanel` and its focus, status, warning, blocker, evidence, rerun, apply, and close contract.

Review content is grouped by scene. Every generated item starts unapproved. The user can:

- edit allowed presentation and planning fields;
- move an item up or down within its scene;
- remove an item from the current review batch;
- explicitly approve or reject items;
- rerun to restore a fresh deterministic analysis.

Editing and removal affect only in-memory review drafts until apply. Evidence remains tied to the original source excerpt and is not rewritten to pretend that user edits came from the source.

`needs-review` items may be edited and explicitly approved. They never auto-approve. Blocked results cannot be applied.

Changing source identity or effective source text resets or closes the stale review. Old approval selections cannot be transferred to a new fingerprint.

## 9. Canvas Application

### 9.1 Grouped nodes

The primary apply path creates at most one Text node per scene:

- Narrative Beat Analysis creates a `Narrative Beats` node containing approved beats in reviewed order.
- Shot Planning creates a `Shot Plan` node containing approved shots in reviewed order.
- A scene with no approved items creates no node.

The grouped node stores the approved per-scene Artifact and provenance metadata. Source nodes remain unchanged. Edge labels are `叙事节拍` and `镜头规划`.

### 9.2 Placement and persistence

- Place scene-grouped nodes to the right of the source in scene order.
- Resolve each candidate against an occupancy list that is updated after every actual creation.
- Flush the existing local snapshot and schedule the existing canvas save after a successful batch.
- Save/reload/project-reopen must preserve the approved Artifact and provenance.

### 9.3 Idempotency

Grouped-node dedupe uses `skillId + runFingerprint + resultId`, where `resultId` is the scene result identity. Existing matches remain visible as duplicate feedback and are not recreated.

The Shot List Builder compatibility action creates individual Image/Video draft nodes only from approved shots. Those nodes store `skillId`, `runFingerprint`, and `shotId`. Existing matches are skipped. Skipped nodes are never submitted to the existing auto-generate callback.

A partial callback failure locks the current apply batch and reports that the canvas must be inspected. It must not claim an atomic rollback or encourage a blind rerun.

## 10. Existing Shot List Builder Migration

The existing director-tool entry and user-facing label remain. Eligible Text nodes open the same tool with that node preselected.

The panel changes as follows:

1. `runCreatorSkill('shot-planning')` becomes the planning source of truth.
2. The existing controls supply normalized Skill options.
3. The existing shallow parser and filler behavior no longer drive panel results.
4. The panel displays Artifact-backed review items and evidence.
5. The primary Stage B action saves grouped Shot Plan Text nodes.
6. The existing create-draft action remains available only for explicitly approved shots.
7. The existing generate action retains its separate confirmation and only receives newly created, nonduplicate node IDs.

No analysis, rerun, panel open, approval toggle, or grouped apply may trigger generation.

## 11. Failure Handling

- Empty or too-short input: blocked.
- Unsupported or conflicting inputs: blocked.
- Present but malformed approved Artifact: blocked with an Artifact-integrity issue.
- Ambiguous classification: `needs-review` with a concrete reason.
- Requested shot count exceeds supported evidence: return fewer shots and a warning.
- Source changes while reviewing: close or reset before any canvas mutation.
- Duplicate apply: show duplicates and create only nonduplicates.
- Planning validation failure: create nothing.
- Partial canvas creation failure: lock the review batch and require inspection.
- Skill exception: return a normalized blocked result and perform no canvas mutation.

## 12. Test Strategy

Implementation follows TDD. Failing tests are recorded before production code changes.

### 12.1 Narrative Beat Analysis

- Chinese, English, and mixed source text.
- Text and `scene-breakdown` inputs.
- Setup, goal, action, reaction, turn, closure, and unclassified cases.
- Exact evidence ranges and stable IDs.
- Ambiguous content becomes `needs-review`.
- No unsupported plot invention.
- Empty, too-short, malformed, 40-scene, and 120-beat boundaries.
- Deterministic repeated output.

### 12.2 Shot Planning

- Direct Text, `scene-breakdown`, and `narrative-beat-map` inputs.
- One primary shot per supported beat.
- Supplemental shots only for explicit reaction, turn, or spatial-transition evidence.
- Shot-size rules and review warnings.
- Existing normalized options.
- Requested count without filler invention.
- 120-shot boundary and deterministic repeated output.

### 12.3 Review and materialization

- Every item initially unapproved.
- Edit, reorder, remove, approve, reject, and rerun.
- Only approved entries enter grouped Text and approved Artifact payloads.
- Evidence remains canonical after user edits.
- Grouped per-scene creation and evolving occupancy.
- Source immutability, stale-source guard, duplicate feedback, and partial-failure lock.
- Approved Artifact persistence, reload, project reopen, and downstream handoff.
- Absent historical Artifact falls back to Text; malformed present Artifact blocks.

### 12.4 Shot List Builder compatibility

- Existing global entry remains.
- Eligible Text-node entry opens the same panel.
- Planning uses `shot-planning`, not `FILLER_POOL`.
- Draft creation uses approved shots only.
- Duplicate individual shots are not recreated.
- Generation remains behind its existing second confirmation.
- Only newly created nonduplicate node IDs reach auto-generate.
- Panel analysis and grouped apply make no network requests.

### 12.5 Required verification

- focused unit and integration tests
- existing Skill runtime and fingerprint regression tests
- static boundary tests
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- forbidden-zone diff audit

## 13. Chrome QA

Local or Preview authenticated Chrome QA must cover:

1. Text -> Narrative Beat Analysis -> review -> grouped node.
2. Grouped Narrative Beats node -> existing Shot List Builder -> Artifact handoff.
3. Plain Text -> existing Shot List Builder independent run.
4. Save, reload, and project reopen restore approved Artifacts.
5. Duplicate grouped and individual apply feedback.
6. Generation action opens its second confirmation; do not confirm a real Provider call.
7. Network contains no automatic Generate, Provider, Billing, Credits, Wallet, Payment, or Recharge request.
8. Console contains no new product error.

Production Chrome QA repeats only safe, non-Provider paths after the implementation deployment is Ready.

## 14. Scope

Expected implementation scope:

- `apps/web/src/lib/skills/**`
- `apps/web/src/lib/canvas/shot-list.ts`
- `apps/web/src/components/create/ShotListBuilderPanel.tsx`
- `apps/web/src/components/create/canvas/skills/**`
- `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
- `apps/web/src/components/canvas/modal/canvasModalTypes.ts`
- `apps/web/src/components/create/AssetAgentToolbar.tsx`
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- focused and static tests
- Stage B spec, plan, and final status documents

Forbidden:

- Prisma schema and migrations
- environment files and Production DB
- `/api/generate/image` and `/api/generate/video`
- Provider adapters and BYOK semantics
- Billing, Credits, Wallet, Ledger, Payment, Recharge, and Checkout
- cn-executor
- `package.json`, `pnpm-lock.yaml`, and `next.config.js`
- real Provider calls or real payments during QA

## 15. Acceptance Criteria

1. Narrative Beat Analysis is independently callable from Text and through the runtime.
2. The existing Shot List Builder uses `shot-planning` as its planning engine and remains independently callable.
3. No second overlapping Shot Planning tool is introduced.
4. Both Skills run without third-party APIs.
5. Results include version, fingerprint, Artifact, evidence, warnings, and blockers.
6. Unsupported content is marked for review rather than invented.
7. Review supports edit, order, removal, and explicit approval.
8. Primary apply creates grouped per-scene Text nodes and preserves approved Artifacts.
9. Existing explicit draft and confirmed-generate paths remain compatible, approval-gated, and deduplicated.
10. Source nodes remain immutable and stale reviews cannot apply.
11. Save, reload, project reopen, and optional Artifact handoff pass.
12. Console, Network, tests, build, and forbidden-zone boundaries pass.
13. Production Chrome QA passes without a real Provider call.
14. Stage B closes without automatically starting Stage C.
