# Canvas Tool Plugin Registry Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put existing node-scoped Camera Control and Lighting & Atmosphere state behind a typed plugin-state adapter without changing Canvas core behavior.

**Architecture:** The adapter delegates localStorage mechanics to `nodeDirectorContextStorage.ts` and returns one typed Camera/Lighting state object. `VisualCanvasWorkspace.tsx` retains its panel state, but replaces direct storage calls in selection, editing, generation, and derived-node flows with the adapter.

**Tech Stack:** TypeScript, React, existing localStorage helpers, `tsx` Node tests, Next.js quality gates.

---

## File Structure

- Create: `apps/web/src/lib/canvas/tool-plugin-state.ts` - typed state adapter.
- Create: `apps/web/src/lib/canvas/tool-plugin-state.test.ts` - pure adapter contracts.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` - direct storage call-site migration only.
- Modify: `apps/web/src/components/create/canvas/toolPluginRegistryBoundary.test.ts` - static ownership boundary.
- Modify after verified QA only: `docs/CURRENT_STATUS.md`, `docs/NEXT_TASKS.md`.

### Task 1: Record RED state-adapter contracts

**Files:**
- Create: `apps/web/src/lib/canvas/tool-plugin-state.test.ts`

- [ ] **Step 1: Write the failing adapter test.**

```ts
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  copyRegisteredToolState,
  getDefaultRegisteredToolState,
  loadRegisteredToolState,
  saveRegisteredToolStateValue,
} from './tool-plugin-state'

const projectId = 'project-phase-2'
const sourceNodeId = 'node-source'
const childNodeId = 'node-child'

function installStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } },
  })
  return values
}

afterEach(() => { delete (globalThis as { window?: unknown }).window })

describe('tool plugin state', () => {
  test('returns defaults without an identity', () => {
    assert.deepEqual(loadRegisteredToolState(null, null), getDefaultRegisteredToolState())
  })

  test('keeps Camera and Lighting independently stored for one node', () => {
    installStorage()
    saveRegisteredToolStateValue(projectId, sourceNodeId, 'scene-lighting', { lightingSetup: 'Backlight', timeWeather: '', atmosphere: '', colorMood: '' })
    saveRegisteredToolStateValue(projectId, sourceNodeId, 'camera-control', { cameraBody: 'sony-venice-2', lens: '35mm', aperture: '', focus: '' })
    const state = loadRegisteredToolState(projectId, sourceNodeId)
    assert.equal(state.camera.lens, '35mm')
    assert.equal(state.lighting.lightingSetup, 'Backlight')
  })

  test('copies only the requested plugin to a child node', () => {
    installStorage()
    saveRegisteredToolStateValue(projectId, sourceNodeId, 'camera-control', { cameraBody: '', lens: '85mm', aperture: '', focus: '' })
    saveRegisteredToolStateValue(projectId, sourceNodeId, 'scene-lighting', { lightingSetup: 'Low Key', timeWeather: '', atmosphere: '', colorMood: '' })
    copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'camera-control')
    assert.equal(loadRegisteredToolState(projectId, childNodeId).camera.lens, '85mm')
    assert.deepEqual(loadRegisteredToolState(projectId, childNodeId).lighting, getDefaultRegisteredToolState().lighting)
    assert.equal(loadRegisteredToolState(projectId, sourceNodeId).lighting.lightingSetup, 'Low Key')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails.**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test src/lib/canvas/tool-plugin-state.test.ts
```

Expected: FAIL because `tool-plugin-state.ts` does not exist.

- [ ] **Step 3: Add legacy fallback and malformed storage assertions.**

```ts
import { getNodeCameraSettingsKey } from './nodeDirectorContextStorage'

test('preserves lazy legacy fallback and defaults malformed values', () => {
  const values = installStorage()
  values.set(`creator-city:camera-settings:\${projectId}`, JSON.stringify({ cameraBody: '', lens: '50mm', aperture: '', focus: '' }))
  assert.equal(loadRegisteredToolState(projectId, sourceNodeId).camera.lens, '50mm')
  assert.equal(values.get(getNodeCameraSettingsKey(projectId, sourceNodeId))?.includes('50mm'), true)
  values.set(getNodeCameraSettingsKey(projectId, childNodeId), '{broken')
  assert.deepEqual(loadRegisteredToolState(projectId, childNodeId).camera, getDefaultRegisteredToolState().camera)
})
```

- [ ] **Step 4: Commit the RED evidence.**

```bash
cd /Users/aaron/creator-city
git add apps/web/src/lib/canvas/tool-plugin-state.test.ts
git commit -m "test: define tool plugin state contracts"
```

### Task 2: Implement the typed adapter

**Files:**
- Create: `apps/web/src/lib/canvas/tool-plugin-state.ts`
- Test: `apps/web/src/lib/canvas/tool-plugin-state.test.ts`

- [ ] **Step 1: Implement types, defaults, and delegated reads.**

```ts
import type { CameraSettings } from './cameraPromptContext'
import { DEFAULT_CAMERA_SETTINGS } from './cameraPromptContext'
import type { SceneLightingSettings } from './sceneLightingPromptContext'
import { DEFAULT_SCENE_LIGHTING } from './sceneLightingPromptContext'
import {
  loadCameraSettingsForNode,
  loadSceneLightingForNode,
  saveCameraSettingsForNode,
  saveSceneLightingForNode,
} from './nodeDirectorContextStorage'

export type RegisteredToolStatePluginId = 'camera-control' | 'scene-lighting'
export interface RegisteredToolPluginState { camera: CameraSettings; lighting: SceneLightingSettings }
export interface RegisteredToolStateValueById {
  'camera-control': CameraSettings
  'scene-lighting': SceneLightingSettings
}

export function getDefaultRegisteredToolState(): RegisteredToolPluginState {
  return { camera: { ...DEFAULT_CAMERA_SETTINGS }, lighting: { ...DEFAULT_SCENE_LIGHTING } }
}

export function loadRegisteredToolState(
  projectId: string | null | undefined,
  nodeId: string | null | undefined,
): RegisteredToolPluginState {
  if (!projectId || !nodeId) return getDefaultRegisteredToolState()
  return {
    camera: loadCameraSettingsForNode(projectId, nodeId),
    lighting: loadSceneLightingForNode(projectId, nodeId),
  }
}
```

- [ ] **Step 2: Implement scoped writes and copy.**

```ts
export function saveRegisteredToolStateValue<TId extends RegisteredToolStatePluginId>(
  projectId: string | null | undefined,
  nodeId: string | null | undefined,
  pluginId: TId,
  value: RegisteredToolStateValueById[TId],
): void {
  if (!projectId || !nodeId) return
  if (pluginId === 'camera-control') {
    saveCameraSettingsForNode(projectId, nodeId, value as CameraSettings)
    return
  }
  saveSceneLightingForNode(projectId, nodeId, value as SceneLightingSettings)
}

export function copyRegisteredToolState(
  projectId: string | null | undefined,
  sourceNodeId: string | null | undefined,
  targetNodeId: string | null | undefined,
  pluginId: RegisteredToolStatePluginId,
): void {
  if (!projectId || !sourceNodeId || !targetNodeId) return
  const source = loadRegisteredToolState(projectId, sourceNodeId)
  saveRegisteredToolStateValue(
    projectId,
    targetNodeId,
    pluginId,
    pluginId === 'camera-control' ? source.camera : source.lighting,
  )
}
```

- [ ] **Step 3: Run the adapter suite and confirm it passes.**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test src/lib/canvas/tool-plugin-state.test.ts
```

Expected: PASS for default, isolation, scoped-copy, legacy, and malformed-storage cases.

- [ ] **Step 4: Commit the adapter.**

```bash
cd /Users/aaron/creator-city
git add apps/web/src/lib/canvas/tool-plugin-state.ts apps/web/src/lib/canvas/tool-plugin-state.test.ts
git commit -m "feat: add canvas tool plugin state adapter"
```

### Task 3: Migrate Workspace state access

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `apps/web/src/components/create/canvas/toolPluginRegistryBoundary.test.ts`

- [ ] **Step 1: Add a failing static boundary test.**

```ts
test('keeps Camera and Lighting node state behind the plugin-state adapter', () => {
  assert.match(visualCanvasWorkspaceSource, /from '@\\/lib\\/canvas\\/tool-plugin-state'/)
  assert.doesNotMatch(visualCanvasWorkspaceSource, /from '@\\/lib\\/canvas\\/nodeDirectorContextStorage'/)
  assert.equal(visualCanvasWorkspaceSource.match(/loadRegisteredToolState\\(/g)?.length, 4)
  assert.equal(visualCanvasWorkspaceSource.match(/saveRegisteredToolStateValue\\(/g)?.length, 2)
  assert.equal(visualCanvasWorkspaceSource.match(/copyRegisteredToolState\\(/g)?.length, 2)
})
```

- [ ] **Step 2: Confirm the static test is RED.**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test src/components/create/canvas/toolPluginRegistryBoundary.test.ts
```

Expected: FAIL because direct storage imports and call sites still exist.

- [ ] **Step 3: Replace direct storage import and initial project reads.**

```ts
import {
  copyRegisteredToolState,
  getDefaultRegisteredToolState,
  loadRegisteredToolState,
  saveRegisteredToolStateValue,
} from '@/lib/canvas/tool-plugin-state'

const defaults = getDefaultRegisteredToolState()
setCameraSettings(defaults.camera)
setSceneLightingSettings(defaults.lighting)
```

Remove only Camera/Lighting project-key helpers and direct storage import. Do not modify Canvas load, draft recovery, node graph, or save behavior.

- [ ] **Step 4: Route selection, panel saves, generation reads, and derived copies.**

```ts
const toolState = loadRegisteredToolState(projectId, activeNode.id)
setCameraSettings(toolState.camera)
setSceneLightingSettings(toolState.lighting)

saveRegisteredToolStateValue(projectId, targetId, 'camera-control', next)
saveRegisteredToolStateValue(projectId, targetId, 'scene-lighting', next)

const toolState = loadRegisteredToolState(projectId, node.id)
const prompt = composeRegisteredToolPrompt(promptWithBible, {
  nodeKind: node.kind,
  camera: toolState.camera,
  lighting: toolState.lighting,
})

copyRegisteredToolState(projectId, sourceNode.id, node.id, 'camera-control')
copyRegisteredToolState(projectId, sourceNode.id, node.id, 'scene-lighting')
```

Use the equivalent `nodeSnapshot.id` load and retain `normalizeCanvasToolPluginNodeKind(nodeSnapshot.kind)` in the normal generation path. Do not alter request construction, Canvas graph mutation, local snapshots, or cloud-save scheduling.

- [ ] **Step 5: Run focused tests and confirm GREEN.**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test \\
  src/lib/canvas/tool-plugin-state.test.ts \\
  src/lib/canvas/tool-plugin-registry.test.ts \\
  src/components/create/canvas/toolPluginRegistryBoundary.test.ts
```

Expected: PASS. The workspace has no direct node-storage import and both generation paths still use Phase 1 composition.

- [ ] **Step 6: Commit the migration.**

```bash
cd /Users/aaron/creator-city
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx \\
  apps/web/src/components/create/canvas/toolPluginRegistryBoundary.test.ts
git commit -m "refactor: route canvas tool state through registry"
```

### Task 4: Run regression and boundary checks

**Files:**
- Test: `apps/web/src/lib/canvas/tool-plugin-state.test.ts`
- Test: `apps/web/src/lib/canvas/tool-plugin-registry.test.ts`
- Test: `apps/web/src/components/create/canvas/toolPluginRegistryBoundary.test.ts`
- Test: `apps/web/src/lib/canvas/canvasIncrementalSave.test.ts`
- Test: `apps/web/src/lib/canvas/canvasDraftRecovery.test.ts`
- Test: `apps/web/src/components/create/canvas/canvasSaveScheduling.test.ts`

- [ ] **Step 1: Run the focused Canvas suite.**

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test \\
  src/lib/canvas/tool-plugin-state.test.ts \\
  src/lib/canvas/tool-plugin-registry.test.ts \\
  src/components/create/canvas/toolPluginRegistryBoundary.test.ts \\
  src/lib/canvas/canvasIncrementalSave.test.ts \\
  src/lib/canvas/canvasDraftRecovery.test.ts \\
  src/components/create/canvas/canvasSaveScheduling.test.ts
```

Expected: PASS. A new save or recovery failure is a stop condition; do not alter frozen Canvas core as a workaround.

- [ ] **Step 2: Run project gates and audit the diff.**

```bash
cd /Users/aaron/creator-city
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check
git diff --check
git diff HEAD~3..HEAD --name-only
```

Expected: PASS, with only known pre-existing lint warnings. No API route, schema, environment, Provider/BYOK, billing, payment, package, cn-executor, Canvas graph, save, or generation dispatch change.

### Task 5: Production safe-write QA

**Files:** No code changes.

- [ ] **Step 1: Protect the active QA project.**

Open the authenticated Golden Path Canvas project. If local-draft recovery appears, request explicit confirmation before choosing either recovery action.

- [ ] **Step 2: Validate node isolation without generation.**

1. Select an Image node, set a non-default Camera value, close/reopen, then verify a second node did not inherit it.
2. Select a Video node when available; otherwise record `QA_HARNESS_LIMITATION` and use an Image node for Lighting.
3. Set a non-default Lighting value, create the existing Lighting derived draft, and verify the child copied that setting while the source remained unchanged.
4. Save to cloud, wait for “已同步到云端”, reload, and verify the tested values persist.

Do not click Generate or Provider, payment, recharge, or billing controls. Classify browser-extension-only Console entries as tooling, not product errors. If exact request enumeration is unavailable, record `QA_HARNESS_LIMITATION`.

### Task 6: Closeout and delivery

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Record verified results only.**

Document commits, validation, observed Vercel status, actual QA actions, and any Video/network limitation. Close the task only if no product blocker exists.

- [ ] **Step 2: Validate and commit docs.**

```bash
cd /Users/aaron/creator-city
git diff --check
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close tool plugin registry phase 2"
```

- [ ] **Step 3: Request explicit push confirmation.**

Do not push implementation or docs until the Founder explicitly confirms. After confirmation, push `main`, verify remote SHA equals local `HEAD`, wait for Vercel Production Ready, and report only observed results.
