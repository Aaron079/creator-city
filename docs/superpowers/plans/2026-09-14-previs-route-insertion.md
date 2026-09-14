# Previs Route Insertion Plan

**Approved scope:** Clear editable actor paths; context-menu insertion on actor/camera paths; ground placement at a chosen time for the selected actor. Preserve authored points, total duration, physical collision, LIVE/export, and outer canvas menus.
**Implementation:** Reuse ensureActorKeyframeAt/ensureCameraKeyframeAt and existing movement functions. Screen-width path hit regions map a clicked segment to time. Render editor-only path/point guides above scene geometry without changing world coordinates. A small dismissible menu performs insertion only after selection, never on right-click alone. Reject duplicate-time ground placement rather than replacing an authored point.

- [x] Browser red tests: right-click alone does not mutate; menu inserts only one interpolated point into actor/Director/aerial paths; old keys and total duration are identical; inserted point drags at its own time; ground inserts at the chosen time; Escape/outside close.
- [x] Implement scoped route picking, menu, and guide visibility. Left-button drags remain separate from context-menu gestures.
- [x] Run full spatial/canvas tests, typecheck/build/experience locks. In the current local project copy personally insert/drag actor and camera points, construct an actor route, and replay/export five seconds. Real-time export precision caveat recorded below.

No push, deployment, or source-project save is included.

## Evidence

- Browser red/green logs: `.superpowers/qa/spatial-studio/route-insert-red.log` and `route-insert-green.log`. The first implementation also exposed short-segment right-clicks being swallowed by point drag padding; padding now applies only to dragging.
- Personally tested actor segment insertion and new-point drag, camera segment insertion and independent drag, and actor ground insertion at 4 seconds in `http://localhost:65501/`. This is an isolated copy of the user's existing exported project.
- Actual browser playback, mobile overflow, WebM decode, and canvas-pixel checks: `route-insert-acceptance-memo.log` and `route-insert-acceptance/`. No page errors. The existing real-time recorder produced 4.777 seconds for the 5-second test; this passes the existing 4.7-second smoke-test threshold but is not frame-exact export. Two earlier runs were below that threshold; avoid rebuilding route line geometries on playhead updates. No exporter code or timing contract was changed.
- Existing authored wall/furniture crossings still stop the actor and show collision status; route overlays expose authored points without bypassing physical collision.
- Full regression: 279/279 (`route-insert-final-regression.log`); typecheck exit 0 (`route-insert-final-types.log`); final production build exit 0 (`route-insert-overlay-build.log`), with existing lint warnings; all 7 experience locks passed.
- Independent review caught the body-portal menu below the workspace's z-index 3000 modal. Reproduced with a real browser hit-test assertion (`route-insert-overlay-red.log`), raised only the menu to 3001, then all 3 insertion tests passed (`route-insert-overlay-green.log`). Local QA now reproduces the same stacking context; personally verified clicking and dragging an inserted point again. The full 279 run preceded this CSS-only correction; the three affected tests and production build were rerun after it.
