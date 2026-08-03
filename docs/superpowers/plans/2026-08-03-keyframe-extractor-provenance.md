# Keyframe Extractor Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each Keyframe Extractor draft preserve truthful local keyframe provenance without uploading a frame, generating media, or mutating the source video.

**Architecture:** A pure Canvas helper owns the version-1 provenance contract. `KeyframeExtractorPanel` maps ephemeral browser state into that contract only after an explicit draft action. `VisualCanvasWorkspace` forwards metadata and the existing derived-edge identity through `createNode`, the only Canvas mutation boundary.

**Tech Stack:** Next.js client components, TypeScript, React, existing Canvas node/edge metadata, Node built-in tests through `tsx --test`, existing browser-component harness.

---

## File Map

**Create**
- `apps/web/src/lib/canvas/keyframe-extraction-provenance.ts` — immutable version-1 provenance types and pure builder.
- `apps/web/src/lib/canvas/keyframe-extraction-provenance.test.ts` — evidence-contract tests.

**Modify**
- `apps/web/src/components/create/KeyframeExtractorPanel.tsx` — constructs the payload at the explicit draft boundary.
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — forwards optional metadata and edge identity to `createNode`.
- `apps/web/src/lib/canvas/tool-result-quality.ts` — distinguishes frame-backed and timestamp-only evidence.
- `apps/web/src/lib/canvas/tool-result-quality.test.ts` — proves evidence wording and browser callback behavior.
- `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` — record validated result or harness limitation.

**Forbidden:** generate routes, Provider/BYOK adapters, payment/credits/wallet/billing, Prisma/schema/migrations, environment files, package files, `next.config.js`, `cn-executor`, and Production database resources.

## Task 1: Define and Test the Pure Contract

**Files:**
- Create: `apps/web/src/lib/canvas/keyframe-extraction-provenance.test.ts`
- Create: `apps/web/src/lib/canvas/keyframe-extraction-provenance.ts`

- [ ] **Step 1: Write the failing browser-frame contract.**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildKeyframeExtractionProvenance } from './keyframe-extraction-provenance'

test('records browser-frame evidence without frame bytes', () => {
  const result = buildKeyframeExtractionProvenance({
    sourceNodeId: 'video-01', sourceAssetId: 'asset-01',
    sourceVideoUrlAvailable: true, selectedTimeSeconds: 3.5,
    selectedTimeLabel: '0:03.5', hasLocalFrame: true,
    previewStatus: 'available', createdAt: '2026-08-03T00:00:00.000Z',
  })
  assert.equal(result.evidenceKind, 'browser-frame-preview')
  assert.equal(result.sourceAssetId, 'asset-01')
  assert.doesNotMatch(JSON.stringify(result), /data:image|base64/i)
})
```

- [ ] **Step 2: Verify RED.**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/keyframe-extraction-provenance.test.ts`

Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement the minimal versioned helper.**

```ts
export type KeyframePreviewStatus =
  | 'available'
  | 'not-extracted'
  | 'cors-restricted'
  | 'video-unavailable'

export type KeyframeExtractionProvenance = {
  version: 1
  sourceNodeId: string
  sourceAssetId?: string
  sourceVideoUrlAvailable: boolean
  selectedTimeSeconds: number
  selectedTimeLabel: string
  evidenceKind: 'browser-frame-preview' | 'time-point-reference'
  previewStatus: KeyframePreviewStatus
  createdAt: string
}

export function buildKeyframeExtractionProvenance(input: {
  sourceNodeId: string
  sourceAssetId?: string
  sourceVideoUrlAvailable: boolean
  selectedTimeSeconds: number
  selectedTimeLabel: string
  hasLocalFrame: boolean
  previewStatus: KeyframePreviewStatus
  createdAt: string
}): KeyframeExtractionProvenance {
  if (!input.sourceNodeId.trim()) throw new Error('Keyframe source node ID is required')
  if (!input.selectedTimeLabel.trim()) throw new Error('Keyframe time label is required')
  if (!Number.isFinite(input.selectedTimeSeconds) || input.selectedTimeSeconds < 0) {
    throw new Error('Keyframe time must be a non-negative finite number')
  }
  return {
    version: 1,
    sourceNodeId: input.sourceNodeId,
    ...(input.sourceAssetId?.trim() ? { sourceAssetId: input.sourceAssetId } : {}),
    sourceVideoUrlAvailable: input.sourceVideoUrlAvailable,
    selectedTimeSeconds: input.selectedTimeSeconds,
    selectedTimeLabel: input.selectedTimeLabel,
    evidenceKind: input.hasLocalFrame ? 'browser-frame-preview' : 'time-point-reference',
    previewStatus: input.previewStatus,
    createdAt: input.createdAt,
  }
}
```

- [ ] **Step 4: Add timestamp-only and invalid-identity cases.**

```ts
test('falls back to timestamp-only evidence after a CORS restriction', () => {
  const result = buildKeyframeExtractionProvenance({
    sourceNodeId: 'video-02', sourceVideoUrlAvailable: true,
    selectedTimeSeconds: 0, selectedTimeLabel: '0:00.0',
    hasLocalFrame: false, previewStatus: 'cors-restricted',
    createdAt: '2026-08-03T00:00:00.000Z',
  })
  assert.equal(result.evidenceKind, 'time-point-reference')
  assert.equal('sourceAssetId' in result, false)
})

test('rejects a blank source identity before Canvas mutation', () => {
  assert.throws(() => buildKeyframeExtractionProvenance({
    sourceNodeId: ' ', sourceVideoUrlAvailable: true,
    selectedTimeSeconds: 0, selectedTimeLabel: '0:00.0',
    hasLocalFrame: false, previewStatus: 'not-extracted',
    createdAt: '2026-08-03T00:00:00.000Z',
  }), /source node ID/)
})
```

- [ ] **Step 5: Verify GREEN and commit.**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/keyframe-extraction-provenance.test.ts`

Then:
```bash
git add apps/web/src/lib/canvas/keyframe-extraction-provenance.ts apps/web/src/lib/canvas/keyframe-extraction-provenance.test.ts
git commit -m "feat: define keyframe provenance"
```

## Task 2: Make Result Semantics Evidence-Aware

**Files:**
- Modify: `apps/web/src/lib/canvas/tool-result-quality.ts`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.test.ts`

- [ ] **Step 1: Write failing created-draft state tests.**

```ts
test('describes a frame-backed draft without claiming an Asset', () => {
  const summary = keyframeQuality({
    sourceLabel: '镜头 07', hasVideo: true, hasLocalFrame: true,
    extractionFailed: false, extractionError: '', isExtracting: false,
    createdDraftKind: 'image', previewStatus: 'available',
  })
  assert.equal(summary.status, 'completed')
  assert.match(summary.evidence.join(' '), /当前浏览器/)
  assert.doesNotMatch(JSON.stringify(summary), /已上传|已保存资产|已生成/)
})

test('describes a CORS draft as timestamp-only evidence', () => {
  const summary = keyframeQuality({
    sourceLabel: '镜头 07', hasVideo: true, hasLocalFrame: false,
    extractionFailed: true, extractionError: '浏览器因 CORS 限制无法截帧',
    isExtracting: false, createdDraftKind: 'video', previewStatus: 'cors-restricted',
  })
  assert.match(summary.evidence.join(' '), /时间点参考/)
})
```

- [ ] **Step 2: Verify RED.**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts`

Expected: FAIL because `KeyframeQualityInput` has no `previewStatus`.

- [ ] **Step 3: Extend only the keyframe adapter.**

Import `KeyframePreviewStatus`, add optional `previewStatus?: KeyframePreviewStatus`
to `KeyframeQualityInput`, and use `not-extracted` as the compatibility default
for its existing callers. Use this branch:

```ts
const frameEvidence = input.hasLocalFrame
  ? '浏览器帧预览仅存在于当前浏览器，尚未成为资产'
  : '该草案仅引用所选视频时间点，不包含本地帧预览'

if (input.createdDraftKind) {
  return summary('completed', '草案节点已创建', input.sourceLabel,
    input.createdDraftKind === 'image' ? '已创建图片草案节点' : '已创建视频草案节点',
    [frameEvidence, ...failureEvidence])
}
```

For the non-created CORS state keep `failed`, but name the timestamp-only fallback. Do not add fetches, timers, persistence, scores, or other tool changes.

- [ ] **Step 4: Verify GREEN and commit.**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts`

Then:
```bash
git add apps/web/src/lib/canvas/tool-result-quality.ts apps/web/src/lib/canvas/tool-result-quality.test.ts
git commit -m "feat: clarify keyframe draft evidence"
```

## Task 3: Attach Provenance at the Explicit Draft Boundary

**Files:**
- Modify: `apps/web/src/components/create/KeyframeExtractorPanel.tsx`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.test.ts`

- [ ] **Step 1: Write a failing client-harness assertion.**

Extend the existing `clientHarnessSource()` keyframe mode to store callback requests in `window.__keyframeRequests`. Add:

```ts
test('creates an image draft request with stable keyframe provenance', async () => {
  const page = await renderClientPanel('keyframe-extract')
  await page.getByRole('button', { name: '创建图片节点草案' }).click()
  const request = await page.evaluate(() => window.__keyframeRequests?.[0])
  assert.equal(request.options.parentNodeId, 'video-extract')
  assert.equal(request.options.edgeToolId, 'keyframe-extractor')
  assert.equal(request.options.metadataJson.keyframeExtraction.version, 1)
  assert.equal(request.options.metadataJson.keyframeExtraction.evidenceKind, 'time-point-reference')
})
```

- [ ] **Step 2: Verify RED.**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts`

Expected: FAIL because the current panel callback does not accept metadata or edge fields.

- [ ] **Step 3: Construct one additive draft request in the panel.**

Import `buildKeyframeExtractionProvenance`. Define shared `createDraft(kind)` used by both existing buttons. Select preview status exactly as follows:

```ts
const previewStatus = videoError ? 'video-unavailable'
  : corsError ? 'cors-restricted'
  : frameDataUrl ? 'available'
  : 'not-extracted'
```

The callback payload includes `metadataJson.keyframeExtraction`, `edgeLabel: '关键帧参考'`, `edgeToolId: 'keyframe-extractor'`, and `edgeToolIcon: '🎞'`. Its builder input uses the selected node ID, optional Asset ID, current seconds/label, frame presence, status, and current ISO time.

Do not include `frameDataUrl`, video URLs, or bytes in metadata. Keep both existing button labels and source-node immutability.

- [ ] **Step 4: Forward optional fields through the existing workspace boundary.**

At the panel render in `VisualCanvasWorkspace.tsx`:

```tsx
onCreateNode={(kind, options) => createNode(kind, {
  title: options.title,
  prompt: options.prompt,
  parentNodeId: options.parentNodeId,
  metadataJson: options.metadataJson,
  edgeLabel: options.edgeLabel,
  edgeToolId: options.edgeToolId,
  edgeToolIcon: options.edgeToolIcon,
})}
```

`createNode` already maps node metadata and `derivedToolChannel` edge metadata. Do not add an eager save, another store, or another mutation function.

- [ ] **Step 5: Verify GREEN and commit.**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/keyframe-extraction-provenance.test.ts src/lib/canvas/tool-result-quality.test.ts`

Then:
```bash
git add apps/web/src/components/create/KeyframeExtractorPanel.tsx apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/lib/canvas/tool-result-quality.test.ts
git commit -m "feat: preserve keyframe draft provenance"
```

## Task 4: Regression, Preview QA, and Closeout

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run Canvas contract regressions.**

Run: `pnpm --filter web exec tsx --test src/lib/canvas/keyframe-extraction-provenance.test.ts src/lib/canvas/tool-result-quality.test.ts src/components/create/canvas/canvasRenderPlanning.test.ts src/components/create/canvas/canvasSaveScheduling.test.ts`

Expected: all pass. Stop and investigate any regression before continuing.

- [ ] **Step 2: Run safeguards and forbidden-zone review.**

Run: `pnpm type-check && pnpm lint && pnpm build && git diff --check && git diff --name-only`

Expected: type-check/build pass; lint may retain only pre-existing warnings. Changed paths must exclude the forbidden list.

- [ ] **Step 3: Perform Preview-only browser QA with disposable data.**

Open the extractor from a disposable Preview video node; create one image draft and one video draft; inspect their edge label/provenance; save/reload; capture Console and Network. Required counts: `/api/generate/*` = 0, Provider = 0, payment/billing/credit/wallet mutations = 0. If no safe disposable video node exists, record `QA_HARNESS_LIMITATION`; never use a user Production project.

- [ ] **Step 4: Update docs and commit outcome.**

Mark the task `VALIDATED / CLOSED` only if both contracts and permitted Preview QA pass. Otherwise record the exact harness limitation without a Production PASS claim. Include test totals, commit hashes, and no-generation boundary.

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: close keyframe provenance hardening"
```

- [ ] **Step 5: Push only after current-session confirmation.**

The local agent guard requires an explicit current-session confirmation before `git push` and deploy. Once granted, push `main`, wait for Vercel Ready, and verify only the safely exercised Preview path.
