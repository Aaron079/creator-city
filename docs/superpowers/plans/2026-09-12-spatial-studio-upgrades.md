# Spatial Studio Upgrades Implementation Plan

**Goal:** Implement the five approved extensions in recommendation order: calibration, lighting, actor performance, multicamera editing, result comparison.
**Authorization:** User approved all five recommendations and explicitly requested the recommended sequence. Continue implementation without another approval loop.
**Architecture:** Reuse SpatialPrevisViewport, R3F geometry, existing timeline and metadata persistence. Optional versioned studio metadata preserves existing version-4 projects. Compact icon panels are additive. No schema, dependency, payment, authentication or canvas layout changes.
**Tech Stack:** React, Three.js, R3F, Drei TransformControls, existing node:test/Playwright harnesses.

Confirmed experience impact: none

## Steps
- [x] Calibration: reference-image overlay in camera view, entity translate/rotate/scale gizmo, dimensions and entity selection, manual verification record. Keep source evidence and distinguish manual alignment from reconstruction.
- [x] Lighting: editable spot/directional lamps, transform gizmos, intensity, temperature, spot-edge softness and real shadow rendering in world and LIVE. Default existing lighting remains until user enables a lighting plan.
- [x] Actor performance: timed poses, draggable head/hand/foot targets with two-bone IK, rest/sit/reach presets, interpolation and independent actor tracks. Preserve default actor rendering for tracks without poses.
- [x] Multicamera: clone existing director/aerial or selected studio cameras into editable tracks; view simultaneous live thumbnails; record/retime/delete cuts; sample program camera and export continuous video. Existing director/aerial tracks remain independent.
- [x] Comparison: choose existing video reference or local video, synchronize to master time with offset, overlay/side-by-side view, timed discrepancy annotations, export report. Local file URLs must not persist as cloud assets.
- [x] Integration: strict studio parser, round-trip metadata, immutable delivery package, duration retiming, disabled-state handling and tool-scoped reversible edits.
- [x] Local verification: 234 related tests, 11 canvas integration checks, rendered desktop/mobile browser tests and WebGL pixel checks; tsc, build and seven experience locks passed.
- [ ] Preview account acceptance: user approved push and Preview deployment on 2026-09-12 after local verification. Local authenticated canvas cannot be validated because this checkout has no DATABASE_URL. No account, database, authentication or paid-generation changes were made.

## Files
New library modules under apps/web/src/lib/spatial-previs/studio*: types, operations, validation and tests.
New UI modules under apps/web/src/components/create/spatial-previs/: compact studio toolbar, inspector, scene objects and result comparison.
Modify only integration points in SpatialPrevisViewport, types, persistence, delivery and normalize; use existing scene-reference upload/asset picker and save callbacks.

## Verification Commands
From apps/web: pnpm exec tsx --test src/lib/spatial-previs/*.test.ts
From apps/web: pnpm exec tsx --test src/components/create/spatial-previs/SpatialStudio.test.tsx
From apps/web: npx tsc --noEmit; npx next build
From repository root: pnpm experience:check

## Delivery Boundaries
No guarantee of external video model fidelity; comparison records observed discrepancies. Calibration is user-driven alignment, not claimed automatic metric reconstruction. All five must be exercised before declaring complete. Push and Preview deployment are authorized by the user's subsequent confirmation; production promotion is not authorized.
