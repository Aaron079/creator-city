# Storyboard Grid Detection Confidence Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Prevent ordinary images from being auto-selected as storyboard grids while retaining one-click crop for reliable grids and all existing crop, upload, lineage, and placement contracts.

**Architecture:** Detection stays in apps/web/src/lib/canvas/storyboardGridDetect.ts. It replaces absolute boundary darkness with local contrast plus continuous-line coverage, returning confirmed, needs-confirmation, or manual. StoryboardGridSplitPanel keeps its layout selection null until detection is confirmed or the user selects a layout.

**Tech Stack:** TypeScript, React, Canvas 2D, Node node:test through tsx.

---

## File Structure

- Modify: apps/web/src/lib/canvas/storyboardGridDetect.ts — evidence, ranking, typed result.
- Modify: apps/web/src/lib/canvas/storyboardGridSplit.test.ts — deterministic detector fixtures.
- Modify: apps/web/src/components/create/StoryboardGridSplitPanel.tsx — nullable selected layout and crop gate.
- Create: scripts/storyboard-grid-detection-confidence-static.test.mjs — static panel/detector regression boundary.

## Task 1: Establish the Detector Contract with RED Tests

**Files:**
- Modify: apps/web/src/lib/canvas/storyboardGridSplit.test.ts:104-122
- Modify after RED: apps/web/src/lib/canvas/storyboardGridDetect.ts:116-183

- [ ] **Step 1: Add continuous and interrupted-boundary test helpers**

Add these helpers after drawBlackLine:

~~~ts
function drawBlackBoundarySegment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  axis: 'x' | 'y',
  position: number,
  startRatio: number,
  endRatio: number,
) {
  const start = Math.round((axis === 'x' ? height : width) * startRatio)
  const end = Math.round((axis === 'x' ? height : width) * endRatio)
  for (let offset = start; offset < end; offset += 1) {
    const x = axis === 'x' ? position : offset
    const y = axis === 'x' ? offset : position
    const index = (y * width + x) * 4
    data[index] = data[index + 1] = data[index + 2] = 0
  }
}

function drawConfirmedGrid(data: Uint8ClampedArray, width: number, height: number, layout: '2x2' | '3x3') {
  const boundaries = layout === '2x2' ? [0.5] : [1 / 3, 2 / 3]
  for (const ratio of boundaries) {
    drawBlackLine(data, width, height, 'x', Math.round(width * ratio))
    drawBlackLine(data, width, height, 'y', Math.round(height * ratio))
  }
}
~~~

- [ ] **Step 2: Replace the current detector cases with the four decision assertions**

~~~ts
test('confirms a clean 2x2 bordered storyboard image', () => {
  const image = makeImageData(240, 240, (data) => drawConfirmedGrid(data, 240, 240, '2x2'))
  const result = detectGridLayoutFromImageData(image)
  assert.equal(result.layoutId, '2x2')
  assert.equal(result.selectionMode, 'confirmed')
  assert.equal(result.reason, 'confirmed-grid')
})

test('does not confirm a logo-like interrupted 3x3 signal', () => {
  const image = makeImageData(240, 240, (data) => {
    for (const ratio of [1 / 3, 2 / 3]) {
      drawBlackBoundarySegment(data, 240, 240, 'x', Math.round(240 * ratio), 0.1, 0.85)
      drawBlackBoundarySegment(data, 240, 240, 'y', Math.round(240 * ratio), 0.15, 0.9)
    }
  })
  const result = detectGridLayoutFromImageData(image)
  assert.notEqual(result.selectionMode, 'confirmed')
  assert.notEqual(result.layoutId, '3x3')
})

test('returns needs-confirmation for one-axis evidence', () => {
  const image = makeImageData(240, 240, (data) => drawBlackLine(data, 240, 240, 'x', 120))
  const result = detectGridLayoutFromImageData(image)
  assert.equal(result.selectionMode, 'needs-confirmation')
  assert.equal(result.layoutId, '1x2')
  assert.equal(result.reason, 'ambiguous-grid')
})

test('returns manual when image has no grid evidence', () => {
  const result = detectGridLayoutFromImageData(makeImageData(240, 240))
  assert.equal(result.selectionMode, 'manual')
  assert.equal(result.layoutId, null)
  assert.equal(result.reason, 'manual-fallback')
})
~~~

- [ ] **Step 3: Record RED**

Run:

~~~bash
pnpm --filter web exec tsx --test src/lib/canvas/storyboardGridSplit.test.ts
~~~

Expected: FAIL because selectionMode and the new reason values do not exist; the interrupted fixture may still select 3x3.

- [ ] **Step 4: Preserve RED intent**

Do not weaken assertions, use test-only production branches, or change crop geometry.

## Task 2: Implement Local Evidence and Cautious Decisions

**Files:**
- Modify: apps/web/src/lib/canvas/storyboardGridDetect.ts:116-183
- Test: apps/web/src/lib/canvas/storyboardGridSplit.test.ts:104-170

- [ ] **Step 1: Export the decision contract**

~~~ts
export type StoryboardGridSelectionMode = 'confirmed' | 'needs-confirmation' | 'manual'

export type StoryboardGridDetectionReason =
  | 'confirmed-grid'
  | 'ambiguous-grid'
  | 'manual-fallback'

export type StoryboardGridDetectionResult = {
  layoutId: StoryboardGridLayoutId | null
  confidence: number
  reason: StoryboardGridDetectionReason
  selectionMode: StoryboardGridSelectionMode
}
~~~

- [ ] **Step 2: Add local contrast and coverage evidence**

Use deterministic constants:

~~~ts
const BOUNDARY_SAMPLE_COUNT = 24
const BOUNDARY_NEIGHBOR_OFFSET = 5
const MIN_BOUNDARY_PROMINENCE = 0.45
const MIN_BOUNDARY_COVERAGE = 0.9
const MIN_CONFIRMED_CONFIDENCE = 0.78
const MIN_CONFIRMATION_MARGIN = 0.015

type BoundaryEvidence = { prominence: number; coverage: number }
type LayoutEvidence = {
  layoutId: StoryboardGridLayoutId
  confidence: number
  expectedLines: number
  everyBoundaryReliable: boolean
  hasReliableBoundaryOnBothAxes: boolean
}
~~~

For every expected row/column boundary, sample 24 evenly distributed positions. Compare darkness at the line with darkness five pixels on both sides; a point is present only when local darkness difference is at least MIN_BOUNDARY_PROMINENCE. Coverage is present points divided by samples. Prominence is mean clamped local difference. A layout is reliable only when every expected boundary meets prominence and coverage thresholds. scoreLayout returns LayoutEvidence with confidence derived from mean prominence and minimum coverage. Track reliable horizontal and vertical boundary counts. Automatic confirmation additionally requires at least one reliable boundary on each axis; a one-axis strip candidate always needs manual confirmation. expectedLines * 0.01 is only a deterministic tie-breaker; it never makes unreliable evidence eligible.

- [ ] **Step 3: Resolve the public result**

~~~ts
function resolveDetection(candidates: LayoutEvidence[]): StoryboardGridDetectionResult {
  const [best, next] = candidates
  if (!best || best.confidence < MIN_CONFIRMED_CONFIDENCE) {
    return { layoutId: null, confidence: best?.confidence ?? 0, reason: 'manual-fallback', selectionMode: 'manual' }
  }

  const bestScore = best.confidence + best.expectedLines * 0.01
  const nextScore = (next?.confidence ?? 0) + (next?.expectedLines ?? 0) * 0.01
  if (!best.everyBoundaryReliable || !best.hasReliableBoundaryOnBothAxes || bestScore - nextScore < MIN_CONFIRMATION_MARGIN) {
    return { layoutId: best.layoutId, confidence: best.confidence, reason: 'ambiguous-grid', selectionMode: 'needs-confirmation' }
  }

  return { layoutId: best.layoutId, confidence: best.confidence, reason: 'confirmed-grid', selectionMode: 'confirmed' }
}
~~~

detectGridLayoutFromImageData maps every supported layout to evidence and returns resolveDetection. The canvas-context failure in detectGridLayout returns selectionMode manual.

- [ ] **Step 4: Verify GREEN**

~~~bash
pnpm --filter web exec tsx --test src/lib/canvas/storyboardGridSplit.test.ts
~~~

Expected: all existing geometry, crop metadata, upload-form, and detector tests pass.

- [ ] **Step 5: Commit the detector change**

~~~bash
git add apps/web/src/lib/canvas/storyboardGridDetect.ts apps/web/src/lib/canvas/storyboardGridSplit.test.ts
git commit -m "fix: guard storyboard grid auto detection"
~~~

## Task 3: Require Confirmation Before Crop

**Files:**
- Modify: apps/web/src/components/create/StoryboardGridSplitPanel.tsx:109-170, 300-385
- Create: scripts/storyboard-grid-detection-confidence-static.test.mjs

- [ ] **Step 1: Add a failing static UI contract**

~~~js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('../apps/web/src/components/create/StoryboardGridSplitPanel.tsx', import.meta.url), 'utf8')
const detector = readFileSync(new URL('../apps/web/src/lib/canvas/storyboardGridDetect.ts', import.meta.url), 'utf8')

test('storyboard grid split requires a confirmed or explicit layout selection before crop', () => {
  assert.match(detector, /selectionMode: StoryboardGridSelectionMode/)
  assert.match(panel, /useState<StoryboardGridLayoutId \| null>\(null\)/)
  assert.match(panel, /detected\.selectionMode === 'confirmed'/)
  assert.match(panel, /请选择布局后再裁切入库/)
  assert.match(panel, /disabled=\{!hasProjectId \|\| !canUseSource \|\| !layoutId/)
  assert.match(panel, /onClick=\{\(\) => setLayoutId\(layout\.id\)\}/)
})
~~~

- [ ] **Step 2: Record RED**

~~~bash
node --test scripts/storyboard-grid-detection-confidence-static.test.mjs
~~~

Expected: FAIL because the panel defaults to 2x2, accepts all detections, and can crop without an explicit selection.

- [ ] **Step 3: Make selection nullable and consume the decision**

~~~ts
const [layoutId, setLayoutId] = useState<StoryboardGridLayoutId | null>(null)
const [detectMessage, setDetectMessage] = useState('请选择布局后再裁切入库。')

const detected = detectGridLayout(image)
if (detected.selectionMode === 'confirmed' && detected.layoutId) {
  setLayoutId(detected.layoutId)
  setDetectMessage('已确认 ' + detected.layoutId + '，置信度 ' + (detected.confidence * 100).toFixed(0) + '%。')
} else if (detected.selectionMode === 'needs-confirmation' && detected.layoutId) {
  setLayoutId(null)
  setDetectMessage('可能是 ' + detected.layoutId + '，请确认布局后再裁切。')
} else {
  setLayoutId(null)
  setDetectMessage('未识别到稳定网格，请选择布局后再裁切入库。')
}
~~~

Cells must be empty and previewGridStyle undefined when layoutId is null. uploadAll returns before queue/network work with a null layout. After narrowing use selectedLayoutId for the source-session summary so it remains non-null.

~~~tsx
<button
  type="button"
  disabled={!hasProjectId || !canUseSource || !layoutId || loadingImage || activeItems.length === 0}
  onClick={uploadAll}
>
  裁切并入库
</button>
{!layoutId && !imageError ? (
  <p className="mt-2 text-[10px] text-amber-200/75">请选择布局后再裁切入库。</p>
) : null}
~~~

The seven existing layout buttons remain onClick={() => setLayoutId(layout.id)}. That manual action makes no request and is the only path to enable ambiguous/manual crop.

- [ ] **Step 4: Verify GREEN**

~~~bash
node --test scripts/storyboard-grid-detection-confidence-static.test.mjs
pnpm --filter web exec tsx --test src/lib/canvas/storyboardGridSplit.test.ts
~~~

Expected: both pass; crop is impossible before confirmed/manual selection.

- [ ] **Step 5: Commit panel safety**

~~~bash
git add apps/web/src/components/create/StoryboardGridSplitPanel.tsx scripts/storyboard-grid-detection-confidence-static.test.mjs
git commit -m "fix: require storyboard grid confirmation"
~~~

## Task 4: Integrate and Verify Existing Contracts

**Files:**
- Verify: apps/web/src/components/create/VisualCanvasWorkspace.tsx:10897-10921
- Verify: apps/web/src/lib/canvas/storyboardGridPlacement.test.ts
- Verify: apps/web/src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts
- Verify: apps/web/src/app/api/assets/upload/project-validation.test.ts

- [ ] **Step 1: Confirm no workspace/API wiring change is needed**

~~~bash
rg -n "detectGridLayout|resolveStoryboardGridCellPosition|onCreateCellNode" \
  apps/web/src/components/create/VisualCanvasWorkspace.tsx \
  apps/web/src/components/create/StoryboardGridSplitPanel.tsx
~~~

Expected: detection is panel-local; workspace consumes uploaded cells and uses persisted row/column placement.

- [ ] **Step 2: Run targeted regression coverage**

~~~bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/storyboardGridSplit.test.ts \
  src/lib/canvas/storyboardGridPlacement.test.ts \
  src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts \
  src/app/api/assets/upload/project-validation.test.ts
node --test \
  scripts/storyboard-grid-detection-confidence-static.test.mjs \
  scripts/canvas-tool-semantic-integrity-static.test.mjs
~~~

Expected: all pass, including metadata allowlisting, project validation/retry, collision-safe placement, and removed fake-editor coverage.

- [ ] **Step 3: Validate the repository and forbidden boundaries**

~~~bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
git diff --name-only 72a5fcb..HEAD
~~~

Expected: type-check/build pass; lint has only pre-existing warnings; changed files remain inside detector, panel, tests, and task docs, with no generate, Provider, billing/payment, schema, env, package, or cn-executor paths.

- [ ] **Step 4: Safe Production browser QA**

In authenticated Production Chrome open an existing image-result node and the existing 分镜拆格 panel. Do not call Provider or payment routes. Verify: ordinary source does not silently select 3x3; ambiguous/manual state has clear copy and disabled crop; manual 2x2 renders four overlays and enables crop; closing without crop leaves source/assets/canvas unchanged; no automatic asset upload/generation/Provider/billing/payment request starts. Report unavailable exact request counts as QA_HARNESS_LIMITATION only.

- [ ] **Step 5: Commit, push only with current-session authorization, then close docs**

~~~bash
git add apps/web/src/lib/canvas/storyboardGridDetect.ts \
  apps/web/src/lib/canvas/storyboardGridSplit.test.ts \
  apps/web/src/components/create/StoryboardGridSplitPanel.tsx \
  scripts/storyboard-grid-detection-confidence-static.test.mjs
git commit -m "fix: guard storyboard grid auto detection"
git push origin main
~~~

Update docs/CURRENT_STATUS.md and docs/NEXT_TASKS.md only with verified outcomes. Commit docs separately, push only with current-session authorization, wait for an available trusted Production signal, then finish with git status --short clean.

## Plan Self-Review

- Spec coverage: Tasks 1-2 implement the three decision modes; Task 3 enforces explicit selection; Task 4 protects crop, lineage, placement, boundaries, and safe QA.
- Placeholder scan: no TODO, TBD, or unspecified test step.
- Type consistency: StoryboardGridSelectionMode, StoryboardGridDetectionReason, StoryboardGridDetectionResult, and nullable layoutId are defined before use.
