# Canvas Zoom Baseline

User approved: the visible size at old 46% becomes the new 100%. New canvas and reset use that scale. Existing node dimensions, positions, edges and dialog/button typography stay unchanged.

Confirmed experience impact: none. The intentional exception is the user-approved canvas zoom baseline only; registered drag, resize, context-menu, dialog and generation behavior remain unchanged.

Implementation uses a shared physical scale constant of 0.46 and display conversion. Stored zoom remains physical, so old projects keep their view. Existing physical zoom limits, wheel math and Fit behavior stay unchanged. No migrations, API/provider configuration or generation changes.

1. [x] Add failing browser checks for initial display, reset, saved zoom, focal-point zoom and unchanged node geometry.
2. [x] Add shared baseline and update canvas defaults, percentage/accessibility display and normal project/workflow creation defaults. Keep existing saved values.
3. [x] Run focused browser checks, experience locks, typecheck and build. Start the local app and report verification limits and release status accurately.

Scope: VisualCanvasWorkspace, NewProjectDialog, normal projects/ensure-active-project and canvas lazy-workflow defaults, a small dependency-free viewport module and focused tests. No edits to old generation/comment workflow fallbacks or other locked feature behavior.

## Verification

- Red: the three initial browser checks failed on the old baseline (`/tmp/canvas-zoom-red.log`).
- Green: 47 focused tests passed, including five baseline checks, dialog layout, secondary clicks, generation boundaries and persistence (`/tmp/canvas-zoom-regression.log`). Browser checks exercise the real extracted zoom handlers and toolbar in an isolated fixture, not the authenticated full application.
- All eight confirmed-experience locks passed. Typecheck and production build exited 0; build retained existing lint warnings (`/tmp/canvas-zoom-types.log`, `/tmp/canvas-zoom-build.log`).
- Local dev app started at http://localhost:65505/ and returned HTTP 200. Browser navigation to `/create` reached the login page. Authenticated full-app acceptance remains pending; no auth changes or login bypass were made.
- Existing online canvas and its unsaved draft were left untouched. This zoom change has not been committed, pushed or deployed.

## Preview Release Authorization

User explicitly approved push and deployment after local verification. Target: `codex/seedance-spatial-previs-p0`, existing `creator-city` project, Preview only. Production and unrelated dirty whitebox work are excluded.

An isolated archive of published commit `152c9f2` plus only the eight files in this change passed the same 47 focused tests and TypeScript check. Release build and deployment results are recorded separately after completion.
