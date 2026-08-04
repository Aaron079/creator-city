# Canvas Delivery Closure Design

## Goal

Bring the currently unclosed, repository-controlled Canvas work to a verifiable delivery state without changing payment, Provider, BYOK, generation, schema, environment, executor, or Production database behavior.

## Scope

This closure has three ordered batches:

1. Repair the Keyframe Extractor viewport overflow discovered in Preview QA.
2. Consolidate current Canvas Preview QA and historical panel-QA status into one reproducible evidence set.
3. Run the release gate: focused regression, performance contracts, Preview network/console checks, and a Production read-only smoke check.

The following remain out of scope: payment and credit integrity work, database migrations, Vercel environment changes, Provider execution, real generation, BYOK semantics, external executor work, and any Production write.

## Batch A: Keyframe Extractor Panel

### Layout

`KeyframeExtractorPanel` remains a Canvas-adjacent floating tool surface. It will not be migrated into `DirectorToolPanelFrame`, because Keyframe Extractor has two equal, non-generating draft actions rather than the frame's single primary action model.

The panel must use a constrained vertical shell:

- Desktop: retain a left-side Canvas tool position with a 16px viewport safety margin.
- Narrow screens: use left and right 16px safety margins and a width no greater than the remaining viewport width.
- The outer surface is fixed between its top and bottom safety margins; it cannot use translate-based vertical centering.
- Header and explicit close control are fixed at the top of the surface.
- The operation body has `min-height: 0` and independently scrolls.
- The existing focus-node action stays in a fixed footer.
- The surface exposes `role="dialog"`, `aria-modal="true"`, and a unique `aria-label="关键帧提取"`; its close button is labeled `关闭关键帧提取`.

The visual language stays Creator City dark and compact: restrained white borders, violet tool accents, no new hero treatment, no nested cards, and no change to the video node canvas surface.

### Behavior Preservation

No video decoding, frame extraction, provenance, asset, draft-node, edge, or save behavior changes. The tool still creates image and video drafts only after an explicit click and never calls a Provider or a billing route.

### Required Tests

- A test-first viewport regression at 1280x720 and a narrow mobile viewport proves panel bounds, title, close control, and footer action are inside the viewport.
- The isolated Preview local-video flow imports a disposable WebM, opens the canonical Tools entry, creates both drafts, closes the panel through the unique label, saves, and reloads.
- Request capture rejects non-GET generation, Provider, payment, billing, credits, wallet, recharge, and checkout calls; page errors must be empty.

## Batch B: Canvas QA Consolidation

The current isolated Preview suite becomes the canonical write-capable Canvas QA evidence. It covers:

- local image import and cloud recovery;
- independent authenticated context recovery without copied origin storage;
- arbitrary source-linked reference extraction;
- local storyboard sketch creation and recovery;
- local video import and Keyframe Extractor image/video drafts;
- node tool entry, panel close reachability, and no automatic generation boundary.

Historical Camera, Lighting, NodeToolCenter, Task/Tool/Asset entry, Source immutable, and modal-exclusivity records are audited against this suite and existing focused tests. A historical row is either updated with current evidence, explicitly marked covered by a newer regression, or retained as a narrow future task. It is never silently deleted.

`P0-CANVAS-PENDING-BROWSER-QA-CONSOLIDATION` can close only when the isolated Preview write/reload path and independent context path are current, while Production assertions remain explicitly read-only.

## Batch C: Release Gate

The release gate runs, in order:

1. Focused Keyframe Extractor and Canvas layout tests.
2. The full guarded Preview Canvas E2E suite.
3. Existing 20/50/100-node performance and request-storm contract tests.
4. `pnpm --filter web type-check`, `pnpm --filter web lint`, `pnpm --filter web build`, `pnpm agent:check`, and `git diff --check`.
5. A Production read-only smoke check of Canvas and current deployment status. It may inspect existing content and console logs but must not upload, save, create nodes, invoke tools, generate, call a Provider, or make payment-related requests.

Every deployment report must name the exact commit and Vercel state. Preview success is not described as Production write validation.

## Delivery Criteria

- P0 Canvas release blockers in this scope are zero.
- Keyframe Extractor has no viewport overflow at the required desktop and narrow viewport sizes.
- The guarded Preview Canvas suite passes with no forbidden mutation and no page error.
- Performance contracts remain green.
- Production read-only smoke shows no new product console error.
- The Git diff contains only the approved Canvas implementation, tests, and task records.
- Payment, Provider, generation, schema, environment, executor, and Production DB boundaries remain unchanged.

## External Blockers

Payment integrity, read-only historical database review, Railway/RunPod staging, and other externally provisioned work are not closure criteria for this Canvas delivery. Their existing blocker statuses remain truthful and unchanged.
