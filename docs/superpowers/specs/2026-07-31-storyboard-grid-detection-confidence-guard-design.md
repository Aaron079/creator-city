# Storyboard Grid Detection Confidence Guard Design

**Task:** `P1-CANVAS-STORYBOARD-GRID-DETECTION-CONFIDENCE-GUARD`
**Status:** Design approved
**Date:** 2026-07-31

## Goal

Strengthen the existing Storyboard Grid Split detector so ordinary images with dark compositional lines are not automatically treated as multi-cell storyboards. Preserve manual layout selection and the existing crop, upload, lineage, and canvas-placement contracts.

## Existing Behavior and Failure

`detectGridLayoutFromImageData` currently scores a layout by averaging the absolute darkness at expected grid boundaries. It auto-selects any highest-scoring layout at confidence `>= 0.7`; a near tie favors the layout with more expected lines. A normal logo or image with centered dark structure can therefore be selected as `3x3`, even when it is not a storyboard grid.

The production Golden Path QA found this exact false positive: `creator-city-logo.png` was reported as `3x3` at 93%, although manual `2x2` selection produced the intended workflow.

## Decision

Use a cautious confirmation gate. The feature remains the same Grid Split tool; this is a strengthening of its detector and selection semantics, not a second tool.

### Detection Evidence

For every candidate layout, score each expected vertical and horizontal boundary by comparing its darkness with nearby off-boundary samples. A useful grid boundary must be noticeably darker than its local neighborhood; a merely dark image region is insufficient.

The candidate score must include all expected boundaries, not only their average. A candidate is eligible for automatic selection only when:

1. every expected boundary is prominent enough;
2. the aggregate evidence clears the high-confidence threshold; and
3. the winning candidate exceeds the next-best candidate by the required ambiguity margin.

The detector returns a typed decision with the candidate layout, score, reason, and selection mode:

- `confirmed`: safe to auto-select;
- `needs-confirmation`: a plausible layout exists but its evidence is incomplete or ambiguous;
- `manual`: no reliable layout signal.

No timestamp, random value, image upload, network call, Provider call, or server mutation is part of detection.

### Panel Behavior

The panel starts with no selected layout until either a `confirmed` result arrives or the user explicitly selects one.

- `confirmed`: select the detected layout, render its overlay, and permit crop/upload.
- `needs-confirmation`: show the candidate and why it needs confirmation; render no crop overlay and keep crop/upload disabled until the user clicks a layout.
- `manual`: tell the user to select a layout; render no overlay and keep crop/upload disabled until manual selection.

Manual selection remains available for every supported V1 layout and is always authoritative. Once the user chooses a layout, the existing preview, crop metadata, upload concurrency, asset creation, source-session persistence, and "全部放入画布" behavior are unchanged.

## Compatibility and Boundaries

- Retain the seven existing V1 layouts and normalized crop metadata shape.
- Retain client-side Canvas 2D crop behavior and `/api/assets/upload` contract unchanged.
- Retain source immutability, persisted asset lineage, and the collision-safe child-node placement helper.
- Do not add a Provider request, generation call, credit/billing/payment call, database access, schema change, API change, environment setting, or package dependency.

## Scope

Expected implementation files:

- `apps/web/src/lib/canvas/storyboardGridDetect.ts`
- `apps/web/src/lib/canvas/storyboardGridSplit.test.ts`
- `apps/web/src/components/create/StoryboardGridSplitPanel.tsx`
- a focused panel/static regression test only if the existing suite has no suitable coverage point.

Out of scope:

- changing crop geometry or upload behavior;
- new grid layouts;
- automatic correction of source image perspective;
- Provider-backed visual analysis;
- any payment, billing, credits, schema, migration, environment, or Production DB change.

## Test Strategy

TDD starts with failing pure tests for:

1. a clean bordered `2x2` image yields `confirmed` and selects `2x2`;
2. an ordinary centered-line/logo-like fixture cannot yield a confirmed `3x3` decision;
3. ambiguous candidate evidence yields `needs-confirmation`, not automatic selection;
4. no-grid input yields `manual`;
5. manual selection enables the unchanged crop path only after a layout was explicitly chosen.

The final focused tests must also retain existing grid-cell, crop metadata, upload-form, source-session, and placement coverage. Full verification will run type-check, lint, build, diff-check, forbidden-zone diff audit, and safe browser QA without calling a Provider or payment endpoint.

## Acceptance Criteria

1. A normal image cannot automatically select a multi-cell layout merely because it contains dark central lines.
2. Confirmed grids still auto-select and remain one-click-to-crop.
3. Ambiguous or missing signals require an explicit user layout click before crop/upload.
4. Manual layout selection continues to create the same persisted crop assets, lineage metadata, and collision-safe canvas nodes.
5. No forbidden boundary changes are present.
