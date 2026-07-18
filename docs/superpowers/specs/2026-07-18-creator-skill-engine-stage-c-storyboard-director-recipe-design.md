# Creator Skill Engine Stage C Storyboard Director Recipe Design

Date: 2026-07-18

Status: Founder-approved design; awaiting written-spec review

Task: `P0-CANVAS-CREATOR-SKILL-ENGINE-STAGE-C-STORYBOARD-DIRECTOR-RECIPE`

## 1. Purpose

Stage C upgrades the existing Storyboard Director into a canvas-native, deterministic planning workspace that orchestrates three already independent Creator Skills:

1. `script-segmentation`
2. `narrative-beat-analysis`
3. `shot-planning`

The Recipe guides a user from source script through scene, narrative beat, and shot review. An approved stage automatically runs the next local Skill and opens its review state. It never automatically creates canvas nodes, invokes a media Provider, starts generation, or mutates billing.

Stage C strengthens the existing Director and the existing Skills. It does not replace them and does not add a duplicate Storyboard Director.

## 2. Approved Product Decisions

1. Upgrade the existing `StoryboardDirectorPanel`; do not create another product entry with the same name.
2. Add two primary tabs to the Director:
   - `剧本编排`: source, scene, beat, and shot review Recipe.
   - `镜头板`: the existing shot-card editor and timeline, strengthened with Recipe provenance and quality feedback.
3. Keep all three Creator Skills independently callable from eligible Text nodes.
4. The Recipe is an orchestration layer, not a fourth executable Skill.
5. Call Skills only through the public Creator Skill runtime. The Recipe must not import private parsers to reproduce Skill behavior.
6. After a user approves a stage, run the next deterministic Skill automatically and enter its pending review state.
7. Never materialize nodes or sync the shot board without an explicit user action.
8. Never invoke a Provider, generation route, billing route, payment route, or credit mutation from Recipe analysis, review, approval, save, rerun, or materialization.
9. Persist the Recipe in a visible canvas control node so it survives cloud save, reload, project reopen, and a different authenticated browser.
10. Preserve the source Text node exactly. Recipe state and approved output belong to the control node and derived nodes.
11. Use stable source and Artifact identities for deduplication. Do not use timestamps or random values as idempotency identities.
12. Add a deterministic Director Intelligence layer for cross-stage quality checks. Do not display invented confidence percentages.

## 3. Existing Capability Relationship

| Existing capability | Stage C action |
| --- | --- |
| Storyboard Director | Strengthen in place with Recipe and cloud-backed state |
| Storyboard Timeline and shot cards | Preserve under the `镜头板` tab |
| Add canvas node to Director | Preserve; manual and Recipe-derived shots may coexist |
| Script Segmentation | Preserve independent entry and public runtime contract |
| Narrative Beat Analysis | Preserve independent entry and public runtime contract |
| Shot List Builder / Shot Planning | Preserve independent entry, review, grouped apply, compatibility drafts, and generation confirmation |
| Shot Sequencer | Preserve as a separate ordering tool |
| Storyboard Grid Split | Preserve as an image-cropping tool with a separate responsibility |
| Storyboard Preview | Preserve as a visual sequence preview |

The existing Director currently edits locally stored shot cards and binds existing canvas nodes. Stage C adds structured script planning and moves Recipe-backed Director state into cloud-saved canvas metadata. It does not silently discard or overwrite legacy local shot cards.

## 4. Market Position and V1 Differentiation

Current first-tier storyboard products commonly offer script import, automatic scene or shot creation, camera controls, character consistency, visual generation, timeline editing, and review workflows. Reference products reviewed for this design:

- LTX Studio: <https://ltx.io/studio/platform/ai-movie-maker>
- Boords script-to-storyboard documentation: <https://boords.com/docs/creating-storyboards>
- Katalist storyboard workflow: <https://www.katalist.ai/>
- StoryboardHero features: <https://storyboardhero.ai/features>

Stage C does not claim to surpass those products in generated visual quality because media generation is outside this task. Its first-tier target is professional planning control and trust:

- every analysis item links to source evidence;
- the user can edit and approve each planning stage;
- upstream changes explicitly invalidate downstream work;
- standalone Skills and the complete Recipe are both available;
- approved Artifacts and lineage survive canvas save and reload;
- deterministic reruns produce stable identities;
- results materialize directly into the infinite canvas;
- analysis is Provider-independent and cannot spend credits;
- cross-stage coverage and integrity checks are visible before materialization.

These are release requirements, not marketing claims.

## 5. Architecture

```text
Existing Storyboard Director
  +-- 剧本编排 tab
  |     +-- StoryboardDirectorRecipe state machine
  |     +-- public runCreatorSkill boundary
  |     +-- Director Intelligence validator
  |     +-- review editors and evidence inspector
  |     +-- explicit materialization actions
  +-- 镜头板 tab
        +-- existing ShotCard editor and timeline
        +-- Recipe provenance and sync state
        +-- existing manual node binding

Visible Director control Text node
  +-- human-readable progress summary
  +-- metadataJson.storyboardDirectorRecipe
  +-- approved Artifact checkpoints
  +-- Director shot-board snapshot
  +-- materialization receipts
```

The Recipe state machine is a pure local module. React owns presentation and delegates all transitions to pure functions. Canvas integration owns node creation, node patching, local snapshot flush, and the existing scheduled cloud save.

The Recipe invokes `runCreatorSkill` with approved upstream Artifacts. It does not call one Skill's parser from another layer, and it does not register Recipe orchestration in the executable Skill registry.

## 6. Recipe Lifecycle

### 6.1 Start

The Recipe starts from one eligible Text node. The user explicitly chooses to create a Director Recipe. That action creates one visible `分镜导演` Text control node derived from the source.

Starting a Recipe requires stable project and workflow identities. Before creation, the canvas searches for an existing valid control node with the same Recipe identity. If one exists, it opens that Recipe instead of creating a duplicate. A conflicting or malformed match blocks creation and requires review.

The control node stores a frozen source snapshot identity and initially displays a concise progress report. Merely opening an existing Director or opening a standalone Skill does not create a control node.

### 6.2 Stages

The Recipe has four user-facing stages:

1. `source`
2. `scene-review`
3. `beat-review`
4. `shot-review`

Internal stage states are:

- `idle`
- `running`
- `needs-review`
- `approved`
- `stale`
- `blocked`

Only one deterministic Skill run may be active for one Recipe at a time.

### 6.3 Source stage

The source stage displays:

- source node title and identity;
- effective source length;
- detected script format after segmentation;
- supported processing limits;
- source-stale status;
- link to focus the source node.

It never edits the source node.

### 6.4 Scene review

Run `script-segmentation` through the public runtime. Review supports:

- scene heading, location, time, characters, and action-summary edits;
- approve, reject, and pending decisions;
- scene reorder;
- source evidence inspection;
- rerun from the frozen source snapshot.

Every item begins pending. A scene marked `needs-review` cannot be approved through a blanket batch action.

When the user approves the stage, create an approved scene-breakdown checkpoint in Recipe state and immediately run `narrative-beat-analysis` with that Artifact. Do not materialize scene nodes at this point.

### 6.5 Beat review

Review setup, goal, action, reaction, turn, closure, and unclassified beats by scene. Support:

- summary and supported type edits;
- approve, reject, pending, reorder, and remove-from-review actions;
- exact source excerpt inspection;
- jump to the next warning or pending item.

Approving the stage creates an approved narrative-beat-map checkpoint and immediately runs `shot-planning`. Do not materialize beat nodes at this point.

### 6.6 Shot review

Review each shot's:

- objective;
- subject;
- action;
- suggested shot size;
- output kind;
- duration;
- source scene and beat;
- source excerpt;
- review issue.

Keep the existing normalized shot-planning options: requested shot count, output mode, pacing, shot-size strategy, and user instruction. Changing an option reruns only shot planning and invalidates the prior shot approval.

Final approval marks the Recipe ready for explicit materialization. It does not create nodes or start generation.

## 7. Automatic Progression Rules

Automatic progression means analysis convenience, not autonomous mutation.

1. A stage advances only after explicit stage approval.
2. Approval freezes the reviewed upstream Artifact snapshot.
3. The next Skill runs immediately with the frozen approved Artifact.
4. A successful result opens as pending review.
5. A blocked result stops progression and preserves all approved upstream state.
6. Closing the panel during a synchronous local run must not apply stale UI state after the source, Recipe, or project changes.
7. Rerun never carries old item decisions into a different fingerprint.
8. No stage auto-approves items.

## 8. Stable Identity and Provenance

The Recipe identity derives from:

- Recipe schema version;
- project ID;
- workflow ID;
- source node ID;
- effective source-content fingerprint.

The implementation must use canonical deterministic serialization. Current time, random UUIDs, browser session identifiers, and React mount identity are forbidden as idempotency inputs.

Every stage checkpoint stores:

- Skill ID and version;
- run fingerprint;
- source node IDs;
- source Artifact IDs;
- approved output Artifact;
- evidence;
- review decisions and user-editable reviewed values;
- stage status.

Audit timestamps may be recorded for display, but changing a timestamp must not change Recipe, Artifact, or materialization identity.

## 9. Persistence Model

The visible control node stores a versioned value at:

```ts
metadataJson.storyboardDirectorRecipe
```

The persisted payload contains:

- Recipe identity and schema version;
- frozen source snapshot identity;
- current stage;
- stage run results needed for review;
- approved Artifact checkpoints;
- Director Intelligence findings;
- synchronized Storyboard shot-card snapshot;
- materialization receipts;
- legacy import status.

The control node's human-readable Text content summarizes progress and remains useful if metadata cannot be rendered by a future client.

The Recipe payload must be validated through a strict reader. Malformed, inherited, accessor-backed, oversized, unsupported-version, or identity-conflicting metadata blocks the Recipe. It must not silently fall back to parsing the control node's display text.

Every successful transition patches the control node, flushes the existing local canvas snapshot, and schedules the existing canvas save. Review-field changes are committed on an explicit item decision, reorder, field blur, or stage action; raw pointer movement and every input keystroke must not schedule a Canvas PUT. The existing bounded save scheduler may coalesce committed changes. The UI must distinguish local preservation from acknowledged cloud save. A failed cloud save cannot be reported as cloud-saved.

## 10. Legacy Director Migration

The existing Storyboard Director stores `StoryboardState` in project-scoped `localStorage`. Stage C handles it as follows:

1. Detect valid legacy local shot cards when opening the upgraded Director.
2. Offer an explicit `导入本地镜头板` action when the active Recipe has no imported snapshot.
3. Preview the number of manual shots and node bindings before import.
4. Import without deleting or changing the legacy local copy.
5. Deduplicate Recipe-derived shots by stable shot identity and manual shots by their existing shot identity.
6. Never overwrite a nonempty cloud-backed Director snapshot automatically.

After import, the control-node snapshot becomes the source of truth for that Recipe's shot board. Legacy `localStorage` may remain as a compatibility mirror, but it must not overwrite newer cloud-backed Recipe state. Changes to the Recipe-backed shot board persist in the control node through normal canvas saving.

## 11. Invalidation and Change Impact

### 11.1 Upstream review changes

- Scene approval changes invalidate beat and shot stages.
- Beat approval changes invalidate the shot stage.
- Shot option changes invalidate only shot review and final readiness.
- Manual shot-card changes do not rewrite approved Skill Artifacts.

Invalidated downstream results remain available as read-only comparison data but cannot be materialized or synchronized.

### 11.2 Source changes

If the current source node's effective text differs from the frozen fingerprint, the Recipe becomes `source-stale`. The user must explicitly start a new Recipe version from the updated source. Old decisions are not silently transferred.

### 11.3 Change-impact preview

Before changing approved upstream content, show:

- downstream beat count that will become stale;
- downstream shot count that will become stale;
- already materialized canvas nodes that will remain untouched;
- stages that require rerun and review.

Confirming invalidation changes Recipe state only. It never deletes derived nodes.

## 12. Director Intelligence

Director Intelligence is a pure deterministic validator over approved Recipe snapshots. It does not create story content and is not registered as a Skill.

### 12.1 Blocking findings

- Artifact lineage does not match the active Recipe.
- Source node or source content is stale.
- An approved scene has no approved beat.
- An approved beat has no approved shot.
- A shot references a missing or rejected scene or beat.
- A shot lacks subject, action, or source evidence.
- Artifact metadata is malformed or uses an unsupported version.
- Review still contains unresolved pending items.
- A materialization receipt conflicts with the planned stable identity.

Blocking findings prevent shot-board synchronization, grouped-node materialization, and compatibility draft creation.

### 12.2 Advisory findings

- adjacent shots have substantially duplicated objective and composition;
- one shot size repeats excessively without source support;
- a scene has no establishing shot;
- an explicit reaction or turn lacks a visual-response shot;
- output kind conflicts with action duration or motion requirements;
- pacing and duration choices conflict;
- requested shot count differs from evidence-supported output;
- character or scene naming differs across approved stages.

Every finding identifies its scene, beat, or shot and explains the deterministic rule. Do not show opaque confidence percentages.

### 12.3 Status strip

The Director header continuously reports:

- approved scenes, beats, and shots;
- unresolved findings;
- exact beat coverage count and ratio;
- source freshness;
- materialization readiness;
- canvas cloud-save status.

## 13. User Experience

### 13.1 Primary layout

The upgraded Director uses one professional workspace rather than nested cards:

- header with tabs, source, Recipe state, save state, intelligence summary, and close action;
- left stage navigation;
- central review editor;
- right evidence and issue inspector;
- fixed action bar for rerun, approval, save, and explicit materialization.

Desktop uses three separated work regions. Narrow screens switch between stage, review, and evidence views. Desktop remains the primary commercial workflow.

### 13.2 Review efficiency

Support:

- scene grouping and collapse;
- pending, warning, approved, and rejected filters;
- jump to next unresolved finding;
- keyboard navigation and item decisions;
- scene-level batch decisions that exclude `needs-review` items;
- stable scroll position during automatic progression;
- segmented rendering for large scripts.

Loading UI must name the actual local stage. Do not display fake indefinite progress.

### 13.3 Shot-board tab

Preserve existing timeline, shot detail editing, ordering, deletion confirmation, and canvas-node binding. Add:

- Recipe scene and beat provenance;
- synchronized and unsynchronized markers;
- quality findings;
- navigation back to the corresponding review item;
- coexistence of manual and Recipe-derived shots.

Manual shots are never automatically deleted when a Recipe reruns.

## 14. Materialization

Final approval enables separate explicit actions:

1. Create grouped Scene Text nodes.
2. Create grouped Narrative Beats Text nodes.
3. Create grouped Shot Plan Text nodes.
4. Synchronize approved shots to the Director shot board.
5. Create compatibility Image or Video draft nodes from approved shots.

Generation remains a separate existing action with the existing second confirmation. Stage C does not weaken or bypass that confirmation.

### 14.1 Deduplication

Grouped Skill results continue using Skill ID, run fingerprint, and result ID. Recipe-level receipts additionally bind the Recipe identity, stage, Artifact ID, and result identity.

Shot-board sync deduplicates Recipe-derived shots by approved shot ID plus Recipe identity. Manual shots retain their existing identity and are not deduplicated against unrelated planned shots by title or text.

Repeated actions report created and existing counts. They must not create duplicate nodes, edges, shot cards, or generation submissions.

### 14.2 Partial failure

Materialization validates the full plan before the first mutation. If a callback fails after partial creation:

- record completed identities when safe;
- lock the current materialization batch;
- list known created and uncreated items;
- require canvas inspection before retry;
- do not claim atomic rollback;
- do not auto-delete nodes.

## 15. Failure Handling

- Next Skill blocked: preserve approved upstream state and expose blockers.
- Cloud save failure: retain local snapshot and display local-only status.
- Panel close: persist the latest valid Recipe transition before close when possible.
- Source node deletion: block the Recipe and retain approved results read-only.
- Control-node deletion: delete the Recipe with normal canvas deletion semantics; do not mutate source or derived nodes.
- Artifact corruption: block; do not parse display text as a replacement.
- Unsupported future version: block with an upgrade-required message.
- Duplicate apply: skip duplicates and report identities.
- Partial callback failure: lock the batch and require inspection.
- Project change during a run: discard stale completion for the previous project context.

No Recipe error path may call a Provider, generate route, billing route, or payment route.

## 16. Limits and Performance

Stage C inherits the current Skill hard limits:

- at most 40 scenes;
- at most 120 narrative beats;
- at most 120 planned shots.

Exceeding a limit blocks with a clear message instead of silently truncating. Review rendering should mount content by scene so a maximum supported Recipe does not mount every editor at once.

Opening, reviewing, filtering, and approving a Recipe must not schedule canvas PUT requests on pointer movement or every field keystroke. Persist on explicit transitions and the existing bounded save schedule. Recipe analysis performs no network request.

## 17. Test Strategy

### 17.1 Pure unit tests

- every legal and illegal Recipe state transition;
- automatic next-stage execution after explicit approval;
- no progression without approval;
- exact downstream invalidation rules;
- source-stale detection and new-version requirement;
- canonical Recipe identity and timestamp independence;
- Artifact lineage and strict metadata reader;
- Director Intelligence blocking and advisory rules;
- change-impact counts;
- legacy Director import and dedupe;
- Recipe serialization and reload;
- materialization planning and receipts;
- duplicate and partial-failure handling.

### 17.2 Skill regression tests

- all existing `script-segmentation` tests;
- all existing `narrative-beat-analysis` tests;
- all existing `shot-planning` tests;
- public runtime and fingerprint tests;
- approved Artifact reader tests;
- existing grouped materialization and Shot List Builder tests.

Tests must demonstrate that the Recipe calls Skills through the public runtime and that each Skill remains independently callable.

### 17.3 Component and integration tests

- existing Director opens both tabs without duplicate modal state;
- creating a Recipe creates exactly one control node;
- stage review edits and decisions persist;
- approval opens the next review result;
- evidence selection focuses the correct excerpt;
- source changes display impact and block stale apply;
- shot-board sync preserves manual shots;
- save and reload restore Recipe and board state;
- final actions are disabled by blocking findings;
- generation confirmation remains separate.

### 17.4 Static boundary tests

Assert that the Stage C implementation does not modify or call:

- `/api/generate/image`;
- `/api/generate/video`;
- Provider adapters;
- Billing, credits, wallet, payment, recharge, or checkout;
- Prisma schema or migrations;
- `cn-executor`;
- environment configuration.

## 18. Browser QA

Authenticated Google Chrome QA must cover:

1. Open a project and create or select a source Text node.
2. Explicitly create a Director Recipe control node.
3. Complete scene review and verify automatic beat analysis.
4. Complete beat review and verify automatic shot planning.
5. Close midway, refresh, reopen the project, and resume.
6. Reopen in a second authenticated browser and verify cloud recovery.
7. Change upstream approval and verify exact downstream invalidation.
8. Change source text and verify `source-stale` blocking.
9. Resolve quality blockers and reach final readiness.
10. Materialize grouped nodes and repeat the action without duplicates.
11. Synchronize the shot board while preserving a manual shot.
12. Create compatibility drafts without generation.
13. Open generation confirmation and cancel before any Provider call.
14. Verify the saved Recipe and derived nodes after refresh.

Network and console boundaries:

- no automatic `/api/generate/*` request;
- no Provider request;
- no billing, credits, wallet, payment, recharge, or checkout mutation;
- no Canvas PUT storm;
- no React uncaught exception, hydration error, unhandled rejection, or product API 5xx caused by Stage C;
- no obvious interaction stall for supported 20-scene and 40-scene fixtures.

Tooling limitations must be reported separately from product failures. Local PASS must not be reported as Production PASS.

## 19. Release Gate

Stage C is ready for public use only when:

- P0 findings are zero;
- blocking P1 findings are zero;
- all approved items are source-traceable;
- cross-stage lineage and coverage checks pass;
- save, refresh, project reopen, and second-browser recovery pass;
- repeated materialization and sync create no duplicates;
- standalone Skill behavior remains intact;
- no automatic Provider or billable request occurs;
- authenticated Production Chrome Golden Path passes;
- forbidden-zone diff is empty.

## 20. Scope

Expected implementation scope is limited to:

- Storyboard Director UI and its focused tests;
- new Recipe state, validation, identity, persistence, and materialization helpers;
- focused integration in `VisualCanvasWorkspace`;
- existing modal or tool entry types only where required to strengthen the same Director;
- static boundary tests;
- task status documentation after implementation and Production validation.

The exact file list and TDD sequence belong in the implementation plan after written-spec approval.

## 21. Explicit Non-Goals

- no new executable Creator Skill;
- no general-purpose Agent DAG platform;
- no autonomous creative decisions without review;
- no image or video generation changes;
- no Provider adapter or BYOK changes;
- no billing, credits, wallet, payment, recharge, or checkout changes;
- no Prisma schema, migration, or Production DB changes;
- no `cn-executor` changes;
- no new package dependency;
- no collaborative comments, client sign-off, PDF export, animatic audio, or pitch-deck work in Stage C;
- no claim that Stage C alone surpasses competitors in generated visual quality.

## 22. Completion Definition

Stage C is complete only when the existing Storyboard Director provides a cloud-recoverable, evidence-backed scene-to-beat-to-shot Recipe; the three Skills remain independently callable; the quality engine blocks structurally unsafe output; explicit materialization and shot-board synchronization are stable and deduplicated; generation remains separately confirmed; all required tests and authenticated Production browser QA pass; and every forbidden boundary remains untouched.
