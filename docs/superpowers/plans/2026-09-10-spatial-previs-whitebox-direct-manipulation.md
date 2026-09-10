# Spatial Previs Whitebox and Direct Manipulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a compact scene-asset entry, editable 3D whitebox proxy, direct mouse blocking, synchronized camera view, and provider-neutral previs delivery node without changing locked canvas experiences.

**Architecture:** Extend SpatialPrevisState with versioned scene references and whitebox entities, then migrate persisted v1 state to a safe empty v2 whitebox state. Keep proxy generation, pointer-to-keyframe mutation, and delivery serialization as pure library modules; the React Three Fiber viewport and director panel only render and invoke those contracts. The existing Seedance path remains intact but moves outside the normal previs composition flow.

**Tech Stack:** Next.js/React, TypeScript, React Three Fiber, Drei, Three.js, Node test runner, existing canvas asset APIs and project metadata persistence.

---

## File Structure

- Modify: apps/web/src/lib/spatial-previs/types.ts - v2 scene-reference and whitebox entity contract.
- Modify: apps/web/src/lib/spatial-previs/normalize.ts - canonical empty v2 scene.
- Modify: apps/web/src/lib/spatial-previs/persistence.ts - strict v1/v2 parsing and non-destructive v1 migration.
- Create: apps/web/src/lib/spatial-previs/whitebox.ts - deterministic proxy draft builder.
- Create: apps/web/src/lib/spatial-previs/direct-manipulation.ts - current-time keyframe mutation.
- Create: apps/web/src/lib/spatial-previs/delivery.ts - immutable provider-neutral delivery package.
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.tsx - compact + Scene assets picker/drop target.
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx - whitebox meshes, 3D rigs, pointer interaction layer.
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx - compact entry, normal delivery-node action, collapsed Fine tune/advanced delivery.
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.tsx - project asset upload bridge, delivery-node creation, download and asset-library callbacks.
- Create or modify tests beside the files above and VisualCanvasWorkspace.spatial-previs-persistence.test.ts.

### Task 1: Add versioned whitebox state

**Files:**
- Modify: apps/web/src/lib/spatial-previs/types.ts
- Modify: apps/web/src/lib/spatial-previs/normalize.ts
- Test: apps/web/src/lib/spatial-previs/normalize.test.ts

- [ ] **Step 1: Write the failing normalization test.**

~~~
test('creates a v2 previs state with an empty whitebox and references', () => {
  const state = normalizeSpatialPrevis({ projectId: 'project-1' })
  assert.equal(state.version, 2)
  assert.deepEqual(state.scene.references, [])
  assert.deepEqual(state.scene.whitebox.entities, [])
})
~~~

- [ ] **Step 2: Run the test to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/normalize.test.ts

Expected: FAIL because the v2 fields do not exist.

- [ ] **Step 3: Define the minimum types and default state.**

~~~
export type SpatialSceneReference = {
  id: string; assetId: string; title: string
  mediaType: 'image' | 'video'; url: string
  source: 'project' | 'upload'
}
export type WhiteboxEntity = {
  id: string
  kind: 'floor' | 'wall' | 'opening' | 'volume' | 'furniture' | 'referencePlane'
  position: Vec3; rotationY: number; size: Vec3
  sourceAssetIds: string[]
}
~~~

Change SpatialPrevisState.version to 2 and initialize references: [] plus
whitebox: { entities: [] }. Do not change master-take defaults.

- [ ] **Step 4: Re-run the focused test.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/normalize.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/lib/spatial-previs/types.ts apps/web/src/lib/spatial-previs/normalize.ts apps/web/src/lib/spatial-previs/normalize.test.ts
git commit -m "feat: add spatial previs whitebox scene state"
~~~

### Task 2: Migrate v1 persistence and validate v2

**Files:**
- Modify: apps/web/src/lib/spatial-previs/persistence.ts
- Test: apps/web/src/lib/spatial-previs/persistence.test.ts

- [ ] **Step 1: Write failing migration and rejection tests.**

~~~
test('migrates a valid v1 persisted previs to empty v2 scene data', () => {
  const parsed = parseSpatialPrevisMetadata({ spatialPrevis: validV1State })
  assert.equal(parsed?.version, 2)
  assert.deepEqual(parsed?.scene.references, [])
})
test('rejects a v2 reference without a safe media URL', () => {
  assert.equal(parseSpatialPrevisMetadata({ spatialPrevis: invalidV2Reference }), null)
})
~~~

- [ ] **Step 2: Run the test to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/persistence.test.ts

Expected: FAIL because persistence accepts only version 1.

- [ ] **Step 3: Implement strict parsing and one-way migration.**

~~~
function sceneReferences(value: unknown): SpatialSceneReference[] | null
function whiteboxEntities(value: unknown): WhiteboxEntity[] | null
function migrateV1(candidate: MetadataRecord): SpatialPrevisState | null
function parseV2(candidate: MetadataRecord): SpatialPrevisState | null
~~~

Migration preserves all v1 timeline, coverage, beat, and camera data and only
supplies empty v2 references/whitebox data. v2 parsing validates each entity
kind, Vec3, source asset id, and media URL.

- [ ] **Step 4: Run migration and normalization tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/persistence.test.ts src/lib/spatial-previs/normalize.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/lib/spatial-previs/persistence.ts apps/web/src/lib/spatial-previs/persistence.test.ts
git commit -m "feat: migrate persisted spatial previs whitebox state"
~~~

### Task 3: Build deterministic editable whitebox drafts

**Files:**
- Create: apps/web/src/lib/spatial-previs/whitebox.ts
- Test: apps/web/src/lib/spatial-previs/whitebox.test.ts

- [ ] **Step 1: Write the failing proxy-builder test.**

~~~
test('builds a conservative editable draft from scene references', () => {
  const draft = buildWhiteboxDraft(references)
  assert.deepEqual(draft.entities.map((item) => item.kind), [
    'floor', 'referencePlane', 'volume', 'wall',
  ])
  assert.equal(draft.entities.every((item) => item.sourceAssetIds.length > 0), true)
})
~~~

- [ ] **Step 2: Run it to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/whitebox.test.ts

Expected: FAIL with missing module/export.

- [ ] **Step 3: Implement the deterministic proxy builder.**

~~~
export function buildWhiteboxDraft(references: readonly SpatialSceneReference[]) {
  return { entities: references.flatMap((reference, index) => [
    index === 0 ? floorFor(reference.assetId) : null,
    referencePlaneFor(reference, index),
    volumeFor(reference, index),
    wallFor(reference, index),
  ].filter((item): item is WhiteboxEntity => item !== null)) }
}
export function replaceWhiteboxDraft(state: SpatialPrevisState, references: SpatialSceneReference[]) {
  return { ...state, scene: { ...state.scene, references, whitebox: buildWhiteboxDraft(references) } }
}
~~~

Use documented fixed offsets and sizes. The builder must not infer real-world
scale or describe a proxy as photogrammetrically accurate.

- [ ] **Step 4: Run the focused test.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/whitebox.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/lib/spatial-previs/whitebox.ts apps/web/src/lib/spatial-previs/whitebox.test.ts
git commit -m "feat: build editable spatial whitebox drafts"
~~~

### Task 4: Add compact scene asset selection and upload

**Files:**
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.tsx
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.tsx

- [ ] **Step 1: Write the failing compact-entry contract.**

~~~
test('renders one compact scene-assets entry instead of a persistent asset panel', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisSceneAssets, props))
  assert.match(markup, /aria-label="添加场景资产"/)
  assert.match(markup, /dropzone/)
  assert.doesNotMatch(markup, /项目素材\s*<\/h2>/)
})
~~~

- [ ] **Step 2: Run it to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the picker and parent upload bridge.**

~~~
<SpatialPrevisSceneAssets
  projectId={initialState.projectId}
  references={state.scene.references}
  disabled={isBusy}
  onReferencesChange={(references) => handleStateChange(replaceWhiteboxDraft(state, references))}
  onUpload={onUploadSceneAsset}
/>
~~~

Use the existing project-assets query for asset selection. In the workspace use
validateLocalMediaFile, buildUploadFormData, and uploadAssetWithTimeout from
lib/canvas/localImageImport.ts to return a project-scoped SpatialSceneReference.
Do not modify ProjectAssetsPanel or its established canvas behavior.

- [ ] **Step 4: Run focused component and upload tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx src/lib/canvas/localImageImport.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx apps/web/src/components/create/VisualCanvasWorkspace.tsx
git commit -m "feat: add compact spatial scene asset entry"
~~~

### Task 5: Render solid whitebox, actor, and camera rigs

**Files:**
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx
- Test: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

- [ ] **Step 1: Write failing render contracts.**

~~~
test('renders solid whitebox entities, actor proxy, and physical camera rig', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisViewport, { state: whiteboxState, currentTimeSec: 6, onChange: () => undefined }))
  assert.match(markup, /data-spatial-whitebox-world="true"/)
  assert.match(markup, /data-spatial-camera-rig="true"/)
  assert.match(markup, /data-spatial-live-camera="true"/)
})
~~~

- [ ] **Step 2: Run it to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

Expected: FAIL on missing data attributes.

- [ ] **Step 3: Render shared whitebox geometry in both canvases.**

~~~
function WhiteboxEntityMesh({ entity }: { entity: WhiteboxEntity }) {
  return <mesh data-spatial-whitebox-entity={entity.kind} position={tuple(entity.position)} rotation={[0, entity.rotationY, 0]}>
    <boxGeometry args={[entity.size.x, entity.size.y, entity.size.z]} />
    <meshStandardMaterial color={WHITEBOX_COLORS[entity.kind]} roughness={0.82} />
  </mesh>
}
~~~

Render the same WorldGeometry in overview and live camera canvases. Replace
marker-only camera geometry with a body/lens/tripod/frustum group and render
the actor as a capsule/head/limb group. Preserve coverage advisory behavior.

- [ ] **Step 4: Run viewport tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
git commit -m "feat: render spatial previs whitebox world"
~~~

### Task 6: Add pure current-time direct-manipulation mutations

**Files:**
- Create: apps/web/src/lib/spatial-previs/direct-manipulation.ts
- Create: apps/web/src/lib/spatial-previs/direct-manipulation.test.ts

- [ ] **Step 1: Write failing move, height, facing, and target tests.**

~~~
test('creates a current-time actor keyframe for a ground drag', () => {
  const next = applyActorGroundDrag(state, 'actor-1', 4.2, { x: 3, z: -2 })
  assert.deepEqual(actorFrameAt(next, 'actor-1', 4.2)?.position, { x: 3, y: 0, z: -2 })
})
test('writes pan-tilt when the camera target is dragged', () => {
  assert.equal(applyCameraTargetDrag(state, 4.2, { x: 1, y: 2, z: 0 }).masterTake.cameraTrack.keyframes.at(-1)?.intent, 'pan-tilt')
})
~~~

- [ ] **Step 2: Run it to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/direct-manipulation.test.ts

Expected: FAIL with missing module exports.

- [ ] **Step 3: Implement idempotent current-time upserts.**

~~~
export function ensureCameraKeyframeAt(state: SpatialPrevisState, timeSec: number): { state: SpatialPrevisState; keyframe: CameraKeyframe }
export function applyActorGroundDrag(state: SpatialPrevisState, actorTrackId: string, timeSec: number, ground: { x: number; z: number }): SpatialPrevisState
export function applyObjectHeightDrag(state: SpatialPrevisState, object: 'actor' | 'camera', timeSec: number, y: number, actorTrackId?: string): SpatialPrevisState
export function applyActorFacingDrag(state: SpatialPrevisState, actorTrackId: string, timeSec: number, target: Vec3): SpatialPrevisState
export function applyCameraTargetDrag(state: SpatialPrevisState, timeSec: number, target: Vec3): SpatialPrevisState
export function applyCameraDollyDrag(state: SpatialPrevisState, timeSec: number, position: Vec3): SpatialPrevisState
~~~

Every operation updates or adds one current-time keyframe and preserves all
other keyframes, beats, focal length, scale, and independent actor/camera data.

- [ ] **Step 4: Run the direct-manipulation tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/direct-manipulation.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/lib/spatial-previs/direct-manipulation.ts apps/web/src/lib/spatial-previs/direct-manipulation.test.ts
git commit -m "feat: add direct spatial keyframe manipulation"
~~~

### Task 7: Replace persistent gizmos with pointer-first 3D blocking

**Files:**
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx
- Test: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

- [ ] **Step 1: Write failing pointer-first contracts.**

~~~
test('uses pointer affordances instead of permanent transform-control squares', () => {
  assert.doesNotMatch(viewportSource, /<TransformControls/)
  assert.match(viewportSource, /data-spatial-direct-handle="vertical"/)
  assert.match(viewportSource, /data-spatial-direct-handle="camera-target"/)
})
~~~

- [ ] **Step 2: Run it to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

Expected: FAIL while TransformControls exists.

- [ ] **Step 3: Implement pointer-first hit regions.**

~~~
<mesh onPointerDown={beginGroundDrag} onPointerMove={moveGroundDrag} onPointerUp={endDrag}>
  <cylinderGeometry args={[0.42, 0.42, 0.06, 24]} />
  <meshBasicMaterial transparent opacity={0} />
</mesh>
{selected ? <VerticalGuide data-spatial-direct-handle="vertical" onDrag={applyHeight} /> : null}
{selectedCamera ? <CameraTargetHandle data-spatial-direct-handle="camera-target" onDrag={applyCameraTarget} /> : null}
~~~

Raycast body drags to the ground plane. Guides exist only while selected and
use grab, grabbing, ns-resize, and crosshair cursors. No permanent square
handles are allowed. Disable OrbitControls only while an object drag is active.
Route completed drags through Task 6 functions.

- [ ] **Step 4: Run viewport and direct-manipulation tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx src/lib/spatial-previs/direct-manipulation.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
git commit -m "feat: enable pointer first spatial blocking"
~~~

### Task 8: Create neutral delivery packages and canvas nodes

**Files:**
- Create: apps/web/src/lib/spatial-previs/delivery.ts
- Create: apps/web/src/lib/spatial-previs/delivery.test.ts
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.tsx
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts

- [ ] **Step 1: Write the failing neutral-delivery test.**

~~~
test('serializes whitebox, references, and tracks without provider capability', () => {
  const delivery = buildPrevisDeliveryPackage(state)
  assert.equal(delivery.kind, 'spatial-previs-delivery')
  assert.equal('capability' in delivery, false)
  assert.deepEqual(delivery.scene.whitebox.entities, state.scene.whitebox.entities)
})
~~~

- [ ] **Step 2: Run it to prove it fails.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/delivery.test.ts

Expected: FAIL with missing module export.

- [ ] **Step 3: Implement package, normal panel action, and workspace callbacks.**

~~~
export type PrevisDeliveryPackage = Readonly<{
  kind: 'spatial-previs-delivery'; version: 1; projectId: string
  masterTake: MasterTake; scene: SpatialPrevisScene
}>
export function buildPrevisDeliveryPackage(state: SpatialPrevisState): PrevisDeliveryPackage
~~~

Add onCreateDeliveryNode, onDownloadDeliveryPackage, and
onSaveDeliveryPackageToAssets props to the director panel. The composition
primary action reads Generate previs node and must not show a model name.
The existing Seedance surface remains only under an explicit advanced delivery
disclosure.

In VisualCanvasWorkspace, create the neutral canvas node with the existing
createNode('text', ...) helper and metadataJson.previsDelivery. Use Blob/object
URL for downloads. Use the established POST /api/projects/:projectId/assets
pattern only after the user presses Save to asset library.

- [ ] **Step 4: Run focused delivery and workspace tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/delivery.test.ts src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts

Expected: PASS; primary panel markup contains no Seedance model name.

- [ ] **Step 5: Commit.**

~~~
git add apps/web/src/lib/spatial-previs/delivery.ts apps/web/src/lib/spatial-previs/delivery.test.ts apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts
git commit -m "feat: create neutral spatial previs delivery nodes"
~~~

### Task 9: Run regression and manual acceptance QA

**Files:**
- Modify only if a test exposes a defect in Tasks 1-8.
- Test: existing spatial previs, context-menu, and locked canvas suites.

- [ ] **Step 1: Run all focused tests.**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/*.test.ts src/components/create/spatial-previs/*.test.tsx src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts

Expected: PASS.

- [ ] **Step 2: Run type check and production build.**

Run: pnpm --filter web typecheck && pnpm --filter web build

Expected: both commands exit 0. Report unrelated existing warnings separately.

- [ ] **Step 3: Run desktop and mobile browser regression suites.**

Run: use the repository's existing Playwright commands for Spatial Previs,
node/editor coupling, resize, and context-menu tests.

Expected: all locked-experience suites pass without changed layout assertions.

- [ ] **Step 4: Perform manual isolated-project QA.**

Check: add image and video references through + Scene assets; generate a whitebox;
drag actor, camera, camera target, and vertical guide at three playhead positions;
verify the live camera changes; create a neutral delivery node; trigger a test-only
download; verify Save-to-assets with a mocked response. This local QA pass does
not dispatch to a provider or persist to a creator's actual asset library.

- [ ] **Step 5: Run the controlled Seedance acceptance test after all local QA passes.**

Use one pre-existing asset-library reference. Read the live provider capability
and account route, then present the exact 5- or 10-second duration and estimated
credit use for immediate founder confirmation. Submit one delivery only when the
provider actually offers the selected short duration. Do not silently choose 30
seconds or a longer fallback. If no 5- or 10-second route is available, record
the limitation and stop without submitting.

- [ ] **Step 6: Commit verification-only fixes if needed and report scope.**

~~~
git status --short
git log --oneline -10
~~~

Include Confirmed experience impact: none in the delivery summary and list any
verification that could not be run.
