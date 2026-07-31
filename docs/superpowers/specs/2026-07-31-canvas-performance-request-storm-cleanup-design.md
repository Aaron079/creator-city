# Canvas Performance and Request-Storm Cleanup Design

## Status

Approved approach A. This design covers the first bounded performance pass for
`P1-CANVAS-PERFORMANCE-AND-REQUEST-STORM-CLEANUP`.

## Goal

Keep interaction responsive as a canvas grows to 20, 50, and 100 nodes without
changing the save contract, generation routes, Provider behavior, BYOK, or
payment behavior. Preserve the existing click-to-load video rule and the
local-first autosave rule.

## Evidence and Constraints

The production read-only smoke check rendered the existing 14-node Golden Path
project without console warnings or errors. It mounted five lazy image elements
and no video element for its one video node. The current workspace already
keeps ordinary edits local-only; only an explicit `保存到云端` issues the canvas
`PUT`, and an in-flight cloud save drains at most one pending save.

The remaining scale risk is local render work:

- the canvas maps every edge and performs two linear node lookups while
  rendering that edge;
- the canvas maps every node into a `CanvasNodeCard` on each workspace render;
- node cards receive many inline callbacks, so simply wrapping the existing
  component in `React.memo` would not isolate unrelated node updates.

No production project will be populated with synthetic nodes for this task.
Production QA stays read-only. The browser harness does not expose a request
waterfall or frame-timing API, so exact production request counts and frame
times remain a QA harness limitation rather than a product claim.

## Options Considered

### A. Indexed, memoized canvas layers (selected)

Build a render-time `nodeById` index once per node revision. Use it for edge
geometry and upstream references. Move each rendered node into a memoized layer
whose public props are the node's visual state plus stable workspace action
handlers. That layer binds its per-node event closures only when that node is
actually re-rendered.

This removes repeated lookup work and prevents a selection, pan, zoom, or
unrelated node update from needlessly re-rendering unchanged node-card content.
It is localized, preserves the current DOM and interaction contract, and is
appropriate for the first 20/50/100-node pass.

### B. Full viewport virtualization

Only mount nodes inside the visible canvas bounds. This would reduce DOM work
for very large canvases but risks breaking connection drag, keyboard focus,
screen-reader navigation, edge labels, and currently open node tools. It is
not justified before measuring the smaller, lower-risk changes in option A.

### C. Save or media rewrite

Change autosave cadence, cloud save behavior, or media loading. Audit evidence
does not support this: ordinary edits do not make cloud requests, explicit
saves are coalesced, images are lazy-loaded, and videos are click-to-load.
Changing those systems would add risk without targeting the observed hotspot.

## Design

### Render index

`VisualCanvasWorkspace` will derive a single `Map<nodeId, node>` from the
current `nodes` array. Edge rendering will look up source and target through
that map. The existing upstream context map already follows this pattern and
remains the source of truth for workflow eligibility.

The index is read-only and is recreated only when the node-array identity
changes. It never writes canvas state, metadata, storage, or server data.

### Memoized node layer

A focused canvas-node render layer will own the mapping from a visual node to
`CanvasNodeCard`. It receives stable workspace actions plus only the
node-specific visual inputs required by the card: node data, selected/dragging
state, source context, title/missing-source status, and current node-level
display options.

The layer is memoized. Its comparison is structural only for the explicit
visual inputs and does not suppress a state change that affects the node.
Handlers that need current workspace state remain stable callbacks at the
workspace boundary; the layer creates node-id-bound closures inside its own
render. This avoids stale closures and avoids treating callback identity as a
visual change.

The current card markup, toolbar affordances, source-lock behavior, error
boundary, click-to-load video behavior, and image lazy loading remain intact.

### Save and media invariants

This task does not change `saveCanvas`, `scheduleCanvasSave`, the canvas API
route, local draft serialization, generation routes, Provider adapters, BYOK,
or billing. Existing invariants remain mandatory:

- routine edits write a local snapshot only;
- manual cloud save is the only ordinary client canvas `PUT` path;
- one in-flight cloud save may produce only one follow-up save;
- a video `<video>` element mounts only after the user requests preview;
- images keep `loading="lazy"`.

### Measured regression coverage

Add a small pure render-planning helper with deterministic fixtures for 20, 50,
and 100 nodes. Tests will assert that one node index is built per revision and
that every edge resolves through indexed lookups, rather than repeated scans.
Add a focused component/static contract covering the memo boundary, stable
handler boundary, node-card preservation, and unchanged media/save invariants.

The tests prove work bounds and behavior. They do not impersonate browser frame
rate measurements. Browser QA will instead validate the production project's
rendered node count, click-to-load video absence, console boundary, and no
manual-save action. A future dedicated E2E harness may collect exact frame and
network metrics when package-scope authorization is available.

## Acceptance Criteria

1. A 20/50/100-node fixture produces one node index per render revision and no
   linear lookup in the edge render path.
2. Unchanged node-card content is isolated from an unrelated node's visual
   update by the memoized layer.
3. Existing node actions, tool entry points, source status, annotation badge,
   image lazy loading, and video click-to-load markup remain present.
4. Existing local-first save and explicit cloud-save coalescing tests remain
   green.
5. `pnpm type-check`, `pnpm lint`, `pnpm build`, targeted tests, and
   `git diff --check` pass.
6. Production browser QA is read-only: no project creation, save, generation,
   Provider, upload, billing, or payment request is initiated.

## Scope

Expected implementation files:

- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- a focused new canvas-node render-layer/helper under
  `apps/web/src/components/create/canvas/`
- focused tests under that directory
- one static contract test under `scripts/`
- task-status documentation after validation

Forbidden for this task: Prisma schema/migrations, environment files, payment,
credits, wallet, billing, Provider adapters, BYOK semantics, generate routes,
cn-executor, package manifests/lockfile, Next config, and Production DB.

## Failure Handling

If the memo boundary changes a node's visible state, action routing, or source
identity in targeted or browser QA, revert only the new task-local change before
commit and keep the existing non-memoized rendering. Do not compensate by
weakening save, media, or generation safeguards.
