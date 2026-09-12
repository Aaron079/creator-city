# Spatial Previs Director Camera Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing true-3D Spatial Previs workspace with editable ground and aerial camera plans, complete lens and shot controls, camera transform gizmos, draggable route curves, and a truthful previs-video export while preserving every locked canvas experience.

**Architecture:** Keep the existing provider-neutral SpatialPrevisState as the single source of truth. Upgrade it to v4 with two isolated camera tracks and persisted pose/lens metadata, then expose those contracts through small director controls, React Three Fiber direct manipulation, and a line-based timeline. Capture the existing live-camera canvas through MediaRecorder for a real WebM export; the normal flow never calls a third-party model.

**Tech Stack:** Next.js/React, TypeScript, React Three Fiber, @react-three/drei TransformControls, Three.js, browser MediaRecorder, Node test runner, existing canvas persistence and delivery-node callbacks.

---

## Scope and File Map

- Modify: apps/web/src/lib/spatial-previs/types.ts - v4 camera plan, pose, focal, shot-scale, and baseline-motion contracts.
- Create: apps/web/src/lib/spatial-previs/camera.ts - focal validation, pose/target conversion, shortest-angle interpolation, and selected-track helpers.
- Modify: apps/web/src/lib/spatial-previs/normalize.ts - v4 defaults, 5-180 second duration remapping, and isolated aerial defaults.
- Modify: apps/web/src/lib/spatial-previs/persistence.ts - strict v1-v4 parsing plus non-destructive migration to v4.
- Modify: apps/web/src/lib/spatial-previs/sampler.ts - interpolation for camera rotation and current segment metadata.
- Modify: apps/web/src/lib/spatial-previs/direct-manipulation.ts - exact-keyframe transform, route-point, lens, and baseline updates for both camera tracks.
- Modify: apps/web/src/lib/spatial-previs/delivery.ts - clone and freeze both plans and all camera metadata.
- Create: apps/web/src/lib/spatial-previs/video-export.ts - live-canvas WebM recording with supported/failed/cancelled states.
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx - compact Director/Aerial header, duration, playback, output actions, and one floating-surface owner.
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorControls.tsx - icon toolbar, lens/shot popover, duration popover, and motion baseline dock.
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx - ground/aerial route handles, TransformControls, real camera pose preview, and capture-canvas callback.
- Modify: apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx - reuse the established push/pull/pan/move/follow/rise/fall control as a baseline action dock for either plan.
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.tsx - thin blue/yellow curve tracks whose keyed points can be moved in time.
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.tsx - retain existing delivery node and JSON export callbacks; do not alter canvas interactions.
- Modify tests beside every changed library/component and apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts.

**Locked boundaries:** Do not edit CanvasNodeCard, prompt-panel layout, canvas context menus, node sizing, account/BYOK flows, scene asset upload behavior, or provider dispatch. The only allowed VisualCanvasWorkspace change is wiring Spatial Previs props already owned by its overlay.

**Commit policy:** The user has approved the specification but has not authorized a commit. Complete each task and its verification first; execute the listed commit command only after explicit commit authorization.

### Task 1: Upgrade persisted previs state to isolated director and aerial camera plans

**Files:**
- Create: apps/web/src/lib/spatial-previs/camera.ts
- Create: apps/web/src/lib/spatial-previs/camera.test.ts
- Modify: apps/web/src/lib/spatial-previs/types.ts
- Modify: apps/web/src/lib/spatial-previs/normalize.ts
- Modify: apps/web/src/lib/spatial-previs/normalize.test.ts
- Modify: apps/web/src/lib/spatial-previs/persistence.ts
- Modify: apps/web/src/lib/spatial-previs/persistence.test.ts
- Modify: apps/web/src/lib/spatial-previs/sampler.ts
- Modify: apps/web/src/lib/spatial-previs/sampler.test.ts

- [ ] **Step 1: Add failing v4 migration, duration, and camera-math tests.**

~~~ts
test('migrates v3 camera data to a v4 director plan without losing its target path', () => {
  const parsed = parseSpatialPrevisMetadata({ spatialPrevis: v3State })
  assert.equal(parsed?.version, 4)
  assert.deepEqual(parsed?.masterTake.cameraTrack.keyframes[0]?.target, v3State.masterTake.cameraTrack.keyframes[0]?.target)
  assert.equal(parsed?.masterTake.aerialCameraTrack.keyframes[0]?.position.y, 9)
})

test('remaps both plans, actors, and beats proportionally when duration changes', () => {
  const next = setMasterTakeDuration(state, 60)
  assert.equal(next.masterTake.durationSec, 60)
  assert.equal(next.masterTake.cameraTrack.keyframes[1]?.timeSec, 30)
  assert.equal(next.masterTake.aerialCameraTrack.keyframes[1]?.timeSec, 30)
  assert.equal(next.masterTake.actorTracks[0]?.keyframes[1]?.timeSec, 30)
})

test('turns a camera pose into the same forward target used by its live view', () => {
  assert.deepEqual(roundVec3(cameraTargetFromPose({ x: 0, y: 2, z: 6 }, { pitch: 0, yaw: 0, roll: 0 }, 6)), { x: 0, y: 2, z: 0 })
})
~~~

- [ ] **Step 2: Run the focused tests and confirm they fail because v4 fields and helpers do not exist.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/camera.test.ts src/lib/spatial-previs/normalize.test.ts src/lib/spatial-previs/persistence.test.ts src/lib/spatial-previs/sampler.test.ts

Expected: FAIL with missing exports or version mismatch.

- [ ] **Step 3: Add the v4 data contract and camera helpers.**

~~~ts
export type SpatialPrevisCameraMode = 'director' | 'aerial'
export type CameraRotation = { pitch: number; yaw: number; roll: number }
export type ShotScale =
  | 'extreme-close-up' | 'close-up' | 'near' | 'medium-close' | 'medium'
  | 'medium-wide' | 'wide' | 'long' | 'extreme-long' | 'establishing'
export type CameraMotionBaseline = 'push' | 'pull' | 'pan' | 'move' | 'follow' | 'rise' | 'fall' | 'static'

export type CameraKeyframe = {
  id: string
  timeSec: number
  position: Vec3
  target: Vec3
  rotation: CameraRotation
  focalLengthMm: number
  shotScale: ShotScale
  motionBaseline: CameraMotionBaseline
  intent: CameraIntent
}

export function cameraTrackForMode(masterTake: MasterTake, mode: SpatialPrevisCameraMode) {
  return mode === 'aerial' ? masterTake.aerialCameraTrack : masterTake.cameraTrack
}

export function cameraTargetFromPose(position: Vec3, rotation: CameraRotation, distance: number): Vec3 {
  const forward = {
    x: -Math.sin(rotation.yaw) * Math.cos(rotation.pitch),
    y: Math.sin(rotation.pitch),
    z: -Math.cos(rotation.yaw) * Math.cos(rotation.pitch),
  }
  return { x: position.x + forward.x * distance, y: position.y + forward.y * distance, z: position.z + forward.z * distance }
}
~~~

Make SpatialPrevisState.version literal 4. Add MasterTake.aerialCameraTrack. Keep CameraIntent because existing caller semantics depend on it. Define FOCAL_LENGTH_OPTIONS as the exact 8, 10, 12, 14, 16, 18, 20, 21, 24, 25, 28, 32, 35, 40, 45, 50, 65, 75, 85, 100, 135, 150, 180, 200, 300, 400, and 600 millimetre values, plus isValidFocalLength(value) for 8 through 600.

Make createCameraTrack(durationSec, mode) create director poses at y 1.6 and aerial poses at y 9. Use rotationFromTarget(position, target) for every new or migrated keyframe so the live camera does not visually jump. Make setMasterTakeDuration scale every actor keyframe, both camera tracks, and every beat from oldDuration to newDuration without filtering or deleting frames. Update sampleCamera to interpolate position, target, focal length, and shortest-path pitch/yaw/roll; choose shotScale, motionBaseline, and intent from the segment start.

For persistence, accept v1, v2, v3, and v4. v1-v3 parser paths must construct the untouched director track from persisted data and construct a new aerial track. v4 must require finite rotation values, a valid shotScale, a valid motionBaseline, and focal length 8-600. The executable-timeline check must only require valid in-range keyframe and beat times; applyBeatPatch will create a midpoint keyframe later instead of treating a movable curve point as invalid state.

- [ ] **Step 4: Run the focused migration, normalization, and sampler suite.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/camera.test.ts src/lib/spatial-previs/normalize.test.ts src/lib/spatial-previs/persistence.test.ts src/lib/spatial-previs/sampler.test.ts

Expected: PASS with v1-v3 migration preserving source data and v4 state carrying separate director and aerial tracks.

- [ ] **Step 5: Commit after authorization.**

~~~bash
git add apps/web/src/lib/spatial-previs/camera.ts apps/web/src/lib/spatial-previs/camera.test.ts apps/web/src/lib/spatial-previs/types.ts apps/web/src/lib/spatial-previs/normalize.ts apps/web/src/lib/spatial-previs/normalize.test.ts apps/web/src/lib/spatial-previs/persistence.ts apps/web/src/lib/spatial-previs/persistence.test.ts apps/web/src/lib/spatial-previs/sampler.ts apps/web/src/lib/spatial-previs/sampler.test.ts
git commit -m "feat: add spatial previs director and aerial camera plans"
~~~

### Task 2: Make baseline camera language and direct pose edits keyframe-safe

**Files:**
- Modify: apps/web/src/lib/spatial-previs/direct-manipulation.ts
- Modify: apps/web/src/lib/spatial-previs/direct-manipulation.test.ts
- Modify: apps/web/src/lib/spatial-previs/normalize.ts
- Modify: apps/web/src/lib/spatial-previs/normalize.test.ts

- [ ] **Step 1: Add failing behavior tests for baseline motions, pose editing, target editing, and ground/aerial isolation.**

~~~ts
test('writes a selected aerial pose without changing the director camera keyframe', () => {
  const next = applyCameraTransform(state, 'aerial', 4.2, {
    position: { x: 3, y: 12, z: -4 },
    rotation: { pitch: -0.2, yaw: 0.7, roll: 0.1 },
  })
  assert.deepEqual(cameraFrameAt(next, 'aerial', 4.2)?.position, { x: 3, y: 12, z: -4 })
  assert.deepEqual(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
})

test('keeps focal length fixed while applying a push baseline', () => {
  const next = applySpatialCameraAction(state, 4.2, '推', 'actor-lead', 'director')
  assert.equal(cameraFrameAt(next, 'director', 4.2)?.focalLengthMm, 34.92)
  assert.equal(cameraFrameAt(next, 'director', 4.2)?.motionBaseline, 'push')
})

test('changes a camera route point at its own time instead of the playhead time', () => {
  const next = applyCameraRoutePointDrag(state, 'director', 10, { x: 5, y: 3, z: 1 })
  assert.deepEqual(cameraFrameAt(next, 'director', 10)?.position, { x: 5, y: 3, z: 1 })
})
~~~

- [ ] **Step 2: Run the direct-manipulation suite and confirm it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/direct-manipulation.test.ts src/lib/spatial-previs/normalize.test.ts

Expected: FAIL because mode-aware helpers and pose metadata are missing.

- [ ] **Step 3: Implement exact-time update helpers without changing unrelated tracks.**

~~~ts
export function ensureCameraKeyframeAt(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  timeSec: number,
): StateKeyframe<CameraKeyframe>

export function applyCameraTransform(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  timeSec: number,
  patch: { position: Vec3; rotation: CameraRotation },
): SpatialPrevisState

export function applyCameraRoutePointDrag(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  keyframeTimeSec: number,
  position: Vec3,
): SpatialPrevisState

export function applyCameraLens(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  timeSec: number,
  patch: { focalLengthMm?: number; shotScale?: ShotScale },
): SpatialPrevisState
~~~

applyCameraTransform must write position and rotation and then derive target using the previous camera-target distance. applyCameraTargetDrag must write target, derive rotationFromTarget, and set intent to pan-tilt. applyCameraRoutePointDrag must update only the camera frame at keyframeTimeSec. Update applySpatialCameraAction and dispatchSpatialCameraAction to accept mode with a default of director, set motionBaseline to the user-visible action, and keep focal length unchanged for push/pull/move/follow/rise/fall. Make applyBeatPatch call ensureCameraKeyframeAt at the beat midpoint and then patch that one frame so movable curve points do not break the beats editor.

- [ ] **Step 4: Run direct-manipulation and regression tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/direct-manipulation.test.ts src/lib/spatial-previs/normalize.test.ts src/lib/spatial-previs/sampler.test.ts

Expected: PASS. Each edit changes one selected plan/track, persists a full camera pose, and retains prior actor, beat, scene, and other-camera data.

- [ ] **Step 5: Commit after authorization.**

~~~bash
git add apps/web/src/lib/spatial-previs/direct-manipulation.ts apps/web/src/lib/spatial-previs/direct-manipulation.test.ts apps/web/src/lib/spatial-previs/normalize.ts apps/web/src/lib/spatial-previs/normalize.test.ts
git commit -m "feat: add spatial previs camera pose controls"
~~~

### Task 3: Add the compact Director/Aerial control surface and dismissible popovers

**Files:**
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorControls.tsx
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorControls.test.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx

- [ ] **Step 1: Add failing control-surface tests for mode changes, lenses, duration, and popover dismissal.**

~~~ts
test('offers Director and Aerial modes plus the complete 5-180 second selector', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorControls, props))
  assert.match(markup, /aria-label="导演模式"/)
  assert.match(markup, /aria-label="航拍模式"/)
  assert.match(markup, /180 秒/)
  assert.match(markup, /600 mm/)
  assert.match(markup, /建立镜头/)
})

test('owns one floating surface at a time and closes it on another trigger or outside pointer', () => {
  assert.equal(nextDirectorFloatingSurface('lens', 'duration'), 'duration')
  assert.equal(nextDirectorFloatingSurface('lens', 'lens'), null)
  assert.equal(nextDirectorFloatingSurface('duration', 'outside'), null)
})
~~~

- [ ] **Step 2: Run the controls and panel tests and confirm they fail.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorControls.test.tsx src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx

Expected: FAIL because the compact controls component and floating-surface reducer do not exist.

- [ ] **Step 3: Implement the shared compact control model and panel wiring.**

~~~ts
export type DirectorFloatingSurface = 'duration' | 'lens' | null

export function nextDirectorFloatingSurface(
  current: DirectorFloatingSurface,
  event: 'duration' | 'lens' | 'outside',
): DirectorFloatingSurface {
  if (event === 'outside') return null
  return current === event ? null : event
}

export type SpatialPrevisDirectorControlsProps = {
  cameraMode: SpatialPrevisCameraMode
  activeSurface: DirectorFloatingSurface
  durationSec: number
  selectedCamera: CameraKeyframe
  disabled: boolean
  onCameraModeChange: (mode: SpatialPrevisCameraMode) => void
  onDurationChange: (durationSec: number) => void
  onLensChange: (patch: { focalLengthMm?: number; shotScale?: ShotScale }) => void
  onMotionBaseline: (baseline: CameraMotionBaseline) => void
  onSurfaceEvent: (event: 'duration' | 'lens' | 'outside') => void
}
~~~

Use Lucide icon buttons with aria-labels: 选择, 摄影机位移与高度, 摄影机角度, 镜头参数, Director, 航拍. The two primary tabs select cameraMode in local panel state; they do not rewrite state until a camera action occurs. The duration popover lists exactly 5, 10, 15, 30, 45, 60, 90, 120, and 180 seconds. The lens popover lists every ShotScale and each value in FOCAL_LENGTH_OPTIONS plus a numeric 8-600 mm input. Pass cameraMode to SpatialPrevisViewport and SpatialCameraControlStrip. Let the panel own activeSurface and attach one document pointerdown listener that closes only when the pointer target is outside the controls root; every mode/preset action calls onSurfaceEvent('outside') first.

Place the controls in the Spatial Previs header and viewport upper-left/upper-right as specified. Keep the existing continuous/beats tabs and advanced Seedance section intact. Do not render any external provider name in the normal header.

- [ ] **Step 4: Run component tests and the existing panel contract tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorControls.test.tsx src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

Expected: PASS. The panel contains only one active popover, uses compact icon controls, and continues to expose its existing save/test/advanced-delivery features.

- [ ] **Step 5: Commit after authorization.**

~~~bash
git add apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorControls.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorControls.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx
git commit -m "feat: add compact spatial previs director controls"
~~~

### Task 4: Implement real 3D camera transform axes, rotation rings, and draggable route points

**Files:**
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

- [ ] **Step 1: Add failing interaction and rendering tests.**

~~~ts
test('attaches translation and rotation transform controls only to the selected active camera', () => {
  assert.match(viewportSource, /<TransformControls/)
  assert.match(viewportSource, /mode=\{cameraTransformMode === 'rotate' \? 'rotate' : 'translate'\}/)
  assert.match(viewportSource, /applyCameraTransform\(state, cameraMode, currentTimeSec/)
})

test('renders draggable blue actor and yellow active-camera route points', () => {
  assert.match(viewportSource, /ActorRouteKeyframeHandle/)
  assert.match(viewportSource, /CameraRouteKeyframeHandle/)
  assert.match(viewportSource, /applyCameraRoutePointDrag/)
})
~~~

- [ ] **Step 2: Run the viewport test file and confirm it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

Expected: FAIL because TransformControls and route handle components are absent.

- [ ] **Step 3: Add transform-tool and route-point interaction to the shared 3D world.**

~~~tsx
<TransformControls
  enabled={!disabled && selection.kind === 'camera' && cameraTransformMode !== 'select'}
  mode={cameraTransformMode === 'rotate' ? 'rotate' : 'translate'}
  space="world"
  size={0.8}
  onMouseDown={() => onCameraTransformDragChange(true)}
  onMouseUp={() => onCameraTransformDragChange(false)}
  onObjectChange={() => {
    const object = cameraRigRef.current
    if (!object) return
    onChange(applyCameraTransform(state, cameraMode, currentTimeSec, {
      position: { x: object.position.x, y: object.position.y, z: object.position.z },
      rotation: { pitch: object.rotation.x, yaw: object.rotation.y, roll: object.rotation.z },
    }))
  }}
>
  <CameraRigMarker ref={cameraRigRef} position={sampledCamera.position} rotation={sampledCamera.rotation} selected />
</TransformControls>
~~~

Import TransformControls from @react-three/drei/core/TransformControls and make CameraRigMarker forward its Group ref. When translation/rotation transform drag begins, disable OrbitControls and notify the panel to pause playback. On object change, mutate only the current keyframe of the active mode using applyCameraTransform. CameraRigMarker and LivePreviewCamera must use keyframe.rotation directly; target remains synchronized by the pure helper for legacy compatibility.

Render CameraRouteKeyframeHandle for each active-camera keyframe at ground projection x/z and connect it to applyCameraRoutePointDrag with that keyframe time. Render ActorRouteKeyframeHandle per actor keyframe and connect it to applyActorGroundDrag with that keyframe time. Use current-time styling only for the selected point. Handle hovering by changing the existing canvas cursor to grab/grabbing, not by adding persistent square markers. Keep existing whitebox/entity and actor direct drags unchanged.

- [ ] **Step 4: Run direct-manipulation and viewport tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/direct-manipulation.test.ts src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

Expected: PASS. The viewport mounts a solid shared world, active camera rig/frustum, real live camera view, transform axes/rings, and actor/camera route handles without adding permanent square resize cues.

- [ ] **Step 5: Commit after authorization.**

~~~bash
git add apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
git commit -m "feat: add direct spatial camera transform controls"
~~~

### Task 5: Replace blocky timing rows with draggable actor and camera curve tracks

**Files:**
- Create: apps/web/src/lib/spatial-previs/timeline.ts
- Create: apps/web/src/lib/spatial-previs/timeline.test.ts
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.tsx
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.test.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx

- [ ] **Step 1: Add failing curve and retiming tests.**

~~~ts
test('clamps a dragged keyframe time without deleting its route point', () => {
  assert.equal(clampSpatialKeyframeTime(-1, 30), 0)
  assert.equal(clampSpatialKeyframeTime(31, 30), 30)
})

test('retimes only the selected aerial camera keyframe', () => {
  const next = retimeCameraKeyframe(state, 'aerial', 'aerial-camera-mid', 18)
  assert.equal(next.masterTake.aerialCameraTrack.keyframes[1]?.timeSec, 18)
  assert.equal(next.masterTake.cameraTrack.keyframes[1]?.timeSec, 15)
})

test('renders blue actor curves and a yellow active-camera curve with draggable time points', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisTimeline, props))
  assert.match(markup, /data-spatial-curve="camera"/)
  assert.match(markup, /data-spatial-curve="actor"/)
  assert.match(markup, /aria-label="拖动相机关键帧时间"/)
})
~~~

- [ ] **Step 2: Run the new focused tests and confirm they fail.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/timeline.test.ts src/components/create/spatial-previs/SpatialPrevisTimeline.test.tsx

Expected: FAIL because curve helpers and draggable curve markup do not exist.

- [ ] **Step 3: Implement curve paths, point dragging, and exact retiming.**

~~~ts
export function clampSpatialKeyframeTime(timeSec: number, durationSec: number) {
  return Math.min(durationSec, Math.max(0, Number.isFinite(timeSec) ? timeSec : 0))
}

export function retimeCameraKeyframe(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  keyframeId: string,
  timeSec: number,
): SpatialPrevisState
~~~

In SpatialPrevisTimeline, create one SVG strip per actor and one for the active camera mode. Draw a thin cyan polyline for actor routes and a thin amber polyline for camera routes. Overlay small circular buttons on every keyframe; pointer capture calculates the relative x coordinate, clamps it through clampSpatialKeyframeTime, and invokes the correct retime callback. Keep click-to-scrub and keyboard focus behaviour. The existing Beats mode remains a separate editable list; it must not render the curve strip.

Pass cameraMode and onCameraKeyframeRetime from the director panel. Changing timeline time or dragging a point updates the 3D route and live view from the same state, with no duplicated animation state.

- [ ] **Step 4: Run timeline, panel, and persistence tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/timeline.test.ts src/components/create/spatial-previs/SpatialPrevisTimeline.test.tsx src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx src/lib/spatial-previs/persistence.test.ts

Expected: PASS. Curves and direct 3D route handles refer to the same keyframes, and retimed data saves as valid v4 state.

- [ ] **Step 5: Commit after authorization.**

~~~bash
git add apps/web/src/lib/spatial-previs/timeline.ts apps/web/src/lib/spatial-previs/timeline.test.ts apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx
git commit -m "feat: add draggable spatial previs curve timeline"
~~~

### Task 6: Deliver the expanded previs package and export a truthful live-camera WebM

**Files:**
- Create: apps/web/src/lib/spatial-previs/video-export.ts
- Create: apps/web/src/lib/spatial-previs/video-export.test.ts
- Modify: apps/web/src/lib/spatial-previs/delivery.ts
- Modify: apps/web/src/lib/spatial-previs/delivery.test.ts
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.tsx
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts

- [ ] **Step 1: Add failing package and export-state tests.**

~~~ts
test('freezes both camera plans including rotation, shot scale, and motion baseline', () => {
  const delivery = buildPrevisDeliveryPackage(state)
  assert.deepEqual(delivery.masterTake.aerialCameraTrack, state.masterTake.aerialCameraTrack)
  assert.equal(Object.isFrozen(delivery.masterTake.cameraTrack.keyframes[0]?.rotation), true)
})

test('records a canvas stream and returns a WebM blob without mutating previs state', async () => {
  const result = await exportPrevisWebM({ canvas: fakeCanvas, durationSec: 0.01, fps: 30, onTime: () => undefined })
  assert.equal(result.type, 'video/webm')
  assert.equal(state.masterTake.durationSec, 30)
})

test('reports an unavailable browser recorder instead of claiming a successful video export', async () => {
  await assert.rejects(() => exportPrevisWebM({ canvas: noStreamCanvas, durationSec: 1, fps: 30, onTime: () => undefined }), /不支持预演视频导出/)
})
~~~

- [ ] **Step 2: Run delivery/export tests and confirm they fail.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/delivery.test.ts src/lib/spatial-previs/video-export.test.ts src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx

Expected: FAIL because neither v4 deep clone nor a video-export implementation exists.

- [ ] **Step 3: Implement capture from the real live-camera canvas and wire output actions.**

~~~ts
export async function exportPrevisWebM({
  canvas,
  durationSec,
  fps,
  onTime,
  signal,
}: {
  canvas: HTMLCanvasElement
  durationSec: number
  fps: number
  onTime: (timeSec: number) => void
  signal?: AbortSignal
}): Promise<Blob>
~~~

Require canvas.captureStream and MediaRecorder before starting. Start canvas.captureStream(fps), select video/webm;codecs=vp9 only when MediaRecorder.isTypeSupported reports it, collect chunks, update onTime from 0 to durationSec on animation frames, and stop the recorder at durationSec or AbortSignal. Resolve a Blob with type video/webm only after onstop. Reject unsupported, aborted, and recorder-error paths with distinct Chinese error messages. Never write export progress into SpatialPrevisState.

Expose the live canvas from LivePreviewCanvas through an onLiveCanvas callback after Canvas creates its WebGL element. In the panel, pass that canvas to exportPrevisWebM; disable editing during recording, show progress, restore the original playhead afterward, and trigger a local download named spatial-previs-<master-take-id>.webm only after a non-empty Blob exists. The existing Generate previs node action remains a provider-neutral delivery node. The existing Download delivery package continues downloading JSON and is relabelled 下载交付包, never 导出视频. VisualCanvasWorkspace keeps its existing node, JSON download, and asset-library callbacks unchanged except for passing the panel's already-existing props.

Update cloneMasterTake to copy and freeze both camera tracks plus rotation. Preserve source references and do not expose an external provider in generated delivery metadata.

- [ ] **Step 4: Run delivery, video-export, panel, and workspace contract tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/delivery.test.ts src/lib/spatial-previs/video-export.test.ts src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts

Expected: PASS. A successful export has a real WebM Blob; unsupported browsers receive a visible failed state; node creation remains provider-neutral.

- [ ] **Step 5: Commit after authorization.**

~~~bash
git add apps/web/src/lib/spatial-previs/video-export.ts apps/web/src/lib/spatial-previs/video-export.test.ts apps/web/src/lib/spatial-previs/delivery.ts apps/web/src/lib/spatial-previs/delivery.test.ts apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts
git commit -m "feat: export spatial previs live camera video"
~~~

### Task 7: Run the full quality gate and conduct an isolated user-flow acceptance pass

**Files:**
- Modify only if test evidence exposes a direct defect in the files listed in Tasks 1-6.
- Do not modify: apps/web/tsconfig.tsbuildinfo.

- [ ] **Step 1: Run the complete Spatial Previs unit/component suite.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/*.test.ts src/components/create/spatial-previs/*.test.tsx src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx

Expected: PASS with no failed, skipped, or unhandled-rejection cases.

- [ ] **Step 2: Run TypeScript validation.**

Run: cd apps/web && npm run type-check

Expected: PASS with zero TypeScript errors.

- [ ] **Step 3: Perform an isolated browser acceptance flow before requesting user acceptance.**

Start the existing web development command on an unused port. In a disposable local project, open Spatial Previs, add one existing scene asset, add one actor, set Director to 30 seconds, then set Aerial to 180 seconds. Set focal length to 85 mm and shot scale to medium-wide. Apply Follow, move a yellow route point, drag the camera X/Y/Z axes, rotate a ring, and confirm the live camera framing changes. Switch back to Director and confirm its camera path is unchanged. Drag a cyan actor time point and a yellow camera time point. Toggle lens and duration surfaces both ways and click outside to dismiss them. Generate a previs node. Export a short 5-second WebM and verify that its downloaded Blob has a non-zero size and video/webm type. Record viewport screenshots at desktop and mobile widths.

Expected: The shared 3D world is nonblank, actor/camera are solid objects, live preview follows pose edits, both plan types stay isolated, and every locked canvas surface is visually unchanged.

- [ ] **Step 4: Inspect the final diff and generated artifacts.**

Run: git diff --check && git status --short

Expected: No whitespace errors. Only planned source/tests/docs changes are present, plus the pre-existing generated apps/web/tsconfig.tsbuildinfo and untracked .superpowers directory.

- [ ] **Step 5: Commit after authorization and request Preview deployment authorization separately.**

~~~bash
git add apps/web/src/lib/spatial-previs apps/web/src/components/create/spatial-previs apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts
git commit -m "feat: complete spatial previs director camera workflow"
git push origin codex/seedance-spatial-previs-p0
~~~

Do not run the commit or push command until the user explicitly authorizes each operation. Do not deploy Preview until push succeeds and the user authorizes deployment.
