# P0 Canvas Storyboard Script V1 Design

## Status

Audit closed: the requested design is already implemented by the existing Creator
Skill Engine Stage C Storyboard Director Recipe. No duplicate implementation plan
or product-code change is required.

## Goal

Strengthen the existing Storyboard Director into one coherent script-to-storyboard
workflow. A creator starts from an existing Text node, reviews deterministic scene,
narrative-beat, and shot drafts, then deliberately materializes approved work as
derived Canvas nodes. The feature must feel like one workflow without duplicating
the existing Creator Skills, file-import UI, or Storyboard Director data model.

## Product Decision

The workflow is integrated into the existing Storyboard Director Recipe. It is not
a new standalone script workbench and it accepts only existing Text nodes as its
source in V1.

Creators may create or import their text using the current product entry points,
then choose that Text node in Storyboard Director. The source node is immutable;
every derived scene, beat, shot plan, and optional image/video draft preserves
source provenance.

## Existing Contracts To Reuse

The implementation must compose the existing contracts instead of cloning them:

- `script-segmentation` produces reviewable scene drafts and scene artifacts.
- `narrative-beat-analysis` produces reviewable beat drafts from approved scenes.
- `shot-planning` produces reviewable shot drafts from approved beats.
- `StoryboardDirectorRecipe` persists the source snapshot, stage status, review
  drafts, approved artifacts, findings, receipts, and board synchronization state.
- Existing grouped materialization creates derived Text nodes and stable edges.
- Existing compatibility draft planning creates image/video draft nodes only after
  explicit creator action.
- Existing recipe identity, receipt, and partial-batch logic prevents duplicate
  nodes after rerun, refresh, or retry.

No new schema, API route, persistence store, provider call, or file-import path is
needed for V1.

## User Flow

1. A creator selects an existing non-empty Text node and opens Storyboard Director.
2. The Director creates or reopens the source-bound Recipe control node.
3. The Recipe runs scene review using the existing deterministic segmentation skill.
4. The creator can edit scene fields, approve selected scenes, or rerun after
   changing the source Text node.
5. Approved scenes unlock beat review. The creator reviews, edits, and approves
   narrative beats.
6. Approved beats unlock shot review. The creator reviews and edits objective,
   subject, action, shot size, output kind, and duration.
7. The Director shows recipe findings and the exact impact of changing an approved
   upstream item. Downstream stages become stale rather than silently overwritten.
8. The creator chooses one explicit outcome:
   - materialize grouped text artifacts and edges;
   - synchronize approved shots to the existing Storyboard board;
   - create compatible image/video draft nodes.
9. Canvas save and reload restore the Recipe control node, reviews, receipts, and
   all created nodes. Repeating an already completed action reports skips rather
   than creating duplicates.

## Interface Design

Storyboard Director remains the single visible entry. Its Recipe tab is the
workflow surface and the existing Board tab remains for manual shot management.

- The source selector lists eligible Text nodes and identifies the selected source.
- Stage order is visually fixed: Source, Scenes, Beats, Shots, Intelligence,
  Materialize.
- A later stage is unavailable until the prior stage has approved content.
- Review cards expose only fields the existing Recipe state machine permits to be
  edited. Each card shows source-line evidence and approval state.
- The Materialize area keeps grouped nodes, board synchronization, and image/video
  drafts as separate explicit commands. It never contains an automatic Generate
  action.
- Existing dialog positioning, focus management, and modal cleanup contracts apply;
  no new fullscreen workbench or parallel tool panel is introduced.

## State, Identity, And Recovery

The Recipe control node is the durable workflow anchor. Its source fingerprint,
stage generation, approved artifact identity, and materialization receipts remain
the authority for resume and dedupe.

- Source change invalidates downstream stages through the existing stale-state
  transition. It does not replace already materialized Canvas nodes.
- A rerun with unchanged approved inputs reuses the same logical Recipe identity.
- Materialization identity remains scoped to recipe, source artifact, scene/beat/
  shot identity, project, and workflow. It must not use timestamps or random IDs
  as a duplicate-prevention key.
- Partial batches retain their existing recovery lock and receipt acknowledgement
  behavior. The UI reports actual created and uncreated counts instead of assuming
  success.
- Closing a review panel without committing an approval leaves persisted Recipe
  state untouched. Existing save integrity rules remain responsible for cloud
  persistence.

## Failure And Safety Behavior

- Empty, invalid, or non-Text sources remain blocked with actionable feedback.
- Invalid skill artifacts are treated as blocked review results and are never
  materialized.
- An upstream edit marks dependent review content stale; it never applies stale
  drafts or hides the impact from the creator.
- A materialization exception reports partial completion, locks unsafe replay, and
  requires the existing acknowledgement/recovery path.
- The workflow makes no Provider, Generate, payment, billing, credit, wallet,
  recharge, checkout, or upload request. Image/video draft nodes are only plans;
  generation remains an independent explicit node action.

## Scope

Expected implementation areas are limited to the existing Storyboard Director
Recipe UI/orchestration and focused unit/static/browser coverage around it:

- `apps/web/src/components/create/StoryboardDirectorPanel.tsx`
- `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx`
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- existing recipe/materialization helpers and their focused tests
- task-specific static/browser test files
- `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` after verification

The final plan must reduce this list to the files actually required.

## Explicit Non-Goals

- No standalone script workbench, new file uploader, or duplicate Skill registry.
- No schema or migration change.
- No new API route or server-side parsing service.
- No external model/Provider call and no real image/video generation in QA.
- No payment, billing, credits, wallet, BYOK, executor, package, lockfile, env,
  next-config, or Production database change.
- No automatic materialization or automatic generation.

## Validation

The implementation plan must require TDD and prove:

1. Text-only source eligibility and source immutability.
2. Scene-to-beat-to-shot approval gates and editable-field validation.
3. Source edit invalidation with visible downstream impact.
4. Stable recipe identity and duplicate-safe repeated materialization.
5. Partial-batch recovery and receipt-aware retry behavior.
6. Canvas save/reload restoration for the workflow and derived nodes.
7. No forbidden Generate, Provider, payment, billing, credit, wallet, recharge,
   checkout, or upload mutations during the exercised workflow.
8. Existing type-check, lint, build, diff-check, targeted tests, and safe browser
   QA, with Preview/Production claims reported separately.

## Audit Result

The current implementation already satisfies this design. The Recipe panel exposes
the Source, Scenes, Beats, and Shots stages; the existing state machine advances
only through approved artifacts; materialization, board synchronization, and draft
node creation are separate explicit actions; and the control node/receipt contract
handles persistence, dedupe, and partial-batch recovery.

The focused regression suite completed 119 passing tests across Recipe progression,
identity, persistence, intelligence, grouped materialization, shot-board
synchronization, compatibility drafts, and recovery. This design document remains
the concise product reference for the existing capability rather than an unstarted
implementation request.
