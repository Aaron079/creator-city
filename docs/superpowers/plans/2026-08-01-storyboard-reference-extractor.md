# Storyboard Reference Extractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-grid crop entry with an explicit freeform reference extractor that creates source-linked Assets and optional derived image nodes.

**Architecture:** Keep client-side Canvas 2D crop and the existing `/api/assets/upload` route. Introduce a versioned generic reference-extraction lineage parser that accepts legacy grid records unchanged, and use normalized freeform rectangles for new records. The Workspace remains the only owner of canvas-node creation and save scheduling.

**Tech Stack:** Next.js client components, React, TypeScript, Canvas 2D, existing Asset upload API, Node test runner via `tsx`.

---

## File Structure

- Create: `apps/web/src/lib/canvas/storyboardReferenceExtract.ts` — normalized rectangle validation, ordered extraction metadata, and deterministic placement hints.
- Create: `apps/web/src/lib/canvas/storyboardReferenceExtract.test.ts` — pure freeform geometry, lineage, and legacy compatibility tests.
- Create: `apps/web/src/lib/canvas/storyboardReferenceCrop.ts` — Canvas 2D crop/upload FormData builder for new extractor records.
- Create: `apps/web/src/components/create/StoryboardReferenceExtractorPanel.tsx` — node-scoped dialog with source preview, editable selections, explicit confirmation, upload state, and quality strip.
- Create: `apps/web/src/components/create/StoryboardReferenceExtractorPanel.test.tsx` — rendered interaction and no-implicit-upload tests.
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts` — replace the visible fixed-grid tool identity with `storyboard-reference-extractor`.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — open the new panel, persist its session, and create source-linked nodes through one Workspace callback.
- Modify: `apps/web/src/app/api/assets/upload/storyboard-grid-split-metadata.ts` — accept both legacy grid and new reference-extractor lineage while retaining the legacy export/parser.
- Modify: `apps/web/src/app/api/assets/upload/route.ts` — require project ownership for either crop lineage without changing ordinary upload behavior.
- Modify: `apps/web/src/lib/canvas/tool-result-quality.ts` and `.test.ts` — add reference-extraction quality evidence without removing historical grid quality coverage.
- Modify: `apps/web/src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts` and `project-validation.test.ts` — verify new allowlisted metadata and project binding.
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts` — assert the replacement entry is available only for image Assets.

### Task 1: Define freeform crop contracts

**Files:**
- Create: `apps/web/src/lib/canvas/storyboardReferenceExtract.test.ts`
- Create: `apps/web/src/lib/canvas/storyboardReferenceExtract.ts`

- [ ] **Step 1: Write failing geometry and metadata tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildReferenceExtractionMetadata,
  normalizeReferenceCropBox,
} from './storyboardReferenceExtract'

test('normalizes a freeform selection and rejects zero-area/out-of-bounds boxes', () => {
  assert.deepEqual(normalizeReferenceCropBox({ x: 120, y: 50, width: 400, height: 300 }, 1000, 800), {
    x: 0.12, y: 0.0625, width: 0.4, height: 0.375,
  })
  assert.equal(normalizeReferenceCropBox({ x: 0, y: 0, width: 0, height: 20 }, 100, 100), null)
  assert.equal(normalizeReferenceCropBox({ x: 90, y: 0, width: 20, height: 20 }, 100, 100), null)
})

test('metadata keeps stable source identity and the user-confirmed extraction order', () => {
  assert.deepEqual(buildReferenceExtractionMetadata({
    cropBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    sourceAssetId: 'asset-a', sourceNodeId: 'node-a', sessionId: 'session-a', index: 1,
  }), {
    version: 2, toolId: 'storyboard-reference-extractor', parentAssetId: 'asset-a',
    sourceAssetId: 'asset-a', sourceNodeId: 'node-a', extractionSessionId: 'session-a',
    index: 1, cropBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
  })
})
```

- [ ] **Step 2: Run the focused test to establish RED**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/storyboardReferenceExtract.test.ts`

Expected: FAIL because `storyboardReferenceExtract.ts` does not exist.

- [ ] **Step 3: Implement the contract**

```ts
export const STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID = 'storyboard-reference-extractor' as const
export type NormalizedReferenceCropBox = { x: number; y: number; width: number; height: number }
export type StoryboardReferenceExtractionMetadata = {
  version: 2
  toolId: typeof STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID
  parentAssetId: string
  sourceAssetId: string
  sourceNodeId: string
  extractionSessionId: string
  index: number
  cropBox: NormalizedReferenceCropBox
}

export function normalizeReferenceCropBox(box: { x: number; y: number; width: number; height: number }, imageWidth: number, imageHeight: number): NormalizedReferenceCropBox | null {
  if (![box.x, box.y, box.width, box.height, imageWidth, imageHeight].every(Number.isFinite)) return null
  if (imageWidth <= 0 || imageHeight <= 0 || box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0) return null
  if (box.x + box.width > imageWidth || box.y + box.height > imageHeight) return null
  const round = (value: number) => Number(value.toFixed(6))
  return { x: round(box.x / imageWidth), y: round(box.y / imageHeight), width: round(box.width / imageWidth), height: round(box.height / imageHeight) }
}

export function buildReferenceExtractionMetadata(input: Omit<StoryboardReferenceExtractionMetadata, 'version' | 'toolId' | 'parentAssetId'>): StoryboardReferenceExtractionMetadata {
  return { version: 2, toolId: STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID, parentAssetId: input.sourceAssetId, ...input }
}
```

- [ ] **Step 4: Run the focused test to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/storyboardReferenceExtract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the isolated contract**

```bash
git add apps/web/src/lib/canvas/storyboardReferenceExtract.ts apps/web/src/lib/canvas/storyboardReferenceExtract.test.ts
git commit -m "feat: define storyboard reference extraction contract"
```

### Task 2: Add compatible upload lineage and client crop FormData

**Files:**
- Create: `apps/web/src/lib/canvas/storyboardReferenceCrop.ts`
- Modify: `apps/web/src/app/api/assets/upload/storyboard-grid-split-metadata.ts`
- Modify: `apps/web/src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts`
- Modify: `apps/web/src/app/api/assets/upload/route.ts`
- Modify: `apps/web/src/app/api/assets/upload/project-validation.test.ts`

- [ ] **Step 1: Write failing upload-lineage tests**

```ts
test('accepts a reference extractor upload with only allowlisted fields', () => {
  const fd = new FormData()
  fd.append('toolId', 'storyboard-reference-extractor')
  fd.append('parentAssetId', 'parent-a')
  fd.append('sourceAssetId', 'parent-a')
  fd.append('sourceNodeId', 'node-a')
  fd.append('extractionSessionId', 'extract-a')
  fd.append('index', '0')
  fd.append('cropBox', JSON.stringify({ x: 0, y: 0, width: 0.5, height: 0.5 }))
  assert.deepEqual(parseStoryboardCropLineage(fd), { ok: true, lineage: {
    version: 2, toolId: 'storyboard-reference-extractor', parentAssetId: 'parent-a',
    sourceAssetId: 'parent-a', sourceNodeId: 'node-a', extractionSessionId: 'extract-a',
    index: 0, cropBox: { x: 0, y: 0, width: 0.5, height: 0.5 },
  } })
})

test('continues to parse legacy storyboard-grid-split rows', () => {
  // Preserve the existing version-1 test fixture and assert its returned toolId remains storyboard-grid-split.
})
```

- [ ] **Step 2: Run the focused upload tests to establish RED**

Run: `pnpm --filter web exec tsx --test src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts src/app/api/assets/upload/project-validation.test.ts`

Expected: FAIL because `parseStoryboardCropLineage` has not been exported and new extractor fields are rejected.

- [ ] **Step 3: Implement the compatible parser and form-data builder**

```ts
export type StoryboardCropLineage = StoryboardGridSplitLineage | StoryboardReferenceExtractionMetadata

export function parseStoryboardCropLineage(formData: FormData): { ok: true; lineage?: StoryboardCropLineage } | { ok: false; errorCode: string; message: string } {
  if (formData.get('toolId') === STORYBOARD_GRID_SPLIT_TOOL_ID) return parseStoryboardGridSplitLineage(formData)
  if (formData.get('toolId') !== STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID) return { ok: true }
  // Parse cropBox, source ids, extractionSessionId, and a non-negative index using the existing bounded helpers.
}

export function buildStoryboardReferenceUploadFormData(args: { blob: Blob; projectId: string; workflowId?: string; title: string; metadata: StoryboardReferenceExtractionMetadata }): FormData {
  // Build the existing image File shape, append ordinary upload fields, then append only toolId, source ids, extractionSessionId, index, and cropBox.
}
```

Replace the route's `parseStoryboardGridSplitLineage` call with `parseStoryboardCropLineage`; retain the same `required: Boolean(lineageResult.lineage)` ownership rule and `cropLineage` storage key.

- [ ] **Step 4: Run focused upload tests to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts src/app/api/assets/upload/project-validation.test.ts`

Expected: PASS; legacy records and new records both require a saved owned project.

- [ ] **Step 5: Commit compatible upload support**

```bash
git add apps/web/src/lib/canvas/storyboardReferenceCrop.ts apps/web/src/app/api/assets/upload/storyboard-grid-split-metadata.ts apps/web/src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts apps/web/src/app/api/assets/upload/route.ts apps/web/src/app/api/assets/upload/project-validation.test.ts
git commit -m "feat: support storyboard reference crop lineage"
```

### Task 3: Build the explicit freeform extractor dialog

**Files:**
- Create: `apps/web/src/components/create/StoryboardReferenceExtractorPanel.tsx`
- Create: `apps/web/src/components/create/StoryboardReferenceExtractorPanel.test.tsx`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.ts`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.test.ts`

- [ ] **Step 1: Write failing rendered-state tests**

```ts
test('does not expose an upload action before an explicit freeform selection exists', () => {
  const markup = renderToStaticMarkup(createElement(StoryboardReferenceExtractorPanel, props))
  assert.match(markup, /请选择或拖拽参考区域/)
  assert.match(markup, /disabled=""[^>]*>确认提取/)
})

test('renders user-confirmed selections with stable ordered labels', () => {
  const state = addReferenceSelection(emptyState, { x: 10, y: 20, width: 100, height: 80 })
  assert.equal(state.items[0]?.title, '参考图 1')
})
```

- [ ] **Step 2: Run the focused panel tests to establish RED**

Run: `pnpm --filter web exec tsx --test src/components/create/StoryboardReferenceExtractorPanel.test.tsx src/lib/canvas/tool-result-quality.test.ts`

Expected: FAIL because the panel and `referenceExtractionQuality` do not exist.

- [ ] **Step 3: Implement the smallest complete panel**

```tsx
export function StoryboardReferenceExtractorPanel({ sourceNode, projectId, onCreateReferenceNode, onUpdateSourceSession, onClose }: StoryboardReferenceExtractorPanelProps) {
  // Load only the selected source into an img/canvas overlay.
  // Pointer down/move/up creates one pixel-space rectangle; all mutation stays local until Confirm extraction.
  // A selection can be selected, relabeled, or removed. The panel starts empty and uses no layout presets.
  // Confirm serially crops existing selections, uploads only those selections, then invokes onCreateReferenceNode once per successful Asset.
}
```

The panel must use the existing image loading error and size limits, have no `fetch` in effects, disable confirmation without `projectId`, `assetId`, source pixels, and at least one valid selection, and pass actual uploaded/created counts to `referenceExtractionQuality`.

- [ ] **Step 4: Run focused panel tests to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/components/create/StoryboardReferenceExtractorPanel.test.tsx src/lib/canvas/tool-result-quality.test.ts`

Expected: PASS, including the existing grid-quality tests.

- [ ] **Step 5: Commit the panel in isolation**

```bash
git add apps/web/src/components/create/StoryboardReferenceExtractorPanel.tsx apps/web/src/components/create/StoryboardReferenceExtractorPanel.test.tsx apps/web/src/lib/canvas/tool-result-quality.ts apps/web/src/lib/canvas/tool-result-quality.test.ts
git commit -m "feat: add freeform storyboard reference extractor"
```

### Task 4: Replace the visible tool entry and Workspace wiring

**Files:**
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts`
- Modify: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `apps/web/src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts`

- [ ] **Step 1: Write failing registry and Workspace contract tests**

```ts
test('offers the replacement reference extractor instead of fixed grid split', () => {
  assert.equal(NODE_TOOL_REGISTRY.some((tool) => tool.id === 'storyboard-reference-extractor'), true)
  assert.equal(NODE_TOOL_REGISTRY.some((tool) => tool.id === 'storyboard-grid-split'), false)
})

test('reference nodes retain a source edge and do not use grid row/column placement', () => {
  // Render the Workspace helper through its existing lifecycle fixture and assert derivedFromTool,
  // edgeToolId, and cropLineage.toolId equal storyboard-reference-extractor.
})
```

- [ ] **Step 2: Run the focused replacement tests to establish RED**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts`

Expected: FAIL because the registry and Workspace still use `storyboard-grid-split`.

- [ ] **Step 3: Wire the replacement through the Workspace**

```ts
// nodeToolRegistry.ts
{ id: 'storyboard-reference-extractor', label: '分镜参考提取', icon: '⌑', description: '自由选取画面参考并建立来源关系', category: 'image-edit', executionType: 'panel', supportedKinds: ['image'], requiresMedia: true, requiresAsset: true, available: true, openActionId: 'storyboard-reference-extractor' }

// VisualCanvasWorkspace.tsx
case 'storyboard-reference-extractor': setIsStoryboardReferenceExtractorOpen(true); break
// Persist `referenceExtractionSession`; use ordered extraction index plus collision-safe placement,
// not row/column grid position. Derived metadata must set derivedFromTool and edgeToolId to the new id.
```

Retain the old crop parser and old stored node metadata only for historical reads. New UI labels, session metadata, edges, and quality summaries must use the new identity.

- [ ] **Step 4: Run focused replacement tests to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts src/components/create/StoryboardReferenceExtractorPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit Workspace wiring**

```bash
git add apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts
git commit -m "feat: replace storyboard grid split entry"
```

### Task 5: Validate the replacement and production boundary

**Files:**
- Create: `scripts/storyboard-reference-extractor-static.test.mjs`
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Write a static no-provider/no-grid-entry boundary test**

```js
test('reference extractor contains no Provider, generate, payment, or fixed-layout UI entry', () => {
  assert.doesNotMatch(panel, /\/api\/generate|providerId|payment|checkout/)
  assert.doesNotMatch(registry, /id: 'storyboard-grid-split'/)
  assert.match(registry, /id: 'storyboard-reference-extractor'/)
})
```

- [ ] **Step 2: Run the complete targeted suite**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/storyboardReferenceExtract.test.ts src/components/create/StoryboardReferenceExtractorPanel.test.tsx src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts src/app/api/assets/upload/project-validation.test.ts src/lib/canvas/tool-result-quality.test.ts && node --test scripts/storyboard-reference-extractor-static.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run repository validation**

Run: `pnpm type-check`

Run: `pnpm lint`

Run: `pnpm build`

Run: `git diff --check`

Expected: type-check/build/diff-check pass; lint may report only the documented existing warnings.

- [ ] **Step 4: Perform browser QA in a disposable Preview project**

Verify: open a persisted image node, draw two unequal selections, delete one, confirm one crop, observe exactly one asset upload and one source-linked node, manually save, refresh, reopen, and find the Asset. Confirm no `/api/generate/*`, Provider, billing, credit, wallet, payment, or checkout mutation and no console error.

- [ ] **Step 5: Commit closeout docs after production validation**

```bash
git add scripts/storyboard-reference-extractor-static.test.mjs docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: close storyboard reference extractor"
```
