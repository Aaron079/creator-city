# P0-A Seedance Spatial Previs Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated, editable 3D director surface where a user can ground a scene, direct actors and a camera on one master timeline, and switch between continuous blocking and story beats without duplicate motion data.

**Architecture:** Create a provider-neutral spatial-previs domain beneath apps/web/src/lib and persist a versioned snapshot under CanvasWorkflow.metadataJson.spatialPrevis. A new additive canvas modal hosts an R3F viewport, local camera controls, and synchronized timeline views; it reads existing canvas assets but does not change node, prompt-dialog, resize, drag, or context-menu behaviour.

**Tech Stack:** Next.js 14, React 18, TypeScript, @react-three/fiber, @react-three/drei, Three.js, Tailwind, node:test, Playwright.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| apps/web/src/lib/spatial-previs/types.ts | Canonical scene, track, beat, camera, coverage, and preview types. |
| apps/web/src/lib/spatial-previs/normalize.ts | Pure validation, time ordering, beat-to-track mutation, and invariants. |
| apps/web/src/lib/spatial-previs/persistence.ts | Versioned workflow metadata parsing and serialization. |
| apps/web/src/lib/spatial-previs/coverage.ts | Exterior coverage and non-blocking authoring-risk findings. |
| apps/web/src/lib/spatial-previs/sampler.ts | Deterministic interpolation for actor/camera poses. |
| apps/web/src/lib/spatial-previs/*.test.ts | Focused node:test coverage for each pure contract. |
| apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx | 3D shared world, direct manipulation, actor/camera paths, live camera preview. |
| apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx | Local push/pull, pan/tilt, dolly, follow, and crane controls. |
| apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.tsx | Continuous and beat views over one MasterTake. |
| apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx | Additive director modal that composes the spatial surface. |
| apps/web/src/components/canvas/modal/canvasModalTypes.ts | New spatial-previs modal id. |
| apps/web/src/components/create/CanvasToolDock.tsx | One entry under the established Director Tools menu. |
| apps/web/src/components/create/VisualCanvasWorkspace.tsx | Existing workflow metadata load/save and modal mount. |
| apps/web/tests/e2e/spatial-previs-director.spec.ts | Browser acceptance coverage. |

### Task 1: Establish the canonical scene and master-take contract

**Files:**
- Create: apps/web/src/lib/spatial-previs/types.ts
- Create: apps/web/src/lib/spatial-previs/normalize.ts
- Test: apps/web/src/lib/spatial-previs/normalize.test.ts

- [ ] **Step 1: Write the failing domain test**

    import assert from 'node:assert/strict'
    import test from 'node:test'
    import { applyBeatPatch, normalizeSpatialPrevis } from './normalize'

    test('beat editing changes the shared camera track instead of creating a second track', () => {
      const previs = normalizeSpatialPrevis({ projectId: 'p1', durationSec: 45 })
      const next = applyBeatPatch(previs, 'beat-entry', {
        camera: { position: { x: 4, y: 2, z: 8 }, target: { x: 0, y: 1.6, z: 0 } },
      })

      assert.equal(next.masterTake.cameraTrack.keyframes.length, 3)
      assert.equal(next.masterTake.beats.length, 1)
      assert.deepEqual(next.masterTake.cameraTrack.keyframes[1]?.position, { x: 4, y: 2, z: 8 })
    })

    test('normalization constrains a single-image exterior to a camera corridor', () => {
      const previs = normalizeSpatialPrevis({
        projectId: 'p1',
        scene: { sourceMode: 'single-image-exterior' },
      })

      assert.equal(previs.scene.coverage.mode, 'constrained')
      assert.equal(previs.scene.coverage.cameraFreedom, 'corridor-only')
    })

- [ ] **Step 2: Run the test to verify it fails**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/normalize.test.ts

Expected: FAIL because normalize.ts does not exist.

- [ ] **Step 3: Define the minimal canonical types and normalizer**

    export type Vec3 = { x: number; y: number; z: number }
    export type CoverageMode = 'verified' | 'constrained' | 'unavailable'
    export type SpatialPrevisMode = 'continuous' | 'beats'

    export type CameraKeyframe = {
      id: string
      timeSec: number
      position: Vec3
      target: Vec3
      focalLengthMm: number
      intent: 'push' | 'pull' | 'pan-tilt' | 'dolly' | 'follow' | 'crane' | 'static'
    }

    export type MasterTake = {
      id: string
      durationSec: number
      aspectRatio: '16:9' | '9:16' | '1:1'
      actorTracks: Array<{ id: string; anchorId: string; keyframes: Array<{ id: string; timeSec: number; position: Vec3; action: string }> }>
      cameraTrack: { id: string; keyframes: CameraKeyframe[] }
      beats: Array<{ id: string; label: string; startSec: number; endSec: number }>
    }

    export type SpatialPrevisState = {
      version: 1
      projectId: string
      scene: {
        sourceMode: 'single-image-exterior' | 'multi-view' | 'video-scan' | 'manual'
        coverage: { mode: CoverageMode; cameraFreedom: 'full' | 'corridor-only' | 'disabled' }
      }
      masterTake: MasterTake
      editorMode: SpatialPrevisMode
      updatedAt: string
    }

Implement normalizeSpatialPrevis(input) to produce a 30-second take when no duration is supplied, clamp duration to 5..180, install keyframes at 0, duration / 2, and duration, and map single-image-exterior to constrained, corridor-only coverage. Implement applyBeatPatch(state, beatId, patch) by replacing the beat midpoint camera keyframe; it must never add a second camera track.

- [ ] **Step 4: Run the domain test to verify it passes**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/normalize.test.ts

Expected: PASS with two tests.

- [ ] **Step 5: Commit the domain contract**

    git add apps/web/src/lib/spatial-previs/types.ts apps/web/src/lib/spatial-previs/normalize.ts apps/web/src/lib/spatial-previs/normalize.test.ts
    git commit -m "feat: add spatial previs master take domain"

### Task 2: Make pose sampling and coverage warnings deterministic

**Files:**
- Create: apps/web/src/lib/spatial-previs/sampler.ts
- Create: apps/web/src/lib/spatial-previs/coverage.ts
- Test: apps/web/src/lib/spatial-previs/sampler.test.ts
- Test: apps/web/src/lib/spatial-previs/coverage.test.ts

- [ ] **Step 1: Write failing interpolation and advisory tests**

    import assert from 'node:assert/strict'
    import test from 'node:test'
    import { sampleCamera } from './sampler'
    import { assessAuthoringRisks } from './coverage'

    test('samples the camera between adjacent master keyframes', () => {
      const camera = sampleCamera([
        { id: 'a', timeSec: 0, position: { x: 0, y: 2, z: 8 }, target: { x: 0, y: 1, z: 0 }, focalLengthMm: 35, intent: 'static' },
        { id: 'b', timeSec: 10, position: { x: 10, y: 2, z: 8 }, target: { x: 2, y: 1, z: 0 }, focalLengthMm: 50, intent: 'dolly' },
      ], 5)
      assert.deepEqual(camera.position, { x: 5, y: 2, z: 8 })
      assert.equal(camera.focalLengthMm, 42.5)
    })

    test('warns but does not prevent camera travel outside a constrained exterior corridor', () => {
      const findings = assessAuthoringRisks({
        coverage: { mode: 'constrained', cameraFreedom: 'corridor-only' },
        cameraPositions: [{ x: 50, y: 4, z: 50 }],
      })
      assert.equal(findings[0]?.code, 'CAMERA_OUTSIDE_COVERAGE')
      assert.equal(findings[0]?.blocking, false)
    })

- [ ] **Step 2: Run the tests to verify they fail**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/sampler.test.ts src/lib/spatial-previs/coverage.test.ts

Expected: FAIL because sampler.ts and coverage.ts do not exist.

- [ ] **Step 3: Implement stable helpers**

    export function lerpVec3(a: Vec3, b: Vec3, amount: number): Vec3 {
      return {
        x: a.x + (b.x - a.x) * amount,
        y: a.y + (b.y - a.y) * amount,
        z: a.z + (b.z - a.z) * amount,
      }
    }

    export function sampleCamera(keyframes: CameraKeyframe[], timeSec: number): CameraKeyframe {
      const ordered = [...keyframes].sort((a, b) => a.timeSec - b.timeSec)
      const next = ordered.find((frame) => frame.timeSec >= timeSec) ?? ordered.at(-1)!
      const previous = [...ordered].reverse().find((frame) => frame.timeSec <= timeSec) ?? ordered[0]!
      const amount = previous === next ? 0 : (timeSec - previous.timeSec) / (next.timeSec - previous.timeSec)
      return {
        ...previous,
        timeSec,
        position: lerpVec3(previous.position, next.position, amount),
        target: lerpVec3(previous.target, next.target, amount),
        focalLengthMm: previous.focalLengthMm + (next.focalLengthMm - previous.focalLengthMm) * amount,
      }
    }

Implement assessAuthoringRisks with code, message, remedy, and blocking: false. Emit CAMERA_OUTSIDE_COVERAGE only for a constrained scene and a camera point outside its saved corridor bounds. Do not disable or alter the user's keyframe.

- [ ] **Step 4: Run the helpers tests to verify they pass**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/sampler.test.ts src/lib/spatial-previs/coverage.test.ts

Expected: PASS with three tests.

- [ ] **Step 5: Commit sampling and warnings**

    git add apps/web/src/lib/spatial-previs/sampler.ts apps/web/src/lib/spatial-previs/coverage.ts apps/web/src/lib/spatial-previs/sampler.test.ts apps/web/src/lib/spatial-previs/coverage.test.ts
    git commit -m "feat: add spatial previs sampling and coverage advice"

### Task 3: Persist one versioned snapshot through existing workflow metadata

**Files:**
- Create: apps/web/src/lib/spatial-previs/persistence.ts
- Test: apps/web/src/lib/spatial-previs/persistence.test.ts
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.tsx

- [ ] **Step 1: Write a failing metadata round-trip test**

    import assert from 'node:assert/strict'
    import test from 'node:test'
    import { parseSpatialPrevisMetadata, spatialPrevisMetadata } from './persistence'

    test('round-trips only the versioned spatialPrevis metadata namespace', () => {
      const state = {
        version: 1,
        projectId: 'p1',
        scene: { sourceMode: 'manual' },
        masterTake: { durationSec: 30 },
        editorMode: 'continuous',
        updatedAt: '2026-09-09T00:00:00.000Z',
      }
      const metadata = spatialPrevisMetadata({ existing: 'preserved' }, state)
      assert.equal(metadata.existing, 'preserved')
      assert.equal(parseSpatialPrevisMetadata(metadata)?.projectId, 'p1')
    })

- [ ] **Step 2: Run the metadata test to verify it fails**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/persistence.test.ts

Expected: FAIL because persistence.ts does not exist.

- [ ] **Step 3: Implement parsing and wire it into the existing save path**

    export function parseSpatialPrevisMetadata(metadata: unknown): SpatialPrevisState | null {
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
      const value = (metadata as Record<string, unknown>).spatialPrevis
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      return (value as { version?: unknown }).version === 1 ? normalizeSpatialPrevis(value) : null
    }

    export function spatialPrevisMetadata(existing: unknown, state: SpatialPrevisState): Record<string, unknown> {
      const safeExisting = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? existing as Record<string, unknown>
        : {}
      return { ...safeExisting, spatialPrevis: state }
    }

In VisualCanvasWorkspace.tsx, add local spatialPrevis state initialized from data.workflow.metadataJson beside cloudShotSequence. Add handleSaveSpatialPrevis(next) by copying the existing handleSaveSequenceToCloud pattern: getCanvasSnapshot(), buildCanvasEntitySavePayload(), submit its saveMode/nodes/edges/viewport/baseUpdatedAt and workflowMetadata.spatialPrevis to PUT /api/projects/projectId/canvas, then clear only revisions actually submitted. The Canvas API intentionally ignores a full save with zero nodes, so never send an empty full payload. Update spatialPrevis only after a successful response. Do not alter node or edge save state.

- [ ] **Step 4: Run the metadata test and type-check**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/persistence.test.ts && pnpm type-check

Expected: PASS and TypeScript exits 0.

- [ ] **Step 5: Commit persistence**

    git add apps/web/src/lib/spatial-previs/persistence.ts apps/web/src/lib/spatial-previs/persistence.test.ts apps/web/src/components/create/VisualCanvasWorkspace.tsx
    git commit -m "feat: persist spatial previs workflow state"

### Task 4: Build the true 3D world viewport and local camera controls

**Files:**
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx
- Create: apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx
- Test: apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

- [ ] **Step 1: Write the failing viewport render contract**

    test('renders a shared spatial stage with a live camera preview and local controls', () => {
      const html = renderToStaticMarkup(
        <SpatialPrevisViewport state={fixture} currentTimeSec={5} onChange={() => {}} />,
      )
      assert.match(html, /data-spatial-previs-viewport="true"/)
      assert.match(html, /data-spatial-camera-preview="true"/)
      assert.match(html, /推\/拉/)
      assert.match(html, /跟拍/)
    })

- [ ] **Step 2: Run the viewport test to verify it fails**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx

Expected: FAIL because the viewport component does not exist.

- [ ] **Step 3: Implement the smallest useful interactive scene**

    <div data-spatial-previs-viewport="true" className="grid min-h-[520px] grid-cols-[minmax(0,1fr)_260px] gap-3">
      <Canvas camera={{ position: [8, 6, 10], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <gridHelper args={[60, 60, '#334155', '#18222f']} />
        <ActorProxy track={state.masterTake.actorTracks[0]} timeSec={currentTimeSec} />
        <CameraRig frame={sampleCamera(state.masterTake.cameraTrack.keyframes, currentTimeSec)} onChange={onChange} />
        <OrbitControls makeDefault />
      </Canvas>
      <aside data-spatial-camera-preview="true">
        <CameraPreview />
        <SpatialCameraControlStrip onIntent={onChange} />
      </aside>
    </div>

The local strip exposes 推/拉, 摇/俯仰, 移, 跟拍, and 升/降. Each action edits the selected master camera keyframe through onChange. Attach TransformControls only to the selected actor proxy, camera rig, or camera target ring; on objectChange, convert the Three.js transform into the selected master keyframe and call onChange. It must not create a prompt, node, second camera track, or secondary navigation surface. Render selected actor proxies, named world anchors, and both actor/camera paths with Three.js lines.

- [ ] **Step 4: Run the viewport test and production type-check**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx && pnpm type-check

Expected: PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the viewport**

    git add apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.tsx apps/web/src/components/create/spatial-previs/SpatialCameraControlStrip.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
    git commit -m "feat: add interactive spatial previs viewport"

### Task 5: Add synchronized continuous and story-beat editing

**Files:**
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.tsx
- Create: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx
- Test: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx

- [ ] **Step 1: Write a failing dual-view test**

    test('switches views while retaining the same master take and current camera frame', () => {
      const html = renderToStaticMarkup(
        <SpatialPrevisDirectorPanel initialState={fixture} onSave={() => {}} onClose={() => {}} />,
      )
      assert.match(html, /连续走位/)
      assert.match(html, /剧情节拍/)
      assert.match(html, /data-master-take-id="take-1"/)
    })

- [ ] **Step 2: Run the panel test to verify it fails**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement the director panel**

    <DirectorToolPanelFrame
      title="三维预演"
      titleEn="SPATIAL PREVIS"
      icon="🎥"
      accentColor="indigo"
      primaryLabel="保存预演"
      onPrimary={() => onSave(state)}
      onClose={onClose}
    >
      <nav role="tablist" aria-label="预演编辑模式">
        <button onClick={() => setMode('continuous')}>连续走位</button>
        <button onClick={() => setMode('beats')}>剧情节拍</button>
      </nav>
      <SpatialPrevisViewport state={state} currentTimeSec={currentTimeSec} onChange={setState} />
      <SpatialPrevisTimeline
        mode={mode}
        masterTake={state.masterTake}
        currentTimeSec={currentTimeSec}
        onTimeChange={setCurrentTimeSec}
        onBeatPatch={applyBeatPatch}
      />
      <RiskList findings={assessAuthoringRisks(riskInput)} />
    </DirectorToolPanelFrame>

The continuous view shows the full master ruler and the same actor/camera tracks. The beat view shows editable beat intervals that call applyBeatPatch. It must read the same masterTake id and cannot own a separate actor/camera collection. The panel never mounts CanvasPromptBox.

- [ ] **Step 4: Run the panel test**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit the synchronized editor**

    git add apps/web/src/components/create/spatial-previs/SpatialPrevisTimeline.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx
    git commit -m "feat: add synchronized spatial previs timeline modes"

### Task 6: Mount the director tool additively and lock the boundary

**Files:**
- Modify: apps/web/src/components/canvas/modal/canvasModalTypes.ts
- Modify: apps/web/src/components/create/CanvasToolDock.tsx
- Modify: apps/web/src/components/create/CanvasToolDock.test.ts
- Modify: apps/web/src/components/create/VisualCanvasWorkspace.tsx
- Create: apps/web/src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx
- Create: apps/web/tests/e2e/spatial-previs-director.spec.ts

- [ ] **Step 1: Write failing menu and interaction-boundary tests**

    test('director menu exposes spatial previs as an additive tool', () => {
      assert.match(dockSource, /spatial-previs/)
      assert.match(workspaceSource, /Confirmed experience impact: none/)
    })

    test('spatial previs uses the modal coordinator and does not edit locked prompt surfaces', () => {
      assert.match(workspaceSource, /case 'spatial-previs':\s+setIsSpatialPrevisOpen\(true\)/)
      assert.doesNotMatch(workspaceSource, /CanvasPromptBox[^\n]*spatial-previs/)
    })

- [ ] **Step 2: Run the tests to verify they fail**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/CanvasToolDock.test.ts src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx

Expected: FAIL because the modal and dock entry do not exist.

- [ ] **Step 3: Add the modal id, director menu item, and workspace mount**

Add spatial-previs to CanvasModalId. Add 空间预演 below existing director tools and extend onOpenDirectorTool with the same literal. In VisualCanvasWorkspace.tsx add only this flow:

    // Confirmed experience impact: none
    case 'spatial-previs': setIsSpatialPrevisOpen(true); break

    {isSpatialPrevisOpen && saveStatus !== 'opening' && spatialPrevis ? (
      <SpatialPrevisDirectorPanel
        initialState={spatialPrevis}
        onSave={(next) => void handleSaveSpatialPrevis(next)}
        onClose={closeCanvasPanel}
      />
    ) : null}

Reset isSpatialPrevisOpen in resetCanvasModalStates. Do not modify CanvasPromptBox, CanvasNodeCard, existing node dragging, resize geometry, or context-menu handlers.

- [ ] **Step 4: Add browser acceptance coverage**

    test('opens spatial previs, moves a camera control, switches modes, and saves', async ({ page }) => {
      await page.goto('/canvas?projectId=e2e-spatial-previs')
      await page.getByRole('button', { name: '导演工具' }).click()
      await page.getByRole('button', { name: '空间预演' }).click()
      await expect(page.locator('[data-spatial-previs-viewport="true"]')).toBeVisible()
      await page.getByRole('button', { name: '跟拍' }).click()
      await page.getByRole('button', { name: '剧情节拍' }).click()
      await page.getByRole('button', { name: '保存预演' }).click()
      await expect(page.getByText('预演已保存')).toBeVisible()
    })

Stub the canvas workflow request so it asserts workflowMetadata.spatialPrevis.version === 1 without requiring a provider account.

- [ ] **Step 5: Run focused checks and confirmed-experience locks**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/CanvasToolDock.test.ts src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx && pnpm exec playwright test tests/e2e/spatial-previs-director.spec.ts

Expected: PASS.

Run: pnpm experience:check && pnpm test:experience-locks

Expected: both commands exit 0.

- [ ] **Step 6: Commit additive integration**

    git add apps/web/src/components/canvas/modal/canvasModalTypes.ts apps/web/src/components/create/CanvasToolDock.tsx apps/web/src/components/create/CanvasToolDock.test.ts apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx apps/web/tests/e2e/spatial-previs-director.spec.ts
    git commit -m "feat: open spatial previs from director tools"

### Task 7: Verify the foundation before provider work

**Files:**
- Modify: docs/superpowers/specs/2026-09-09-seedance-long-take-previs-design.md only if implementation uncovers a factual mismatch.

- [ ] **Step 1: Run the full P0-A test set**

Run:

    cd apps/web && node_modules/.bin/tsx --test \
      src/lib/spatial-previs/normalize.test.ts \
      src/lib/spatial-previs/sampler.test.ts \
      src/lib/spatial-previs/coverage.test.ts \
      src/lib/spatial-previs/persistence.test.ts \
      src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx \
      src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx \
      src/components/create/canvas/SpatialPrevisDirectorInteraction.test.tsx
    pnpm type-check

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 2: Perform the required visual acceptance pass**

Run the web app, create a manual exterior, move the actor and camera, click each local camera action, switch both timeline modes, save, reload, and confirm the same camera path and beat changes remain visible. Capture desktop and mobile screenshots in the Playwright report.

- [ ] **Step 3: Commit the verification record only if a design document was corrected**

    git add docs/superpowers/specs/2026-09-09-seedance-long-take-previs-design.md
    git commit -m "docs: align spatial previs foundation verification"

Skip this commit when the approved design remains accurate.

## Self-Review

- Spec coverage: Tasks 1-5 implement one shared world, actor/camera paths, coverage limits, local camera actions, and synchronized continuous/beat modes. Tasks 3 and 6 make it durable and additive. Task 7 requires visual acceptance before provider work.
- Intentional boundary: Seedance capability resolution, paid request construction, and returned-video comparison are separately planned so this foundation can be verified without provider cost.
- Lock coverage: Task 6 declares Confirmed experience impact: none and runs the existing confirmed-experience checks.
- Placeholder scan: no unresolved implementation, validation, or test instruction is deferred inside this plan.
- Type consistency: SpatialPrevisState.masterTake is the only timeline owner; beat edits call applyBeatPatch and camera preview calls sampleCamera.
