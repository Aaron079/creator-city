# Local Storyboard Reference Extractor and Sketch Board

**Status:** Approved design, awaiting written-spec review

## Goal

Replace the fixed-grid Storyboard Grid Split tool with one coherent local storyboard workflow:

1. extract any number of user-confirmed reference regions from an image asset;
2. derive a reviewed local shot plan from script, canvas context, and those references; and
3. render that plan as an editable black-and-white sketch storyboard board.

The final product is a professional previsualization aid, not a photo generator. It must work without Provider generation, billing, or a fixed 2x2/3x3 grid assumption.

## Product Decisions

- **Replacement, not duplication:** the visible `storyboard-grid-split` entry becomes `storyboard-reference-extractor`. There is no parallel crop tool.
- **Freeform extraction:** users draw, resize, reorder, and remove arbitrary rectangular selections over a source image. An optional local detector can suggest candidate regions, but it cannot create crops without explicit user confirmation.
- **Source immutability:** the source Asset and its canvas node are never changed. Each confirmed region becomes a derived reference Asset with provenance and may create a derived image node.
- **Professional local storyboard:** the existing local Script Segmentation, Narrative Beat Analysis, Shot Planning, and Storyboard Director workflow remains the single planning surface. Its final reviewed state gains a Sketch Board rather than a second director workspace.
- **Black-and-white first:** V1 renders deterministic sketch frames with composition scaffolding, subject placement, action/movement arrows, and camera labels. It does not claim to create photorealistic art or call an image provider.
- **No grid limit:** the board uses responsive flow layout and supports arbitrary numbers of shots. Scene grouping and ordering are semantic, not dictated by a fixed page grid.

## Existing Foundations

- `apps/web/src/components/create/StoryboardGridSplitPanel.tsx` currently manages fixed layout selection, crop/upload, and derived child-node creation.
- `apps/web/src/lib/canvas/storyboardGridDetect.ts` contains fixed-grid detection and normalized crop provenance.
- `apps/web/src/lib/skills/script-segmentation`, `narrative-beat-analysis`, and `shot-planning` already run locally with reviewable evidence.
- `apps/web/src/components/create/StoryboardDirectorPanel.tsx` and its Recipe panel already own review, invalidation, persistence, and materialization.
- `apps/web/src/lib/storyboard/previs.ts` currently contains a placeholder previs flow. V1 must not present placeholder output as a finished professional sketch board.

## Architecture

### 1. Reference Extractor

**Input:** an image node with a stable Asset id and media URL.

**State:** source id, stable extraction session id, ordered freeform normalized crop boxes, display labels, and upload/derived-node status.

**Output:** a source-linked reference Asset and an optional derived node per confirmed crop. Provenance records the source Asset/node, normalized crop box, session id, extraction order, and tool version.

**Behavior:**

- The panel begins with no selected regions.
- The optional candidate detector only adds editable suggestions to local panel state.
- Upload is explicit, serial or bounded, retryable, and cannot overwrite an existing source.
- The source session summarizes actual uploaded assets and derived nodes for result-quality reporting.
- Existing `storyboard-grid-split` metadata remains readable for historical assets. New metadata uses a new versioned reference-extractor identity; legacy records are not rewritten.

### 2. Shot Grammar Engine

The engine extends the existing local shot-planning output with typed, deterministic guidance:

- framing and focal emphasis;
- camera angle and screen direction;
- composition template and subject placement;
- action line and camera movement;
- continuity checks for axis, direction, wardrobe/role reference, and location transition.

Every recommendation is attached to source evidence or marked as a configurable heuristic. If the text does not reliably establish a subject, action, or relationship, the shot is marked `needs review` rather than invented.

### 3. Sketch Renderer

The renderer consumes approved shot parameters and renders an SVG or Canvas sketch in the browser. Each frame includes:

- aspect-ratio frame and horizon/composition guides;
- simplified subject silhouettes and relative blocking;
- camera framing and angle labels;
- eye-line, motion, and camera-move arrows when supported by the shot;
- a visible unresolved state when evidence is insufficient.

Render identities are deterministic from shot id, approved parameters, and renderer version. A parameter edit re-renders only affected frames. This makes save/reload behavior testable and avoids a concealed model call.

### 4. Storyboard Board Integration

The Storyboard Director remains the entry point for script-to-board work. A reviewed recipe exposes `Generate sketch board`; the board can edit a shot, mark it stale, synchronize the existing shot board, and materialize compatible canvas nodes. The system never overwrites an approved user edit during a refresh or rerun.

## User Flow

1. Open an image node's Tools menu and select `分镜参考提取`.
2. Draw any number of reference boxes, optionally accept/edit local suggestions, and label or delete boxes.
3. Explicitly confirm extraction. The app crops client-side, uploads derived Assets, and creates source-linked nodes according to the user's chosen placement action.
4. Open Storyboard Director from a text/script node and choose the desired reference assets and existing shot context.
5. Review scene, beat, and shot planning stages.
6. Select `生成草图分镜`; edit framing, blocking, direction, and movement until the board is accepted.
7. Sync accepted shots to the existing storyboard board or materialize selected canvas nodes.

## Data Governance and Future Corpus

V1 uses an in-repository, versioned shot-grammar rule pack. It does not scrape websites, train a model, or ingest third-party image libraries.

The extension path is a separately approved corpus pipeline:

1. Accept only self-owned, purchased, or explicitly commercial/openly licensed sources.
2. Record source URL or contract reference, author, license, allowed use, review state, and corpus version.
3. Convert approved material into abstract rules and human-authored annotations where possible; do not copy protected storyboard frames into the product without rights.
4. Maintain revocation/deletion records and a small offline evaluation set before any rule-pack release.
5. Any crawler requires a dedicated specification covering target terms, robots/permissions, rate limits, fields stored, provenance, review, and deletion. No uncontrolled web scraping is allowed.

## V1 Scope

Included:

- visible replacement of fixed-grid split with freeform reference extraction;
- local freeform crop selection and source-linked derived references;
- deterministic local shot-grammar fields and validations;
- deterministic black-and-white sketch rendering inside the existing Storyboard Director/board flow;
- editing, invalidation, persistence, recovery, and materials/node synchronization;
- migration-safe support for historical fixed-grid records.

Excluded:

- Provider image/video calls, BYOK changes, or synthetic photorealistic frames;
- payment, billing, credits, wallet, schema/migration, Production DB, cn-executor, package/lockfile, or environment changes;
- web crawling, external corpus ingestion, and model training;
- deletion or rewriting of historical grid-split assets.

## Validation and Release Gate

Tests are written RED before implementation and must cover:

- arbitrary normalized boxes, bounds handling, ordering, provenance, and legacy metadata compatibility;
- explicit confirmation before crop/upload and source immutability;
- shot-grammar evidence, unresolved states, continuity findings, and stable renderer identity;
- parameter-only redraw isolation, user-edit preservation, save/refresh recovery, and node deduplication;
- 20/50/100-shot board layout and save scheduling;
- static checks for no Provider/generate/billing/payment mutations;
- browser flows for extraction, undo/delete, board editing, narrow viewport dialog containment, reload recovery, asset-library retrieval, console, and network boundaries.

Release requires passing targeted tests, type-check, lint, build, diff-check, forbidden-zone audit, browser QA, production deployment, and production validation. A QA harness or auth limitation must be reported as such and cannot be called a pass.

## Delivery Order

1. Reference Extractor replacement and legacy compatibility.
2. Shot Grammar data types and deterministic guidance over the current local plan.
3. Sketch renderer and Storyboard Director board integration.
4. Persistence, performance, visual/browser QA, and production closeout.
5. A separately approved licensed-corpus and offline-evaluation task.
