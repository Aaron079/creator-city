# Canvas Tool Result Quality Layer Design

**Status:** Proposed - awaiting Founder spec approval
**Task:** P1-CANVAS-TOOL-RESULT-QUALITY-LAYER
**Date:** 2026-08-01

## Intent

Strengthen existing Creator City Canvas tools so their results are legible, attributable, and safe to continue from. This is an enhancement layer over the current dark Canvas, selected-node toolbar, `NodeToolCenter`, and existing tool panels. It does not introduce a second workbench, new workflow shell, or automatic action.

The user chose a shared quality model delivered in two releases:

1. image-creation results: Storyboard Grid Split, Draw Annotation, and Color Grade Palette;
2. director-review results: Continuity Checker, Asset Variant Planner, A/B Compare, and Keyframe Extractor.

## Shared Quality Model

Every eligible tool result exposes the same compact local model:

- **Status:** not started, processing, needs confirmation, completed, preview, failed, or unavailable;
- **Source:** the current immutable node or asset context;
- **Result:** an actual count, draft, derived artifact, or explicitly absent result;
- **Evidence:** tool-specific, deterministic facts supporting the status;
- **Next step:** one optional existing navigation, focus, or tool-opening action.

The model is a UI/view helper over existing component state and persisted metadata. It does not write metadata, generate a new identity, create a node, or change a source asset.

## User Experience

### Compact result summary

Existing tool panels gain a small summary strip in their result area. It reuses current Canvas dark surfaces, compact typography, thin white-alpha borders, existing button treatment, and the surrounding panel's spacing. It is not a floating card, a dashboard grid, or a new modal.

The strip can use status color sparingly:

- neutral for not started and informational states;
- cyan for completed or ready-to-continue;
- amber for confirmation or preview;
- rose for failed or unavailable.

No numeric score or synthetic quality percentage is shown. The result is explained through facts already known to the tool.

### Release 1: Image creation tools

**Storyboard Grid Split** shows detected or manually selected layout, confirmation state, source asset, actual crop and created-child counts, and the option to focus the relevant child node only after an existing child exists. An unconfirmed layout remains explicitly non-actionable.

**Draw Annotation** shows source-image lock, persisted annotation count, saved-versus-unsaved state, and whether a user may return to the existing node workflow. It does not claim persistence until the existing save path has succeeded.

**Color Grade Palette** always labels its output as a preview. It shows the selected color decisions and states that no derived asset or source-image rewrite has occurred. It may lead to an existing opt-in action, but never auto-applies a grade.

### Release 2: Director review tools

**Continuity Checker** retains its current deterministic analysis, but its summary prioritizes real blocking and warning evidence with focusable existing node references.

**Asset Variant Planner**, **A/B Compare**, and **Keyframe Extractor** show their existing source, result type, usable output/draft count, and the next existing opt-in action. A result is not described as an asset unless it is already a real asset or derived node.

## State and Safety Rules

- A result summary is read-only until the user activates an existing explicit tool action.
- Source nodes and source assets stay immutable.
- "Processing" is reserved for a real existing local or server-backed operation; it is never used as decoration.
- Preview is distinct from completed, and unavailable/failed is distinct from a missing result.
- A next step can only focus an existing node, open an existing tool, or reveal an existing result. It cannot auto-generate, upload, save Canvas, create an asset, create a node, call a Provider, or mutate payment/credits.
- Existing cancellation, recovery, deduplication, and provenance contracts remain unchanged.

## Implementation Boundaries

Likely code is limited to a small pure result-quality helper, focused tests, and the existing panels named in this document. Exact files are confirmed during implementation audit.

Out of scope: Prisma/schema/migrations, API routes, Generate image/video routes, Provider adapters, BYOK semantics, billing/payment/credits/wallet, env, package/lockfile, cn-executor, and Production database changes.

## Acceptance Criteria

1. Release 1 panels show the shared five-part quality summary only when their existing state supports it.
2. Grid Split cannot claim completed children before the existing crop/create result exists.
3. Annotation cannot claim saved until its existing save state is confirmed.
4. Color Grade stays explicitly preview-only and cannot imply a source rewrite or derived asset.
5. Release 2 summaries preserve real evidence and direct the user only to existing nodes or existing tools.
6. No summary or suggested next step causes a generate, Provider, upload, billing, payment, credit, wallet, or Canvas-save request.
7. The existing dark compact Canvas visual language remains intact at desktop and narrow widths.
8. Focused pure/component tests, type-check, lint, build, diff check, prohibited-zone diff audit, and safe browser QA pass before closeout.

## Verification Plan

1. Write failing unit tests for state-to-summary mapping before each implementation slice.
2. Add rendered panel tests for truthful completed, preview, and blocked states.
3. Run existing focused tool tests plus the new result-quality tests.
4. Run `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check`.
5. Browser QA uses existing persisted Canvas media only. It must not save, generate, upload, execute a Provider request, or create a payment/credit mutation.
6. Production QA verifies visible summaries, preserved current actions, and console boundaries; unsupported network capture remains a harness limitation rather than a product claim.

## Non-Goals

- Replacing existing tools or changing their core algorithms.
- A generic scorecard, fake AI confidence, or quality percentage.
- Auto-fixing continuity findings, auto-applying color grades, or automatic derived creation.
- A new AI Director product, separate panel framework, left rail, or dashboard.
