# Prop Grab Handle Implementation Plan

**Goal:** Implement the approved top-center prop handle; bodies select without moving.
**Architecture:** Keep existing Three.js meshes and whitebox updates. Add an editor-only circular handle for prop/furniture, reuse direct-drag capture and preserve the grip offset. Keep walls, floors, cameras, actors and persistence unchanged.
**Tech Stack:** React, Three.js, React Three Fiber, Playwright, node:test.

## Steps
- [x] Add real browser tests in SpatialPrevisViewport.test.tsx for body selection without mutation, handle drag with stateful rerenders, stable height, unchanged other entities/tracks, and identical LIVE pixels with editor handles enabled/disabled. Body drag failed against the previous implementation and passes with the new handle.
- [x] Update SpatialPrevisViewport.tsx: selection callback in drag bindings, prop/furniture body select-only handlers, top-center handle with hover highlight, no handles in LIVE/export. Use the handle's horizontal plane and initial grip offset for movement.
- [x] Run viewport and spatial-previs regressions, typecheck, build, and experience locks. Rebuild the existing localhost:65501 project-copy preview and personally drag the furniture handle, try the body, and replay/export five seconds.

## Verification
- 259 spatial-previs tests and 17 canvas tests passed; all 7 experience locks passed.
- Typecheck and Next.js production build exited 0.
- New browser test fixture initially mutated a shared baseline; using structuredClone isolated the fixture and the full suite passed.
- Actual project-copy body drag only selected furniture. Top handle moved it with LIVE updating; five-second export decoded successfully with no browser errors. No marker appeared in LIVE/export.
- Evidence: .superpowers/qa/spatial-studio/prop-handle-{red,green,regression,types,build,canvas-locks,acceptance}.log.

No commit, push or deployment is included in this confirmation. No source project data is saved during acceptance.
