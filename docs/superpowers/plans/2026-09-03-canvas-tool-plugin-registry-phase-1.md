# Canvas Tool Plugin Registry Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Move Camera Control and Lighting & Atmosphere prompt contribution behind a local, typed tool-plugin registry while preserving current node-local settings, UI behavior, generated prompt output, persistence, and generation ownership.

**Architecture:** A pure TypeScript registry owns the ordered Camera and Lighting prompt contributions. `VisualCanvasWorkspace` continues to read the existing node-local settings and continues to own generation, persistence, and UI state; at its two existing generation prompt assembly sites it delegates the final composition to the registry. The existing panel state and storage helpers remain unchanged in Phase 1.

**Tech Stack:** TypeScript, React/Next.js, Node test runner via `tsx --test`, existing Canvas storage and prompt-context helpers.

**Scope:** Phase 1 only covers Camera Control and Lighting & Atmosphere. It does not change API routes, generation dispatch, Provider/BYOK behavior, payment/credits, database/schema/env configuration, storage, draft recovery, or Canvas panel state ownership.

---

### Task 1: Add a pure Camera and Lighting plugin registry

**Files:**
- Create: `apps/web/src/lib/canvas/tool-plugin-registry.ts`
- Create: `apps/web/src/lib/canvas/tool-plugin-registry.test.ts`

**Step 1: Write the failing registry tests**

Add tests that import the future registry exports and assert:

- `CAMERA_LIGHTING_TOOL_PLUGINS` registers `camera-control` before `scene-lighting`.
- `composeRegisteredToolPrompt` produces exactly the current legacy prompt result for an image node with non-default Camera and Lighting settings.
- The same exact result is produced for a video node.
- A text node and default/empty settings add no Camera or Lighting prompt context.
- `resolveRegisteredToolContributions` exposes only non-empty contributions, in registry order, with the current summary helper output.

Use representative settings:

```ts
const camera = {
  cameraBody: 'sony-venice-2',
  lens: '35mm',
  aperture: '',
  focus: '',
};

const lighting = {
  lightingSetup: 'Backlight',
  timeOfDay: '',
  colorTemperature: '',
  atmosphere: '',
};
```

Calculate each expected prompt with the existing `build*PromptContext` and `append*ContextToPrompt` helpers. Do not duplicate their string literals in the test.

**Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/tool-plugin-registry.test.ts
```

Expected: failure because `tool-plugin-registry.ts` does not exist yet.

**Step 3: Implement the minimal typed registry**

Create `tool-plugin-registry.ts` with:

- `CanvasToolPluginNodeKind = 'image' | 'video' | 'text'`.
- `RegisteredToolContribution` carrying `id`, `promptContext`, and `summary`.
- `RegisteredToolContext` carrying `nodeKind`, `camera`, and `lighting` settings.
- A narrow `CanvasToolPlugin` interface with `id`, `label`, `labelZh`, `supportedNodeKinds`, and `contribute(context)`.
- `CAMERA_LIGHTING_TOOL_PLUGINS`, in the fixed order Camera then Lighting.
- `resolveRegisteredToolContributions(context)`, which invokes each plugin once, discards empty results, and preserves registration order.
- `composeRegisteredToolPrompt(basePrompt, context)`, which appends contribution prompt contexts in registration order.

The Camera plugin must use only the existing helpers from `cameraPromptContext.ts`; the Lighting plugin must use only the existing helpers from `sceneLightingPromptContext.ts`. A text node must not contribute either context. The registry must contain no React, browser storage, network, generation, payment, or persistence imports.

**Step 4: Run the tests to verify they pass**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/tool-plugin-registry.test.ts
```

Expected: all registry tests pass.

**Step 5: Commit the focused registry addition**

```bash
git add apps/web/src/lib/canvas/tool-plugin-registry.ts apps/web/src/lib/canvas/tool-plugin-registry.test.ts
git commit -m "feat: add canvas tool plugin registry"
```

### Task 2: Route the two generation prompt assembly paths through the registry

**Files:**
- Create: `apps/web/src/components/create/canvas/toolPluginRegistryBoundary.test.ts`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`

**Step 1: Write the failing static boundary test**

Add a source-level test that reads `VisualCanvasWorkspace.tsx` and asserts:

- `composeRegisteredToolPrompt(` occurs exactly twice: once in `handleRegenerateNodeFromPrompt` and once in the normal generation handler.
- The legacy local Camera context declarations at those sites are absent:
  - `const cameraCtx = buildCameraPromptContext(nodeCameraCtx)`
  - `const cameraContext = buildCameraPromptContext(nodeCamera)`
- The legacy local Lighting declarations at those sites are absent:
  - `const lightingCtx = buildSceneLightingPromptContext(nodeLightingCtx)`
  - `const lightingContext = buildSceneLightingPromptContext(nodeLighting)`

Do not assert that direct imports of the existing helpers disappear: they remain valid for summaries, callbacks, and existing UI behavior.

**Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/toolPluginRegistryBoundary.test.ts
```

Expected: it fails because the workspace does not yet call the registry.

**Step 3: Implement the two minimal workspace integrations**

In `VisualCanvasWorkspace.tsx`:

1. Import `composeRegisteredToolPrompt` from the new registry.
2. In `handleRegenerateNodeFromPrompt`, retain the current reads of `nodeCameraCtx` and `nodeLightingCtx`, retain the Bible composition, then replace the direct Camera/Lighting append chain with:

```ts
const promptWithBible = appendBibleContextToPrompt(rawPrompt, bibleCtx) || rawPrompt;
const prompt = composeRegisteredToolPrompt(promptWithBible, {
  nodeKind: node.kind,
  camera: nodeCameraCtx,
  lighting: nodeLightingCtx,
});
```

3. In the normal generation handler, retain the current node-local reads of `nodeCamera` and `nodeLighting`, retain Bible composition, then compose the final prompt through the registry using `nodeSnapshot.kind`.

Do not alter panel callbacks, `createNode`, `scheduleCanvasSave`, `loadCameraSettingsForNode`, `loadSceneLightingForNode`, source-lock behavior, API payload shape, or any save/generation code outside these two prompt compositions.

**Step 4: Run the boundary test to verify it passes**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test src/components/create/canvas/toolPluginRegistryBoundary.test.ts
```

Expected: the two registry call sites and removal of the four local context declarations are confirmed.

**Step 5: Commit the integration**

```bash
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/canvas/toolPluginRegistryBoundary.test.ts
git commit -m "refactor: compose canvas tool prompts via registry"
```

### Task 3: Lock compatibility and Canvas save boundaries with targeted tests

**Files:**
- Modify: `apps/web/src/lib/canvas/tool-plugin-registry.test.ts`

**Step 1: Add compatibility and non-mutation coverage**

Add tests that assert:

- `resolveRegisteredToolContributions` emits the expected ordered summaries (`sony-venice-2 · 35mm`, then `Backlight`) for representative settings.
- Passing frozen or cloned settings does not mutate Camera or Lighting values.
- Removing either contribution produces the same legacy behavior as the corresponding existing helper alone.

**Step 2: Run the focused Canvas suite**

Run:

```bash
cd apps/web && node_modules/.bin/tsx --test \
  src/lib/canvas/tool-plugin-registry.test.ts \
  src/components/create/canvas/toolPluginRegistryBoundary.test.ts \
  src/lib/canvas/canvasIncrementalSave.test.ts \
  src/lib/canvas/canvasDraftRecovery.test.ts \
  src/components/create/canvas/canvasSaveScheduling.test.ts
```

Expected: all tests pass. If a pre-existing unrelated test fails, record it separately and do not mask it.

**Step 3: Commit test hardening**

```bash
git add apps/web/src/lib/canvas/tool-plugin-registry.test.ts
git commit -m "test: cover canvas tool plugin registry compatibility"
```

### Task 4: Run repository gates and safe-write browser QA

**Files:**
- Modify: none unless a test-revealed Phase 1 defect requires a narrowly scoped correction.

**Step 1: Run required static and build gates**

Run:

```bash
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check
git diff --check
```

Expected: all commands pass and `git diff --check` is clean.

**Step 2: Perform authenticated Preview safe-write QA**

Use a disposable QA project and only local tool interactions:

- Create or select one image node and one video node.
- Open Camera Control and set a non-default preset on the image node; save it.
- Open Lighting & Atmosphere and set a non-default lighting setup on the video node; save it.
- Reopen each panel and verify each node retains only its own settings.
- Create a derived Camera and Lighting node only through the existing panel action; verify source identity and source edge labels remain intact.
- Manually save, reload from server, then refresh once and verify node-local settings, derived nodes, and source labels persist.
- Do not click Generate; confirm no `/api/generate/*`, Provider, billing, payment, wallet, or credits mutations are triggered.

Classify failures precisely as product bug, product API 5xx, product UI error, auth blocker, environment blocker, or QA harness limitation.

**Step 3: Prepare, but do not push without explicit Founder confirmation**

Record the implementation commit SHA and Preview QA result. Do not push `main` until the Founder explicitly authorizes it.

### Task 5: Document only a verified closeout

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

**Step 1: Update status only after all gates and safe-write QA pass**

Record the verified Phase 1 registry result, its Camera/Lighting-only scope, the exact test and browser QA boundaries, and any remaining follow-up for later tools.

**Step 2: Validate and commit the documentation closeout**

Run:

```bash
git diff --check
git diff --stat
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close canvas tool plugin registry phase 1"
```

**Step 3: Push documentation only with explicit Founder confirmation**

Push the verified commits, wait for the Vercel deployment, and run production read-only QA. Do not start the next registry migration automatically.

---

## Final Verification Checklist

- [ ] Camera and Lighting remain a Camera-then-Lighting ordered contribution pair.
- [ ] Image/video prompt output remains byte-for-byte compatible with the existing helper composition.
- [ ] Text nodes receive neither contribution.
- [ ] The workspace uses the registry in exactly the two existing generation composition paths.
- [ ] Node-local settings, panel controls, derived-node actions, source edges, save scheduling, and recovery remain unchanged.
- [ ] No API, Provider/BYOK, generation-route, payment, schema, environment, executor, or production database boundary is touched.
- [ ] Targeted tests, type-check, lint, build, agent check, and diff check pass.
- [ ] Preview safe-write QA passes without a real generation request or external billing mutation.
- [ ] No push, deploy, or next task begins without explicit Founder authorization.
