# Spatial Previs Asset Whitebox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Creator City assets into an editable shared 3D whitebox with direct actor/camera blocking and a provider-neutral 5-10 second internal previs test that materializes as a canvas result node.

**Architecture:** Extend the existing `spatial-previs` state in-place: asset references retain grouping and provenance, deterministic whitebox reconstruction produces editable solids plus advisory confidence, and the existing R3F overview/live-camera pair renders the same state. The new short-test control will call the existing Seedance delivery endpoint behind a Creator City action, create a normal video node before dispatch, and reuse the established video-status/asset persistence path.

**Tech Stack:** Next.js App Router, React, TypeScript, React Three Fiber, drei, Three.js, Node test runner with TSX, Prisma-backed generation jobs.

**Locked scope:** Do not modify the accepted canvas node/dialog sizing, resize behavior, grouped navigation, context menus, login flow, or existing generation/BYOK/script/save controls. Do not add a new provider picker or a second 3D renderer.

---

## File Structure

- Modify `apps/web/src/lib/spatial-previs/types.ts`: versioned asset grouping, whitebox confidence, and explicit editor entity metadata.
- Modify `apps/web/src/lib/spatial-previs/normalize.ts`: create compatible v3 defaults while retaining the existing full-take duration behavior.
- Modify `apps/web/src/lib/spatial-previs/persistence.ts`: accept v1/v2 drafts, serialize/validate v3 drafts, and preserve project isolation.
- Modify `apps/web/src/lib/spatial-previs/whitebox.ts`: deterministic grouped asset-to-solid reconstruction plus immutable whitebox entity edits.
- Create `apps/web/src/lib/spatial-previs/asset-sets.ts`: immutable asset-set creation and scene-input replacement.
- Create `apps/web/src/lib/spatial-previs/test-delivery.ts`: derive internal-test references and validate only 5 or 10 second test requests.
- Modify `apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.tsx`: compact top asset strip, library-first source, multi-file image group upload, and typed scene roles.
- Create `apps/web/src/components/create/spatial-previs/SpatialWhiteboxToolbar.tsx`: add-floor/wall/opening/furniture/prop controls scoped to the previs overlay.
- Modify `apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx`: selectable, draggable solid whitebox entities while preserving existing actor/camera drag behavior and synchronized live view.
- Modify `apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx`: expose the seven compact camera-language actions `推`, `拉`, `摇`, `移`, `跟`, `升`, `降`.
- Create `apps/web/src/components/create/spatial-previs/SpatialPrevisTestPanel.tsx`: 5/10 second internal-test action and status without displaying a provider/model selector.
- Modify `apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx`: compose the asset strip, whitebox toolbar, viewport, timeline, and test action without changing the outer canvas overlay contract.
- Modify `apps/web/src/components/create/VisualCanvasWorkspace.tsx`: upload grouped files, persist a placeholder test node before dispatch, and reconcile the normal video status into that node.
- Modify `apps/web/src/app/api/generate/seedance-previs/handler.ts`: accept a caller-provided canvas node id, retain it in the GenerationJob, and return the GenerationJob id to the internal caller.

### Task 1: Version the spatial-previs draft without losing existing projects

**Files:**
- Modify: `apps/web/src/lib/spatial-previs/types.ts`
- Modify: `apps/web/src/lib/spatial-previs/normalize.ts`
- Modify: `apps/web/src/lib/spatial-previs/persistence.ts`
- Test: `apps/web/src/lib/spatial-previs/normalize.test.ts`
- Test: `apps/web/src/lib/spatial-previs/persistence.test.ts`

- [x] **Step 1: Write failing compatibility tests for grouped references and confidence metadata**

```ts
test('parses a v2 draft into a v3 asset set without changing its source references', () => {
  const parsed = parseSpatialPrevisMetadata({ spatialPrevis: v2Fixture })
  assert.equal(parsed?.version, 3)
  assert.deepEqual(parsed?.scene.assetSets, [{
    id: 'asset-set-legacy-1',
    role: 'scene',
    referenceIds: ['scene-library-street'],
  }])
  assert.deepEqual(parsed?.scene.references, v2Fixture.scene.references)
})

test('rejects a v3 entity whose confidence is outside the 0..1 range', () => {
  assert.equal(parseSpatialPrevisMetadata({ spatialPrevis: invalidConfidenceFixture }), null)
})
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/normalize.test.ts src/lib/spatial-previs/persistence.test.ts`

Expected: FAIL because v3 state, `assetSets`, and whitebox confidence are not yet modeled.

- [x] **Step 3: Add the minimal v3 state fields and explicit compatibility conversion**

```ts
export type SpatialAssetRole = 'scene' | 'character' | 'prop' | 'reference'

export type SpatialSceneAssetSet = {
  id: string
  role: SpatialAssetRole
  referenceIds: string[]
}

export type WhiteboxEntity = {
  id: string
  kind: 'floor' | 'wall' | 'opening' | 'volume' | 'furniture' | 'prop' | 'referencePlane'
  label: string
  confidence: number
  position: Vec3
  rotationY: number
  size: Vec3
  sourceAssetIds: string[]
}

export type SpatialPrevisState = {
  version: 3
  projectId: string
  scene: SpatialPrevisScene
  masterTake: MasterTake
  editorMode: SpatialPrevisMode
  updatedAt: string
}
```

In `parseSpatialPrevisMetadata`, parse legacy v1/v2 into the v3 shape. Assign a deterministic `asset-set-legacy-{index + 1}`, preserve every reference unchanged, and add `label`/`confidence: 1` to legacy whitebox entities. Validate `confidence >= 0 && confidence <= 1`, nonempty labels, unique set ids, and that every set reference id exists in `scene.references`. Do not infer identity from email or asset title.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/normalize.test.ts src/lib/spatial-previs/persistence.test.ts`

Expected: PASS with v1/v2 retained and malformed v3 rejected.

- [ ] **Step 5: Commit the state migration**

```bash
git add apps/web/src/lib/spatial-previs/types.ts apps/web/src/lib/spatial-previs/normalize.ts apps/web/src/lib/spatial-previs/persistence.ts apps/web/src/lib/spatial-previs/normalize.test.ts apps/web/src/lib/spatial-previs/persistence.test.ts
git commit -m "feat: version spatial previs asset drafts"
```

### Task 2: Reconstruct an attributable editable whitebox from asset sets

**Files:**
- Modify: `apps/web/src/lib/spatial-previs/whitebox.ts`
- Create: `apps/web/src/lib/spatial-previs/whitebox-edit.ts`
- Test: `apps/web/src/lib/spatial-previs/whitebox.test.ts`
- Create: `apps/web/src/lib/spatial-previs/whitebox-edit.test.ts`

- [x] **Step 1: Write failing reconstruction and edit tests**

```ts
test('creates floor, walls, opening, furniture and reference solids for a scene asset set', () => {
  const draft = buildWhiteboxDraft(references, [sceneSet])
  assert.deepEqual(draft.entities.map((entity) => entity.kind), [
    'floor', 'wall', 'wall', 'wall', 'opening', 'furniture', 'referencePlane',
  ])
  assert.equal(draft.entities.every((entity) => entity.sourceAssetIds.includes('asset-street')), true)
})

test('moves one whitebox solid without mutating actors, camera, or the original state', () => {
  const next = updateWhiteboxEntity(fixture, 'wall-asset-set-1-east', {
    position: { x: 6, y: 1.5, z: 0 },
  })
  assert.equal(next.scene.whitebox.entities.find((item) => item.id === 'wall-asset-set-1-east')?.position.x, 6)
  assert.deepEqual(next.masterTake, fixture.masterTake)
  assert.deepEqual(fixture, source)
})
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/whitebox.test.ts src/lib/spatial-previs/whitebox-edit.test.ts`

Expected: FAIL because reconstruction currently emits only proxy volume/wall/reference-plane geometry and there is no immutable edit helper.

- [x] **Step 3: Implement deterministic reconstruction and immutable edits**

```ts
export function updateWhiteboxEntity(
  state: SpatialPrevisState,
  entityId: string,
  patch: Partial<Pick<WhiteboxEntity, 'position' | 'rotationY' | 'size'>>,
): SpatialPrevisState {
  const entities = state.scene.whitebox.entities.map((entity) => (
    entity.id === entityId ? {
      ...entity,
      ...patch,
      position: patch.position ? { ...patch.position } : { ...entity.position },
      size: patch.size ? { ...patch.size } : { ...entity.size },
    } : entity
  ))
  return { ...state, scene: { ...state.scene, whitebox: { entities } } }
}

export function applyWhiteboxGroundDrag(
  state: SpatialPrevisState,
  entityId: string,
  point: Pick<Vec3, 'x' | 'z'>,
): SpatialPrevisState {
  const entity = state.scene.whitebox.entities.find((item) => item.id === entityId)
  return entity ? updateWhiteboxEntity(state, entityId, {
    position: { ...entity.position, x: point.x, z: point.z },
    rotationY: entity.rotationY,
    size: entity.size,
  }) : state
}

export function createManualWhiteboxEntity(kind: WhiteboxEntity['kind'], index: number): WhiteboxEntity {
  return {
    id: `manual-${kind}-${index}`,
    kind,
    label: `手动${kind}-${index}`,
    confidence: 1,
    position: { x: index * 0.5, y: kind === 'floor' ? -0.05 : 0.5, z: index * 0.5 },
    rotationY: 0,
    size: kind === 'floor' ? { x: 8, y: 0.1, z: 8 } : { x: 1, y: 1, z: 1 },
    sourceAssetIds: ['manual'],
  }
}
```

For each scene set, generate a complete labeled set of conservative solids in fixed editor units: one floor, three enclosing walls, one opening, one furniture block, and one reference plane per selected source. Generate a `prop` for prop asset sets and never make character assets part of static whitebox geometry. `confidence` is deterministic: `1` for manual additions, `0.75` for multi-view/video reconstruction, and `0.45` for a single image. Keep floor expansion and source attribution deterministic; low confidence only affects advisory styling, never editability.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/whitebox.test.ts src/lib/spatial-previs/whitebox-edit.test.ts`

Expected: PASS with complete solid geometry, stable ids, immutable edits, and preserved provenance.

TDD evidence: the requested three-file suite was red with the two added regressions (27 pass, 2 fail) and green at 29/29 after implementation on 2026-09-10. The validation/material-color repair was red at 43 pass, 4 fail and green at 47/47.

- [ ] **Step 5: Commit the whitebox core**

```bash
git add apps/web/src/lib/spatial-previs/whitebox.ts apps/web/src/lib/spatial-previs/whitebox-edit.ts apps/web/src/lib/spatial-previs/whitebox.test.ts apps/web/src/lib/spatial-previs/whitebox-edit.test.ts
git commit -m "feat: build editable spatial whiteboxes"
```

### Task 3: Make the asset library the compact default scene source

**Files:**
- Create: `apps/web/src/lib/spatial-previs/asset-sets.ts`
- Create: `apps/web/src/lib/spatial-previs/asset-sets.test.ts`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.tsx`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Test: `apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts`

- [x] **Step 1: Write failing UI/helper tests for library-first selection and multi-angle upload**

```ts
test('adds a selected library asset as the default scene set', () => {
  const next = addSpatialSceneAssetSet(emptyState, [libraryStreet], 'scene')
  assert.deepEqual(next.scene.assetSets[0], {
    id: 'asset-set-scene-1', role: 'scene', referenceIds: [libraryStreet.id],
  })
})

test('keeps all files in a multi-angle upload group in selection order', async () => {
  const uploaded = await uploadSceneAssetFiles([front, left, right], upload)
  assert.deepEqual(uploaded.map((item) => item.title), ['front.jpg', 'left.jpg', 'right.jpg'])
})
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/asset-sets.test.ts src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts`

Expected: FAIL because the asset picker is not grouped and the file input only accepts one file.

- [x] **Step 3: Implement the compact asset strip and grouped uploads**

Use the existing `/api/assets?limit=200` query and the existing upload API only. Show the asset-library section before current-project assets. Keep the closed control as a single compact top strip with the selected asset-set name and a `+` add button; expand only within the previs overlay.

```ts
export function addSpatialSceneAssetSet(
  state: SpatialPrevisState,
  references: readonly SpatialSceneReference[],
  role: SpatialAssetRole,
): SpatialPrevisState {
  const nextReferences = appendUniqueReferences(state.scene.references, references)
  const assetSets = [...state.scene.assetSets, {
    id: `asset-set-${role}-${state.scene.assetSets.length + 1}`,
    role,
    referenceIds: references.map((reference) => reference.id),
  }]
  return replaceSpatialSceneInputs(state, nextReferences, assetSets)
}
```

`replaceSpatialSceneInputs` must copy inputs, reject duplicate reference ids, then call `buildWhiteboxDraft(nextReferences, assetSets)`. `uploadSceneAssetFiles` accepts the existing single-file uploader and awaits each file in order before it calls `addSpatialSceneAssetSet` once with role `scene`.

```tsx
<input
  ref={inputRef}
  type="file"
  multiple
  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
  onChange={(event) => void uploadFiles(Array.from(event.currentTarget.files ?? []))}
/>
```

`uploadFiles` must upload sequentially, preserve selection order, set `onUploadPending(true)` for the complete batch, and create one `scene` asset set for a multi-file image group. A single file remains a valid scene input. Provide explicit role choice only after selection (`场景`, `人物`, `道具`, `参考`); no new global asset UI and no removal of the existing library/project sources.

In `VisualCanvasWorkspace`, add `handleUploadSpatialSceneAssets(files)` by mapping the existing `handleUploadSpatialSceneAsset(file)`; do not add a new storage endpoint.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/asset-sets.test.ts src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts`

Expected: PASS with library-first grouping, source provenance, and ordered multi-file upload.

TDD evidence: the initial focused suite was red with 10 passed and 7 failed; the boundary regressions were red with 13 passed and 2 failed; the initial implementation suite was green at 21/21. Review repairs were red with 44 passed and 4 failed, then green at 57/57.

- [ ] **Step 5: Commit the asset entry surface**

```bash
git add apps/web/src/lib/spatial-previs/asset-sets.ts apps/web/src/lib/spatial-previs/asset-sets.test.ts apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts
git commit -m "feat: group spatial previs scene assets"
```

### Task 4: Let creators edit real whitebox solids inside the existing shared 3D world

**Files:**
- Create: `apps/web/src/components/create/spatial-previs/SpatialWhiteboxToolbar.tsx`
- Create: `apps/web/src/components/create/spatial-previs/SpatialWhiteboxToolbar.test.tsx`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx`

- [x] **Step 1: Write failing interaction tests**

```ts
test('renders solid whitebox geometry, a 3D actor, a 3D camera rig, frustum, and live camera canvas', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisViewport, props))
  assert.match(markup, /data-spatial-previs-viewport/)
  assert.match(markup, /data-spatial-camera-preview/)
  assert.match(markup, /添加墙体/)
})

test('ground-dragging a selected wall updates only that solid transform', () => {
  const next = applyWhiteboxGroundDrag(state, 'wall-asset-set-1-east', { x: 4, z: -2 })
  assert.deepEqual(next.scene.whitebox.entities.find((item) => item.id === 'wall-asset-set-1-east')?.position, { x: 4, y: 1.5, z: -2 })
  assert.deepEqual(next.masterTake, state.masterTake)
})
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx src/components/create/spatial-previs/SpatialWhiteboxToolbar.test.tsx src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx`

Expected: FAIL because static whitebox meshes are not selectable/editable and no scene-building toolbar exists.

TDD RED evidence: toolbar/director had 13 passed and 3 failed; the actual whitebox pointer test timed out.
Quality follow-up RED evidence: manual ID, duplicate persistence ID, and reload guard checks had 32 passed and 3 failed; the low-confidence advisory check failed 0/1.

- [x] **Step 3: Implement direct whitebox editing without replacing actor/camera controls**

Add `WhiteboxEntityMesh` pointer handlers using the same ground-plane conversion and pointer-capture/cancellation rules already used by actor and camera dragging. Reuse the existing cursor semantics: `grab` on a solid, `grabbing` while moving, and no visible resize boxes or new canvas-wide drag handlers.

```tsx
<WhiteboxEntityMesh
  entity={entity}
  selected={selection.kind === 'whitebox' && selection.id === entity.id}
  onGroundDrag={(position) => onChange(applyWhiteboxGroundDrag(state, entity.id, position))}
/>
```

`SpatialWhiteboxToolbar` lives at the top of the previs workspace and exposes only additive buttons: `+ 地面`, `+ 墙体`, `+ 开口`, `+ 家具`, `+ 道具`. It uses deterministic defaults from `createManualWhiteboxEntity`, updates the same state, and is unavailable only while the previs draft is saving/uploading. Do not add a scene-building panel outside the spatial-previs overlay.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx src/components/create/spatial-previs/SpatialWhiteboxToolbar.test.tsx src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx`

Expected: PASS with one shared R3F world, editable solids, unchanged actor/camera manipulation, frustum, and live camera preview.

TDD GREEN evidence: the focused suite passed 52/52; the exact actual pointer test passed 1/1 twice.
Quality follow-up GREEN evidence: all related Task 4 suites passed 104/104.

- [ ] **Step 5: Commit the shared-world editor**

```bash
git add apps/web/src/components/create/spatial-previs/SpatialWhiteboxToolbar.tsx apps/web/src/components/create/spatial-previs/SpatialWhiteboxToolbar.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx apps/web/src/lib/spatial-previs/whitebox-edit.ts apps/web/src/lib/spatial-previs/whitebox-edit.test.ts
git commit -m "feat: edit spatial previs whitebox solids"
```

### Task 5: Make all seven camera-language tools explicit and synchronized

**Files:**
- Modify: `apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx`
- Create: `apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.test.tsx`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx`

- [x] **Step 1: Write failing tests for the seven actions**

```ts
test('exposes the seven compact camera-language actions', () => {
  assert.deepEqual(SPATIAL_CAMERA_ACTIONS, ['推', '拉', '摇', '移', '跟', '升', '降'])
})

test('lowering changes only camera and target height while preserving the actor path', () => {
  const next = applySpatialCameraAction(state, 5, '降', 'actor-lead')
  assert.ok(next.masterTake.cameraTrack.keyframes[1]!.position.y < state.masterTake.cameraTrack.keyframes[1]!.position.y)
  assert.deepEqual(next.masterTake.actorTracks, state.masterTake.actorTracks)
})
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialCameraControlStrip.test.tsx src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx`

Expected: FAIL because the current strip combines push/pull and rise/lower actions.

- [x] **Step 3: Implement seven semantic actions with the current camera state model**

```ts
export const SPATIAL_CAMERA_ACTIONS = ['推', '拉', '摇', '移', '跟', '升', '降'] as const

case '推': return { position: addVector(keyframe.position, scaleVector(forward, POSITION_DELTA)), intent: 'push' }
case '拉': return { position: addVector(keyframe.position, scaleVector(forward, -POSITION_DELTA)), intent: 'pull' }
case '升': return { position: addVector(keyframe.position, { x: 0, y: POSITION_DELTA, z: 0 }), target: addVector(keyframe.target, { x: 0, y: POSITION_DELTA, z: 0 }), intent: 'crane' }
case '降': return { position: addVector(keyframe.position, { x: 0, y: -POSITION_DELTA, z: 0 }), target: addVector(keyframe.target, { x: 0, y: -POSITION_DELTA, z: 0 }), intent: 'crane' }
```

Keep `摇` mapped to target rotation (`pan-tilt`), `移` mapped to lateral dolly, and `跟` mapped to the selected actor. The strip remains compact below the overview, while direct dragging remains the primary workflow. Each state change must continue to flow through `sampleCamera`, so overview frustum and live camera output change together.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialCameraControlStrip.test.tsx src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx`

Expected: PASS with seven controls and synchronized position/target/intent updates.

TDD evidence: focused action regressions were red with 3 failing assertions, then green at 36/36. The final locked regression run is green at 188/188.

- [ ] **Step 5: Commit the camera controls**

```bash
git add apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
git commit -m "feat: expose spatial camera language controls"
```

### Task 6: Add provider-neutral 5-10 second internal test dispatch

**Files:**
- Create: `apps/web/src/lib/spatial-previs/test-delivery.ts`
- Create: `apps/web/src/lib/spatial-previs/test-delivery.test.ts`
- Create: `apps/web/src/components/create/spatial-previs/SpatialPrevisTestPanel.tsx`
- Create: `apps/web/src/components/create/spatial-previs/SpatialPrevisTestPanel.test.tsx`
- Modify: `apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx`
- Modify: `apps/web/src/app/api/generate/seedance-previs/handler.ts`
- Modify: `apps/web/src/app/api/generate/seedance-previs/route.test.ts`

- [x] **Step 1: Write failing test-delivery and route tests**

```ts
test('builds a 10 second internal test from asset references without exposing a provider selector', () => {
  const testTake = createSpatialPrevisTestTake(state, 10)
  const request = buildSpatialPrevisTestRequest(testTake, 'canvas-test-1', 10)
  assert.equal(testTake.masterTake.durationSec, 10)
  assert.equal(request.testDurationSec, 10)
  assert.equal(request.imageUrl, 'https://cdn.example/street.jpg')
  assert.deepEqual(request.referenceVideos, ['https://cdn.example/walkthrough.mp4'])
})

test('rejects a duration outside the 5 or 10 second test choices', () => {
  assert.throws(() => buildSpatialPrevisTestRequest(state, 'canvas-test-1', 15), /INVALID_SPATIAL_PREVIS_TEST_DURATION/)
})

test('persists the supplied canvas node id and returns the generation job id', async () => {
  const response = await harness.post(request(body({ nodeId: 'spatial-test-node-1' })))
  assert.equal((await response.json()).generationJobId, 'generation-job-1')
  assert.equal(harness.createdJob?.nodeId, 'spatial-test-node-1')
})
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/test-delivery.test.ts src/components/create/spatial-previs/SpatialPrevisTestPanel.test.tsx src/app/api/generate/seedance-previs/route.test.ts`

Expected: FAIL because there is no internal test contract/panel and the delivery route does not associate the GenerationJob with a supplied canvas node.

- [x] **Step 3: Implement a narrow internal-test contract and route association**

```ts
export const SPATIAL_PREVIS_TEST_DURATIONS = [5, 10] as const

function testSampleTimes(durationSec: number) {
  return [0, durationSec / 2, durationSec]
}

function sampledCameraTrack(track: CameraTrack, durationSec: number): CameraTrack {
  return {
    ...track,
    keyframes: testSampleTimes(durationSec).map((timeSec) => ({
      ...sampleCamera(track.keyframes, timeSec),
      id: `${track.id}@test-${timeSec}`,
      timeSec,
    })),
  }
}

function sampledActorTrack(track: ActorTrack, durationSec: number): ActorTrack {
  return {
    ...track,
    keyframes: testSampleTimes(durationSec).map((timeSec) => ({
      ...sampleActor(track, timeSec),
      id: `${track.id}@test-${timeSec}`,
      timeSec,
    })),
  }
}

export function createSpatialPrevisTestTake(
  state: SpatialPrevisState,
  durationSec: 5 | 10,
): SpatialPrevisState {
  if (!SPATIAL_PREVIS_TEST_DURATIONS.includes(durationSec)) throw new TypeError('INVALID_SPATIAL_PREVIS_TEST_DURATION')
  if (durationSec > state.masterTake.durationSec) throw new TypeError('SPATIAL_PREVIS_TEST_EXCEEDS_MASTER_TAKE')
  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      id: `${state.masterTake.id}@test-${durationSec}`,
      durationSec,
      cameraTrack: sampledCameraTrack(state.masterTake.cameraTrack, durationSec),
      actorTracks: state.masterTake.actorTracks.map((track) => sampledActorTrack(track, durationSec)),
      beats: [{ id: 'test-take', label: '预演测试', startSec: 0, endSec: durationSec }],
    },
  }
}

export function buildSpatialPrevisTestRequest(
  state: SpatialPrevisState,
  nodeId: string,
  durationSec: 5 | 10,
) {
  if (!SPATIAL_PREVIS_TEST_DURATIONS.includes(durationSec)) throw new TypeError('INVALID_SPATIAL_PREVIS_TEST_DURATION')
  const references = state.scene.references
  return {
    nodeId,
    testDurationSec: durationSec,
    imageUrl: references.find((item) => item.mediaType === 'image')?.url,
    referenceImages: references.filter((item) => item.mediaType === 'image').map((item) => item.url),
    referenceVideos: references.filter((item) => item.mediaType === 'video').map((item) => item.url),
  }
}
```

`SpatialPrevisTestPanel` contains only the `5 秒` / `10 秒` segmented selection, an internal `运行预演测试` command, a concise non-blocking coverage warning, and submitted/failed state. It must not render `Seedance`, a model name, entitlement, or provider selection.

Extend `DeliveryBody` with optional `nodeId` and `testDurationSec`, validate both, and use `nodeId` in `createGenerationJob` instead of `masterTakeId` when present. After loading the owned persisted draft, call `createSpatialPrevisTestTake(previs, testDurationSec)` for an internal test and use that isolated take for capability advice, package construction, delivery metadata, and dispatch; never overwrite the creator's full master take. Include `generationJobId` and `testDurationSec` in the success response. Keep server-side model resolution and feature flags unchanged; the client submits the existing controlled model key internally, not as a user-visible choice.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/test-delivery.test.ts src/components/create/spatial-previs/SpatialPrevisTestPanel.test.tsx src/app/api/generate/seedance-previs/route.test.ts`

Expected: PASS with only 5/10 durations, reference derivation, server-side job/node linkage, and no provider selector in panel markup.

TDD evidence: the isolated test delivery and route contract was driven red before implementation. Final route regressions are green at 13/13, including rejected durations, node ownership, duplicate claim, and conflict recovery.

- [ ] **Step 5: Commit the internal test surface**

```bash
git add apps/web/src/lib/spatial-previs/test-delivery.ts apps/web/src/lib/spatial-previs/test-delivery.test.ts apps/web/src/components/create/spatial-previs/SpatialPrevisTestPanel.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisTestPanel.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx apps/web/src/app/api/generate/seedance-previs/handler.ts apps/web/src/app/api/generate/seedance-previs/route.test.ts
git commit -m "feat: run internal spatial previs tests"
```

### Task 7: Materialize and reconcile the canvas video result node

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts`
- Modify: `apps/web/src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx`

- [x] **Step 1: Write failing workspace integration tests**

```ts
test('creates and persists a running video node before posting a spatial test request', async () => {
  await runSpatialPrevisTest(fixture, 5)
  assert.equal(harness.createdNode.kind, 'video')
  assert.equal(harness.createdNode.status, 'running')
  assert.equal(harness.savedNodeIds.includes(harness.createdNode.id), true)
  assert.equal(harness.requestBody.nodeId, harness.createdNode.id)
})

test('marks the same node complete when the normal video status endpoint returns media', async () => {
  await reconcileSpatialPrevisTestNode('spatial-test-node-1', 'generation-job-1')
  assert.equal(harness.node.resultVideoUrl, 'https://cdn.example/previs.mp4')
  assert.equal(harness.node.status, 'done')
  assert.equal(harness.node.assetId, 'asset-previs-1')
})
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx`

Expected: FAIL because the existing flow creates only a text delivery-package node and has no short-test node lifecycle.

- [x] **Step 3: Implement one isolated test-node lifecycle in the existing workspace**

Create the video node first with a stable `nodeId`, `status: 'running'`, `model: 'volcengine-seedance-video'`, and metadata that includes the immutable delivery package, selected duration, source asset ids, and a `spatialPrevisTest: true` marker. Immediately save this canvas snapshot through the existing spatial-previs save path before dispatching so the server-side job can write its result back to the same node.

```ts
const node = createNode('video', {
  nodeId: `spatial-previs-test-${crypto.randomUUID()}`,
  title: `三维预演测试 · ${durationSec} 秒`,
  prompt: '空间预演内部测试',
  model: 'volcengine-seedance-video',
  status: 'running',
  metadataJson: { spatialPrevisTest: true, durationSec, previsDelivery: buildPrevisDeliveryPackage(previs) },
})
const saveResult = await handleSaveSpatialPrevis(previs)
if (saveResult !== 'success') throw new Error('预演尚未保存，未提交测试。')
```

POST the already-existing `/api/generate/seedance-previs` route with fixed direct mode and the `nodeId`, `testDurationSec`, and derived reference inputs. Store the returned `generationJobId` in node metadata. Poll only that job via the existing `/api/generate/video/status` path while the panel is open; apply the normal `resultVideoUrl`, preview, status, and asset id to the same node. If the panel closes or polling reaches its bounded limit, leave the node `running` with its job id so the normal node refresh/status behavior can complete it later. On failure, patch only that node to error and leave the spatial draft editable.

Keep `handleCreateSpatialPrevisDeliveryNode`, JSON download, and save-package-to-library behavior unchanged. The new video node is additive and its normal asset persistence enables download and library use through existing canvas behavior.

- [x] **Step 4: Run the focused tests to verify they pass**

Run: `cd apps/web && node_modules/.bin/tsx --test src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx`

Expected: PASS with node-before-dispatch ordering, retained retry state, and ordinary result/asset materialization.

TDD evidence: the initial lifecycle assertions were red before the implementation, and later stale-poller plus bounded-timeout regressions were added red-first. Final workspace lifecycle tests are green at 11/11.

- [ ] **Step 5: Commit the test-node lifecycle**

```bash
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/VisualCanvasWorkspace.spatial-previs-persistence.test.ts apps/web/src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx
git commit -m "feat: materialize spatial previs test nodes"
```

### Task 8: Verify the full locked experience in browser and regression suites

**Files:**
- Modify only if a failing test exposes a defect in Tasks 1-7.
- Test: `apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx`
- Test: `apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx`
- Test: `apps/web/src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx`
- Test: `scripts/verify-confirmed-experience-locks.mjs`

- [x] **Step 1: Run all focused spatial unit/component/route tests**

Run: `cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/*.test.ts src/components/create/spatial-previs/*.test.tsx src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx src/app/api/generate/seedance-previs/route.test.ts`

Expected: PASS.

- [x] **Step 2: Run type-check, locked-experience verification, and production build**

Run: `pnpm --filter web exec tsc --noEmit`

Expected: PASS.

Run: `node scripts/verify-confirmed-experience-locks.mjs`

Expected: all confirmed-experience locks PASS.

Run: `pnpm --filter web build`

Expected: successful production build; record any pre-existing lint warnings separately.

- [ ] **Step 3: Perform browser acceptance on desktop and mobile**

Use Playwright against the local app with a real authenticated test session. Verify:

1. The asset library opens first; one image, a multi-angle group, and a video reference retain provenance.
2. The overview has nonblank 3D floor/walls/opening/furniture/props, a solid character, and a solid camera rig/frustum; the live viewport is a second nonblank render of the same world.
3. Dragging actor, camera, target, and selected whitebox solid updates the same scene state without dragging the surrounding canvas.
4. Each of `推`, `拉`, `摇`, `移`, `跟`, `升`, `降` changes camera position/target and immediately changes the frustum/live image.
5. The test panel offers only 5 and 10 seconds, never shows a model picker, creates a running result node before dispatch, and keeps a failed test editable/retryable.
6. Confirmed canvas/dialog/resize/navigation/context-menu behavior is unchanged.

Capture desktop and mobile screenshots and include their paths in the final QA report. Do not claim provider-media completion unless the actual job status has returned a persisted video URL and asset id.

Verification evidence on 2026-09-11: 188/188 focused spatial tests passed; type-check passed; all 7 confirmed experience locks and 14 lock-verifier tests passed; `git diff --check` passed; production build passed. Browser plugin connection was unavailable and this isolated worktree has no `DATABASE_URL`, so Step 3 remains intentionally open for authenticated browser acceptance with a real project and assets. The component suite did execute nonblank desktop/mobile WebGL rendering plus actor, camera, target, and whitebox pointer drags.

- [x] **Step 4: Preserve verification scope**

If every check passes, create no extra verification commit. If a check exposes a defect, return to the owning task, add its focused regression test first, and commit the repair using that task's exact file list and commit message. Do not commit generated build files, `apps/web/tsconfig.tsbuildinfo`, or pre-existing `.superpowers/` content.

## Plan Self-Review

- Spec coverage: Tasks 1-4 cover asset provenance, library/upload inputs, constructed editable solids, real 3D actor/camera/frustum, and direct manipulation. Task 5 covers all seven camera-language controls. Tasks 6-7 cover a provider-neutral 5-10 second test, result node, download/library route, warning-only failures, and project-owned persistence. Task 8 covers the requested desktop/mobile browser acceptance plus locked-experience regression checks.
- Placeholder scan: no unresolved implementation markers; every code task names files, a failing test, a command, an implementation shape, a passing command, and a commit.
- Consistency: all tasks use the v3 `SpatialPrevisState`, existing `createNode`/`handleSaveSpatialPrevis`/video-status lifecycle, and only the existing Seedance server route behind a non-provider-facing UI.
