# Director Delivery Provenance Implementation Plan

> **For agentic workers:** Use executing-plans to implement this approved scope task-by-task in the existing linked worktree. No commit, push or deployment in this task.

**Subsequent authorization (2026-10-12):** The user now requests review, necessary fixes, trial, then push/deploy when passing. Release only this increment on the existing Preview branch; preserve unrelated dirty whitebox work. Validate an exported clean baseline with only this increment before staging.

## Release Follow-Up

- [x] Verify original Vercel project access through CLI and browser without changing configuration.
- [x] Reproduce and fix published-type compatibility and snapshot freezing in a clean baseline export.
- [x] Verify the actual release source: 151 tests, TypeScript and Next build passed.
- [x] Create an isolated authenticated Preview QA project; verify original save actions work.
- [ ] Stage only declared feature files/hunks, verify staged tree matches the tested release source, commit and push existing Preview branch.
- [ ] Verify Vercel READY for the exact commit and complete post-deploy UI/readback checks.

**Goal:** Preserve asset references, scene confirmation, camera intervals and known lighting/geometry versions in existing previs delivery outputs without changing the UI or generation chain.

**Architecture:** Add an optional versioned provenance record to the existing v1 delivery package. Build it from the current state, using explicit allowlisted fields, then deep-freeze it with the existing snapshot. Existing node, JSON download and text-asset callbacks already pass the whole package unchanged.

**Tech Stack:** TypeScript, node:test/tsx, existing React components and browser test harness, existing canvas/asset persistence.

## Scope and Baseline

- Approved specification: `docs/superpowers/specs/2026-10-12-director-incremental-upgrades-design.md`; user approved implementation on 2026-10-12.
- Existing linked worktree: codex/seedance-spatial-previs-p0, HEAD 5f8f7ce. Preserve all pre-existing uncommitted edits.
- Baseline delivery/studio suite: 13 passed before changes.
- Modified production file: `apps/web/src/lib/spatial-previs/delivery.ts` only.
- New production file: `apps/web/src/lib/spatial-previs/delivery-provenance.ts`.
- New tests: `apps/web/src/lib/spatial-previs/delivery-provenance.test.ts`; browser acceptance under existing spatial-previs test directory if required.
- Evidence: `.superpowers/qa/director-provenance-20261012/`.
- Confirmed experience impact: none.

## Task 1: Red Tests and Provenance Contract

- [x] Add tests using real normalized states and the existing delivery builder. Start with:

```ts
const state = normalizeSpatialPrevis({ projectId: 'provenance-test' })
const delivery = buildPrevisDeliveryPackage(state)
assert.ok(delivery.provenance)
assert.equal(delivery.provenance.version, 1)
```

- [x] Run `node_modules/.bin/tsx --test src/lib/spatial-previs/delivery-provenance.test.ts` from apps/web; expect a missing provenance assertion, not a loading error.
- [x] Cover references without content versions, missing asset-set references, unresolved actor mappings, signed URL omission, geometry digest and lighting version retention, deep isolation and JSON serialization.
- [x] Cover continuous take vs active program cuts. Beats and camera keyframes never create shots. Use the existing program selection semantics before the first cut. Preserve requested unknown camera ID as unresolved rather than quietly binding a different camera.
- [x] Cover disabled program, cuts at zero/end, duplicate cut times, unsorted cuts, and old v1 packages without provenance.

## Task 2: Minimal Additive Implementation

- [x] Add the typed helper `buildDeliveryProvenance(state: SpatialPrevisState)` in the new production file. Record only reference IDs, asset IDs, media type, source, scene-level asset-set bindings, actor IDs with unresolved identity bindings, and camera interval sources.
- [x] Record ordinary media `contentVersion: null` and `status: 'unverified'`: current reference type contains no trusted content revision. Do not invent a version or acquire remote media.
- [x] Preserve only explicit geometry result identity/digests and light rig ID/assetVersion; do not clone arbitrary extra input properties into provenance.
- [x] In delivery.ts, import the helper and add the optional field to the v1 package type; generate it inside the existing deep-freeze boundary:

```ts
provenance?: ReturnType<typeof buildDeliveryProvenance>
// In buildPrevisDeliveryPackage:
provenance: buildDeliveryProvenance(state),
```

- [x] Re-run new tests and existing delivery/studio/persistence suites. Fix only this increment if a regression appears.

## Task 3: Existing Output Integration

- [x] Verify node metadata through real canvas serialization/mapping helpers and JSON round-trip, not regex alone.
- [x] Exercise actual director panel buttons and existing workspace callbacks in the browser: create node, download JSON, save text asset; verify the resulting record contains provenance and later edits do not mutate it. Callbacks run verbatim with local test persistence, not the full workspace database.
- [ ] Read back a saved record through an authenticated real database API. Blocked: this isolated worktree has no DATABASE_URL; no environment or auth changes made, and no deployment authorized. Local fixture readback is not remote acceptance.
- [x] Retain old-package compatibility and test no provider-generation dispatch during these actions.

## Task 4: Regression and Completion Evidence

- [x] Run focused director panel, scene/studio/viewport, persistence and delivery tests: 140 passed.
- [x] Run `pnpm experience:check` (8 locks), lock verifier tests (15), applicable canvas layout/secondary click/video boundary regressions (25), `npx tsc --noEmit --incremental false`, and `npx next build`.
- [x] Compare actual director screenshots/layout before and after at desktop/mobile widths. Both canvases passed pixel checks; controls have identical geometry/text. Browser delivery/layout tests: 2 passed.
- [x] Review final diff against baseline; only the declared production increment changed. Existing dirty work retained; generated tsbuildinfo restored to pre-task content. No independent reviewer tool was available; scoped self-review performed.
- [x] Record results and blockers in `docs/research/2026-10-12-director-delivery-provenance-acceptance.md`. No commit/push/deploy.
