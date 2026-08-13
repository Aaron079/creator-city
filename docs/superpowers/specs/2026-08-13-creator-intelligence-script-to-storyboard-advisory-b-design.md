# Creator Intelligence Script-to-Storyboard Advisory B Design

## Status

Approved for planning. This document defines the next Creator Intelligence increment after the local knowledge foundation.

## Goal

Strengthen the existing Storyboard Director Recipe with deterministic, evidence-backed professional advisories. The system helps a creator review a script, approved beats, and approved shots without replacing the creator's judgment or creating a parallel storyboard tool.

The V1 outcome is a compact `建议审阅` layer inside the existing Storyboard Director review and evidence surfaces. It uses the versioned, local Creator City cinematic knowledge pack and exposes its selection receipt.

## Product Rules

- Existing blocking findings remain unchanged. They continue to prevent approval and materialization where the existing Recipe requires it.
- New professional findings are advisories only. They never block stage approval, shot-board sync, local sketch-board creation, grouped materialization, or draft-node creation.
- An advisory never edits a scene, beat, shot, prompt, board frame, or node.
- V1 never invokes an external model, Provider, BYOK flow, generation route, network collection, crawler, payment, billing, credit, database migration, environment variable, or executor.
- No numeric quality score, synthetic confidence percentage, or claim of generated artwork is permitted.

## V1 Advisory Families

1. Narrative purpose: a selected shot must have a readable relationship to action, reaction, turn, or information delivery; where evidence is insufficient, the result is a request for human review rather than a false assertion.
2. Shot-size and composition rhythm: flag repetitive adjacent shots, sustained identical shot sizes, missing establishing coverage when scene setup supports that inference, and unclear subject hierarchy when structured evidence supports it.
3. Continuity: flag action handoff, eyeline, and screen-direction situations that require creator confirmation. The advisory must say `需要人工确认`; it must not assert that a physical continuity error exists without source evidence.
4. Lighting motivation: flag a missing or unresolved lighting/time-of-day relationship only when the approved scene or shot exposes enough structured information to make that absence meaningful.

## Architecture

### Existing Owners

- `apps/web/src/lib/storyboard/recipe/intelligence.ts` remains the single deterministic analyzer for Recipe findings.
- `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx` remains the existing review and evidence UI owner.
- `apps/web/src/lib/storyboard/recipe/persistence.ts` remains the strict Recipe persistence validator.
- `apps/web/src/lib/creative-knowledge/resolver.ts` remains the only source of local knowledge selection and `ckr1_` receipts.

### New Pure Advisory Layer

Introduce a pure module below `apps/web/src/lib/storyboard/recipe/` that:

1. Resolves the local cinematic knowledge by the required capability domains and `retrieval` use.
2. Receives an immutable Recipe snapshot and the selected local knowledge records.
3. Emits deterministic advisory candidates with stable identities, linked scene/beat/shot IDs, rule IDs, source evidence IDs, and the resolver receipt.
4. Treats absent structured evidence as no finding unless the rule is expressly a human-confirmation rule.

The existing analyzer merges those candidates with existing findings. Blocking ordering remains unchanged; advisory ordering is explicit and stable.

## Advisory Decision State

Advisory handling is persisted as a bounded, version-scoped state on the Recipe:

- `open`: visible and awaiting creator review.
- `reviewed`: creator marked it reviewed without changing its result.
- `ignored`: creator hid it for the current advisory version.

Each handling record stores the advisory identity, its input fingerprint, the knowledge selection fingerprint, decision, and timestamp. It stores no free-form user text in V1.

The displayed state is derived, not trusted blindly:

- A handling record applies only when its advisory ID, Recipe input fingerprint, and `ckr1_` receipt fingerprint match the current evaluation.
- If the source script, approved scene/beat/shot content, or knowledge pack selection changes, the old handling state is inactive. The advisory is re-evaluated as `open`.
- Inactive historical handling records are retained only within the bounded Recipe receipt/decision limit; they may be pruned deterministically with the existing bounded audit pattern.
- `恢复提示` changes a current `ignored` advisory back to `open` without changing the Recipe content.

## UI

Reuse the existing `问题` metric, review workspace, and evidence inspector.

- The metric separately presents blocking and advisory counts.
- The evidence inspector groups `需要处理` and `建议审阅`; the latter uses a calm advisory treatment rather than warning red.
- Each advisory has: concise explanation, affected IDs, `查看依据`, `标记已审阅`, `忽略本条`, and `跳到关联镜头` when a shot link exists.
- Ignored advisories are hidden from the default list and available through the existing filter pattern. They can be restored.
- The evidence drawer shows local knowledge rule IDs and a shortened `ckr1_` receipt. It must label the source as local approved rules, not as model reasoning.
- No new global sidebar, modal, or canvas node type is added.

## Persistence and Compatibility

- Bump the Recipe schema only if strict persistence cannot represent version-scoped advisory decisions compatibly.
- Older valid Recipe records load without decisions and derive all current advisories as `open`.
- Persisted advisory decisions must be strict: own data properties, exact keys, finite bounded arrays, unique identities, valid timestamps, valid enum values, and no unknown fields.
- The metadata must retain existing Storyboard Director identity, source freshness, result artifacts, board persistence, and materialization receipts exactly as today.

## Error Handling

- A malformed local pack or selection receipt fails closed inside the advisory evaluator and produces no false advisory. It must not convert a valid existing Recipe into a blocker.
- Invalid persisted decision metadata is handled under the existing Recipe persistence failure policy; it must never be silently reinterpreted as a creator decision.
- A missing rule-to-structured-evidence mapping produces no result, not a generic warning.

## Testing and QA

TDD precedes implementation.

- Pure contracts: deterministic rule selection/order, stable advisory identity, receipt sensitivity, no advisory from absent evidence, and every V1 family.
- Decision contracts: reviewed/ignored/restore behavior; change to source, approved content, or local pack receipt invalidates prior handling.
- Existing intelligence regression: blocking findings still override advisories and advisory-only Recipes remain materialization-ready.
- Persistence: old compatible Recipe load, strict malformed decision rejection, save/reload of current decisions.
- Rendered UI: correct grouping and labels, no duplicate entry points, evidence drawer contents, and focus routing to a linked shot.
- Static boundary: no fetch, network client, Provider, generate, billing/payment/credit, Prisma, environment, or executor dependency from the new modules.
- Final validation: targeted tests, full type-check, lint, build, diff-check, forbidden-zone diff audit, and authenticated-safe browser QA if a non-mutating existing Recipe is available. Browser limitations must be reported honestly.

## Acceptance Criteria

1. Existing Storyboard Director remains the only workflow surface.
2. All four V1 advisory families are deterministic and evidence-linked.
3. Advisories do not block existing materialization readiness.
4. Creator reviewed/ignored decisions are version-scoped, recoverable, and automatically invalidated on relevant input or knowledge changes.
5. Every displayed advisory can expose its local rule IDs and `ckr1_` selection receipt.
6. Existing source/scene/beat/shot review, sketch board, persistence, and materialization tests remain passing.
7. No forbidden service, route, schema, environment, payment, Provider, or production database change is present.

## Out of Scope

- Automatic script, beat, shot, prompt, or storyboard-frame rewrites.
- Image, video, or text generation.
- Trained model inference or model fine-tuning.
- Web crawling, external collection, or source ingestion.
- New Canvas panel, global Intelligence sidebar, database migration, or API route.
