# Canvas Tool Result Quality Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Canvas tools' actual outcomes easy to inspect and continue from through one compact, truthful quality-summary pattern, without changing tool execution, persistence, generation, or the Canvas visual language.

**Architecture:** A pure `tool-result-quality` module converts existing panel state into a small status/source/result/evidence/next-step view model. One presentational `ToolResultQualityStrip` renders that model in each existing panel. Image tools ship first (Grid Split, Annotation, Color Grade), then director-review tools (Continuity, Variant Planner, A/B Compare, Keyframe Extractor). The layer is read-only: existing explicit buttons remain the only mutation paths.

**Tech Stack:** Next.js client components, TypeScript, React, Tailwind utilities, Node built-in test runner through `tsx --test`, existing Canvas panel/state helpers.

---

## File Map

**Create**
- `apps/web/src/lib/canvas/tool-result-quality.ts` — typed, deterministic quality-summary adapters.
- `apps/web/src/lib/canvas/tool-result-quality.test.ts` — table-driven adapter contracts.
- `apps/web/src/components/create/ToolResultQualityStrip.tsx` — shared compact presentational strip.
- `apps/web/src/components/create/ToolResultQualityStrip.test.tsx` — rendered visual-state regressions.

**Modify in release 1**
- `apps/web/src/components/create/StoryboardGridSplitPanel.tsx` — render truthful split/upload/child-node evidence.
- `apps/web/src/components/create/AnnotationPanel.tsx` — render source-lock and saved-versus-draft evidence.
- `apps/web/src/components/create/ColorGradePalettePanel.tsx` — render preview-only / prompt-append / derived-draft evidence.

**Modify in release 2**
- `apps/web/src/components/create/ContinuityCheckerPanel.tsx` — replace display/copy-facing numeric score with issue-derived categorical status.
- `apps/web/src/components/create/AssetVariantPlannerPanel.tsx` — render existing plan count and non-generating next step.
- `apps/web/src/components/create/ABComparePanel.tsx` — render valid-pair and deliberate-winner evidence.
- `apps/web/src/components/create/KeyframeExtractorPanel.tsx` — render source, local frame, CORS failure, and draft-node evidence.

**Do not modify**
- `apps/web/src/app/api/generate/image/**`, `apps/web/src/app/api/generate/video/**`, Provider/BYOK code, payment/credits/wallet/billing code, Prisma/schema/migrations, env, package/lockfile, `next.config.js`, `cn-executor`, or Production database configuration.
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx` unless an implementation audit proves a new read-only callback cannot be expressed through a panel's existing props. The intended implementation requires no workspace change.

## Shared Contract

```ts
export type ToolResultQualityStatus =
  | 'not-started'
  | 'processing'
  | 'needs-confirmation'
  | 'completed'
  | 'preview'
  | 'failed'
  | 'unavailable'

export type ToolResultQualitySummary = {
  status: ToolResultQualityStatus
  statusLabel: string
  sourceLabel: string
  resultLabel: string
  evidence: readonly string[]
  nextStepLabel?: string
}
```

The helper exports one adapter per supported tool. Each adapter accepts only already-known component state: identifiers, counts, existing result flags, and existing error/unavailable flags. It must return text and status only. It must not accept callbacks, URLs that it fetches, mutable node objects, timestamps used as identities, or any API client.

The shared strip accepts one `ToolResultQualitySummary` prop and has no handlers. Existing buttons in their current panels remain responsible for save, upload, draft-node creation, focus, copy, and close actions. This preserves the no-automatic-action contract.

### Status Rules

| Status | Meaning | Never claim |
| --- | --- | --- |
| `not-started` | Required source/context is absent or untouched. | A result or saved work. |
| `processing` | A real existing operation is currently active. | A decorative loading state. |
| `needs-confirmation` | An existing layout/choice is ready for the user's explicit confirmation. | Completed output. |
| `completed` | A real persisted annotation, created child, chosen version, or draft node exists. | Generated media or a rewritten source unless one already exists. |
| `preview` | Local CSS/frame/planning/analysis preview exists. | A derived asset or saved mutation. |
| `failed` | Existing operation or local extraction reported an error. | A retry that was not actually offered. |
| `unavailable` | Required source data, compatible pair, CORS access, or tool context is absent. | A product outage. |

## Task 1: Shared Model and Compact Renderer

**Files:**
- Create: `apps/web/src/lib/canvas/tool-result-quality.ts`
- Create: `apps/web/src/lib/canvas/tool-result-quality.test.ts`
- Create: `apps/web/src/components/create/ToolResultQualityStrip.tsx`
- Create: `apps/web/src/components/create/ToolResultQualityStrip.test.tsx`

- [ ] **Step 1: Write failing adapter contracts first.**

```ts
test('does not call a detected grid completed before a child node exists', () => {
  const summary = gridSplitQuality({
    sourceLabel: '分镜源图', layoutLabel: '2 x 2', uploadedCount: 4,
    createdChildCount: 0, hasUploadError: false,
  })
  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.resultLabel, /4 个裁切已入库/)
})

test('keeps color grading explicitly preview-only', () => {
  const summary = colorGradeQuality({
    sourceLabel: '主视觉', activeWheelCount: 2, previewReady: true,
    promptAppended: false, derivedDraftCreated: false,
  })
  assert.equal(summary.status, 'preview')
  assert.doesNotMatch(summary.resultLabel, /已生成|已改写源资产/)
})
```

- [ ] **Step 2: Verify RED.**

```bash
pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts
```

Expected: failure because the module does not exist.

- [ ] **Step 3: Implement typed, pure adapters and the renderer.**

```ts
export function continuityQuality(input: {
  checkedNodeCount: number
  warnCount: number
  riskCount: number
  infoCount: number
}): ToolResultQualitySummary {
  if (input.checkedNodeCount < 2) return unavailableQuality('连贯性检查', '需要至少 2 个带内容的节点')
  if (input.riskCount > 0) return blockedQuality('发现需优先处理的问题', input)
  if (input.warnCount > 0) return reviewQuality('发现需要确认的项', input)
  return completedQuality('未发现需处理的问题', input)
}
```

Use equivalents for Grid Split, Annotation, Color Grade, Variant Planner, A/B Compare, and Keyframe Extractor. Do not export a generic "quality score" function. In `ToolResultQualityStrip`, map status to the existing neutral/cyan/amber/rose palette and render a short source/result sentence plus up to two evidence bullets. The strip has no button, `useEffect`, fetch, timer, or callback prop.

- [ ] **Step 4: Add rendered strip regressions.**

```ts
test('renders preview as a preview rather than a saved result', () => {
  const html = renderToStaticMarkup(
    <ToolResultQualityStrip summary={previewSummary} />,
  )
  assert.match(html, /预览/)
  assert.doesNotMatch(html, /已保存为资产/)
})

test('renders source and evidence without an action button', () => {
  const html = renderToStaticMarkup(<ToolResultQualityStrip summary={completedSummary} />)
  assert.match(html, /来源/)
  assert.match(html, /证据/)
  assert.doesNotMatch(html, /<button/)
})
```

- [ ] **Step 5: Verify GREEN.**

```bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/tool-result-quality.test.ts \
  src/components/create/ToolResultQualityStrip.test.tsx
```

- [ ] **Step 6: Commit the shared, tested foundation.**

```bash
git add apps/web/src/lib/canvas/tool-result-quality.ts \
  apps/web/src/lib/canvas/tool-result-quality.test.ts \
  apps/web/src/components/create/ToolResultQualityStrip.tsx \
  apps/web/src/components/create/ToolResultQualityStrip.test.tsx
git commit -m "feat: add canvas tool result quality layer"
```

## Task 2: Image Tool Evidence — Grid Split and Annotation

**Files:**
- Modify: `apps/web/src/components/create/StoryboardGridSplitPanel.tsx`
- Modify: `apps/web/src/components/create/AnnotationPanel.tsx`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.test.ts`

- [ ] **Step 1: Extend failing mapping tests for real image-tool states.**

```ts
test('marks annotation as draft until the existing save path has run', () => {
  const summary = annotationQuality({
    sourceLabel: '角色参考', persistedCount: 1, draftCount: 2, hasUnsavedChanges: true,
  })
  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.evidence.join(' '), /2 条待保存/)
})

test('reports created storyboard children only from existing created-node ids', () => {
  const summary = gridSplitQuality({
    sourceLabel: '四宫格', layoutLabel: '2 x 2', uploadedCount: 4,
    createdChildCount: 3, hasUploadError: false,
  })
  assert.equal(summary.status, 'completed')
  assert.match(summary.resultLabel, /3 个子节点/)
})
```

- [ ] **Step 2: Verify RED, then add only derived local state.**

```bash
pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts
```

In `AnnotationPanel`, retain the initial persisted items separately from the current draft (for example a stable serialized persisted state or `persistedItemCount` refreshed only after `onSave`). Derive `hasUnsavedChanges` from normalized annotation content; do not write metadata from the strip and do not change `onSave`.

In `StoryboardGridSplitPanel`, derive uploaded and created counts from its current `CellItem[]`, `createdNodeId`, `status`, layout, and existing error fields. Preserve `onCreateCellNode`, `onUpdateSourceSession`, asset upload behavior, and all current disabled states unchanged.

- [ ] **Step 3: Render one strip in each existing result area.**

```tsx
<ToolResultQualityStrip
  summary={annotationQuality({
    sourceLabel: sourceNode.title || 'Image Node',
    persistedCount,
    draftCount: items.length,
    hasUnsavedChanges,
  })}
/>
```

Place it adjacent to existing factual status text, never over the image/SVG surface or tool controls. Keep the original source lock and the existing Save/Cancel/Undo/Clear buttons.

- [ ] **Step 4: Verify GREEN and existing tool regressions.**

```bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/tool-result-quality.test.ts \
  src/lib/canvas/annotationMetadata.test.ts \
  src/lib/canvas/storyboardGridSplit.test.ts
```

- [ ] **Step 5: Commit release-1 slice A.**

```bash
git add apps/web/src/components/create/StoryboardGridSplitPanel.tsx \
  apps/web/src/components/create/AnnotationPanel.tsx \
  apps/web/src/lib/canvas/tool-result-quality.test.ts
git commit -m "feat: clarify canvas image tool results"
```

## Task 3: Image Tool Evidence — Color Grade Preview

**Files:**
- Modify: `apps/web/src/components/create/ColorGradePalettePanel.tsx`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.test.ts`

- [ ] **Step 1: Write the failing color-grade state matrix.**

```ts
test('labels an edited but unpreviewed grade as not started', () => {
  assert.equal(colorGradeQuality({
    sourceLabel: '节点 A', activeWheelCount: 3, previewReady: false,
    promptAppended: false, derivedDraftCreated: false,
  }).status, 'not-started')
})

test('keeps a created grade node distinct from media generation', () => {
  const summary = colorGradeQuality({
    sourceLabel: '节点 A', activeWheelCount: 1, previewReady: true,
    promptAppended: false, derivedDraftCreated: true,
  })
  assert.match(summary.resultLabel, /调色草案节点/)
  assert.doesNotMatch(summary.resultLabel, /最终图像|已生成/)
})
```

- [ ] **Step 2: Verify RED, then wire existing booleans only.**

```bash
pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts
```

Use `primaryNode`, `activeWheels`, `previewResults`, `applySuccess`, and `createSuccess` as the adapter inputs. Do not modify `handlePreview`, `handleApply`, `handleCreateGradeNode`, or the parent callback contract. The quality strip states clearly that CSS is an approximate local preview and that manual generation remains a separate existing action.

- [ ] **Step 3: Verify GREEN with color-grade helper regression.**

```bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/tool-result-quality.test.ts \
  src/lib/canvas/color-grade-palette.test.ts
```

If the existing color-grade test has a different filename, discover it with `rg --files apps/web/src | rg 'color.*grade.*test'` and run the real test file; do not create a duplicate test harness.

- [ ] **Step 4: Commit release-1 slice B.**

```bash
git add apps/web/src/components/create/ColorGradePalettePanel.tsx \
  apps/web/src/lib/canvas/tool-result-quality.test.ts
git commit -m "feat: clarify canvas color grade preview"
```

## Task 4: Director Review — Continuity Without a Synthetic Score

**Files:**
- Modify: `apps/web/src/components/create/ContinuityCheckerPanel.tsx`
- Modify: `apps/web/src/lib/canvas/continuity-check.ts`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.test.ts`
- Modify: existing `apps/web/src/lib/canvas/continuity-check*.test.ts` if present; otherwise create `apps/web/src/lib/canvas/continuity-check.test.ts`.

- [ ] **Step 1: Add failing categorical-report tests.**

```ts
test('prioritizes risks over warnings in the continuity summary', () => {
  const summary = continuityQuality({ checkedNodeCount: 6, riskCount: 1, warnCount: 4, infoCount: 2 })
  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.statusLabel, /优先处理/)
})

test('does not expose the legacy numeric score in copy-facing report text', () => {
  const text = buildContinuityReportText(reportWithRisks)
  assert.doesNotMatch(text, /综合评分|\/100/)
})
```

- [ ] **Step 2: Verify RED.**

```bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/tool-result-quality.test.ts \
  src/lib/canvas/continuity-check.test.ts
```

- [ ] **Step 3: Replace only display and copied-report scoring.**

Remove `scoreTextColor`, `scoreRingClass`, and the visible circular number from `ContinuityCheckerPanel`. Render `ToolResultQualityStrip` above existing section cards, then retain existing focusable issue cards and "重新检查" behavior. Keep `overallScore` as an internal legacy field only if `analyzeContinuity` consumers require it; do not display or copy it. `buildContinuityReportText` must instead report checked-node count and WARN/RISK/INFO counts.

- [ ] **Step 4: Verify GREEN with existing continuity behavior.**

```bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/tool-result-quality.test.ts \
  src/lib/canvas/continuity-check.test.ts
```

- [ ] **Step 5: Commit release-2 slice A.**

```bash
git add apps/web/src/components/create/ContinuityCheckerPanel.tsx \
  apps/web/src/lib/canvas/continuity-check.ts \
  apps/web/src/lib/canvas/tool-result-quality.test.ts \
  apps/web/src/lib/canvas/continuity-check.test.ts
git commit -m "feat: clarify canvas continuity results"
```

## Task 5: Director Review — Variant, A/B, and Keyframe Evidence

**Files:**
- Modify: `apps/web/src/components/create/AssetVariantPlannerPanel.tsx`
- Modify: `apps/web/src/components/create/ABComparePanel.tsx`
- Modify: `apps/web/src/components/create/KeyframeExtractorPanel.tsx`
- Modify: `apps/web/src/lib/canvas/tool-result-quality.test.ts`

- [ ] **Step 1: Add failing truthful-result tests.**

```ts
test('does not call generated variant plans assets', () => {
  const summary = variantPlannerQuality({ sourceLabel: '参考图', planCount: 4, hasAsset: true })
  assert.equal(summary.status, 'preview')
  assert.match(summary.resultLabel, /4 个变体方向/)
  assert.doesNotMatch(summary.resultLabel, /新资产/)
})

test('does not call an extracted browser frame a persisted asset', () => {
  const summary = keyframeQuality({
    sourceLabel: '镜头 07', hasVideo: true, hasLocalFrame: true,
    extractionFailed: false, createdDraftKind: null,
  })
  assert.equal(summary.status, 'preview')
  assert.doesNotMatch(summary.resultLabel, /已保存资产/)
})
```

- [ ] **Step 2: Verify RED, then map existing local state.**

```bash
pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts
```

Use only values already owned by each panel:
- Variant Planner: selected node, its actual asset presence, and `plans.length`.
- A/B Compare: `comparableNodes.length`, `hasValidPair`, source labels, and the explicit `winner` selection.
- Keyframe Extractor: selected video, `frameDataUrl`, `extracting`, `corsError`, `videoError`, and `created`.

The resulting strip has no direct "create", "generate", "upload", or "save" control. It can describe the existing choices below it; the original buttons keep their current behavior.

- [ ] **Step 3: Render strips in the existing main result sections.**

```tsx
<ToolResultQualityStrip
  summary={abCompareQuality({
    firstLabel: nodeA?.title ?? '版本 A',
    secondLabel: nodeB?.title ?? '版本 B',
    hasValidPair,
    winner,
  })}
/>
```

Keep the current node-focus buttons in their own cards. Do not add a new navigation action from the shared strip.

- [ ] **Step 4: Verify GREEN and component behavior tests.**

```bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/tool-result-quality.test.ts \
  src/components/create/AssetAgentToolbar.test.ts \
  src/components/create/canvas/node-tools/NodeToolCenter.test.tsx
```

- [ ] **Step 5: Commit release-2 slice B.**

```bash
git add apps/web/src/components/create/AssetVariantPlannerPanel.tsx \
  apps/web/src/components/create/ABComparePanel.tsx \
  apps/web/src/components/create/KeyframeExtractorPanel.tsx \
  apps/web/src/lib/canvas/tool-result-quality.test.ts
git commit -m "feat: clarify canvas director tool results"
```

## Task 6: Verification, Browser QA, Documentation, and Delivery

**Files:**
- Modify only after all product/test verification passes: `docs/CURRENT_STATUS.md`, `docs/NEXT_TASKS.md`.

- [ ] **Step 1: Run focused quality-layer and existing tool tests.**

```bash
pnpm --filter web exec tsx --test \
  src/lib/canvas/tool-result-quality.test.ts \
  src/components/create/ToolResultQualityStrip.test.tsx \
  src/lib/canvas/annotationMetadata.test.ts \
  src/lib/canvas/storyboardGridSplit.test.ts \
  src/lib/canvas/continuity-check.test.ts \
  src/components/create/AssetAgentToolbar.test.ts \
  src/components/create/canvas/node-tools/NodeToolCenter.test.tsx
```

Run each test through its actual discovered filename if an audit shows a legacy name differs. Record any pre-existing failure distinctly; never mask it by editing the assertion or narrowing the command.

- [ ] **Step 2: Run required repository validation.**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

- [ ] **Step 3: Audit scope before browser work.**

```bash
git diff --name-only
git diff -- apps/web/src/app/api/generate/image apps/web/src/app/api/generate/video \
  apps/server/prisma package.json pnpm-lock.yaml next.config.js
```

Expected: changes are limited to the shared helper, strip, seven existing Canvas panels, focused tests, and closeout docs. No forbidden path has a diff.

- [ ] **Step 4: Safe authenticated browser QA.**

Use an existing project and existing persisted media only. Verify at desktop and narrow viewport:
1. Grid Split truthfully distinguishes layout/crops from created children.
2. Annotation shows source lock and saved/draft distinction without covering the image/SVG editing surface.
3. Color Grade reads preview-only and retains all original explicit buttons.
4. Continuity exposes categorical real issue counts and existing "定位节点" actions, with no numeric score.
5. Variant, A/B, and Keyframe strips distinguish plans/local frames/selected versions from persisted assets.
6. Opening and closing panels makes no Canvas save, upload, generate, Provider, billing, payment, credits, or wallet request.

Do not click any action that creates a draft, saves, uploads, generates, or calls a Provider. Classify missing authenticated access or unsupported network capture as `AUTH_BLOCKER` or `QA_HARNESS_LIMITATION`, not product passes.

- [ ] **Step 5: Update status documents, commit, push, and verify deployment.**

Document the two release slices, exact test results, safe browser evidence, any harness limitation, and scope audit. Commit the docs separately:

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close canvas tool result quality layer"
git push origin main
```

Wait for Vercel Production Ready, then repeat read-only production browser QA. Report local/preview and Production evidence separately. Do not deploy manually, change env, or use Production DB.

## Self-Review

- **Spec coverage:** Tasks 1–3 deliver the approved shared model and the image-tool release; Tasks 4–5 deliver director-tool coverage and remove the misleading visible continuity score; Task 6 verifies safety, visual consistency, documentation, and delivery.
- **Truthfulness:** Every status derives from a real existing field. Preview, planned, created-draft, saved, failure, and unavailable states remain distinct. No summary calls an intent, prompt, local browser frame, or plan a generated/persisted asset.
- **UI continuity:** The implementation adds one compact strip inside current panels, reusing the dark Canvas palette and existing spacing. It adds no new route, dashboard, modal, left rail, or parallel workbench.
- **Safety:** The shared component is presentational and callback-free; adapters are pure. Existing mutation handlers and all frozen systems remain untouched.
- **Placeholder scan:** Every task identifies exact files, state inputs, commands, and expected behavioral boundaries; no TBD implementation path is left.
