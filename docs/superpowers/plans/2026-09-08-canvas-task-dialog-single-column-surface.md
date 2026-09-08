# Canvas Task Dialog Single-Column Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing selected-node Task dialog a compact vertical column where only the prompt body scrolls.

**Architecture:** Retain current component ownership: `UpstreamTaskStrip`, `LocalReferenceStrip`, `CanvasPromptBox`, and billing controls. Remove the compact-mode two-column placement, keep source/reference and account content horizontally scrollable inside full-width fixed lanes, and compute height by summing every fixed vertical region. Node/navigation/dialog anchoring remains unchanged.

**Tech Stack:** React, TypeScript, CSS Modules, Node test runner, Playwright Chromium, Next.js.

---

## File Structure

- Modify `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts`: compact height calculation.
- Modify `apps/web/src/components/create/canvas.module.css`: compact Task layout rules.
- Modify `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`: source-layout contract.
- Modify `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx`: rendered visual contract.
- Modify `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` only during closeout.

### Task 1: Establish the failing static layout contract

**Files:**

- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts:480-530`
- Test: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`

- [ ] **Step 1: Add this test beside the current fixed-surfaces source tests**

```ts
test('keeps compact task controls in one vertical column', () => {
  const marker = '/* Node task dialog fixed surfaces */'
  const finalRules = canvasModuleSource.slice(canvasModuleSource.lastIndexOf(marker))

  assert.match(
    finalRules,
    /\.canvas-node-dialog\.is-compact-fixed-controls\) \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/,
  )
  assert.doesNotMatch(finalRules, /\.canvas-node-dialog\.is-compact-fixed-controls\) \{[\s\S]*?display: grid;/)
  assert.doesNotMatch(finalRules, /\.canvas-node-dialog\.is-compact-fixed-controls[\s\S]*?grid-column: 2;/)
  assert.match(
    layoutSource,
    /const fixedHeight = measurements\.fixedTopHeight\s*\+ measurements\.fixedBottomHeight\s*\+ measurements\.promptChromeHeight/,
  )
})
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts
```

Expected: FAIL because current final CSS uses `display: grid` and compact sizing uses `Math.max`.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts
git commit -m "test: lock compact task dialog column layout"
```

### Task 2: Establish the failing Chromium visual contract

**Files:**

- Modify: `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx:440-499`
- Test: `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx`

- [ ] **Step 1: Replace the shared-row assertion**

Replace:

```ts
assert.ok(Math.abs(topBox.y - bottomBox.y) < 1, 'fixed controls must share the compact top row')
```

with:

```ts
assert.ok(topBox.y + topBox.height <= headerBox.y, 'top context rail must precede the prompt header')
assert.ok(footerBox.y + footerBox.height <= bottomBox.y, 'billing rail must follow the prompt footer')
assert.ok(Math.abs(topBox.width - dialogBox.width) < 1, 'top context rail must use full dialog width')
assert.ok(Math.abs(bottomBox.width - dialogBox.width) < 1, 'billing rail must use full dialog width')
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
```

Expected: FAIL because `#fixed-top` and `#fixed-bottom` share the first compact grid row.

- [ ] **Step 3: Commit the failing rendered test**

```bash
git add apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
git commit -m "test: require vertical task dialog control rails"
```

### Task 3: Replace the compact two-column CSS layout

**Files:**

- Modify: `apps/web/src/components/create/canvas.module.css:8533-8547,8726-8734`
- Test: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`
- Test: `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx`

- [ ] **Step 1: Delete compact grid placement**

Delete the `display: grid`, `grid-template-columns`, `grid-template-rows`, `grid-column`, and `grid-row` declarations for the compact dialog, fixed top, prompt box, and fixed bottom selectors in the final fixed-surfaces block.

- [ ] **Step 2: Add this full-width compact replacement in that block**

```css
.scope :global(.canvas-node-dialog.is-compact-fixed-controls) {
  display: flex;
  flex-direction: column;
}

.scope :global(.canvas-node-dialog.is-compact-fixed-controls .canvas-node-dialog-fixed-controls.is-top),
.scope :global(.canvas-node-dialog.is-compact-fixed-controls .canvas-node-dialog-fixed-controls.is-bottom) {
  width: 100%;
}
```

Leave the existing `overflow-x: auto` ownership on `.canvas-node-dialog-fixed-controls`; do not move JSX, callbacks, billing modes, accounts, uploads, or generation controls.

- [ ] **Step 3: Verify partial GREEN**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts
pnpm --filter web exec tsx --test src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
```

Expected: static source contract passes; rendered test may expose insufficient prompt height, fixed in Task 4.

- [ ] **Step 4: Commit CSS correction**

```bash
git add apps/web/src/components/create/canvas.module.css apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
git commit -m "fix: stack compact task dialog controls"
```

### Task 4: Measure fixed control rails vertically

**Files:**

- Modify: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts:83-92`
- Test: `apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts`
- Test: `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx`

- [ ] **Step 1: Replace the compact/noncompact branch**

Replace:

```ts
const fixedHeight = compactFixedControls
  ? Math.max(measurements.fixedTopHeight, measurements.fixedBottomHeight)
    + measurements.promptChromeHeight
  : measurements.fixedTopHeight
    + measurements.fixedBottomHeight
    + measurements.promptChromeHeight
```

with:

```ts
const fixedHeight = measurements.fixedTopHeight
  + measurements.fixedBottomHeight
  + measurements.promptChromeHeight
```

Do not modify max height, stage margins, node/dialog anchoring, or automatic pan logic.

- [ ] **Step 2: Verify GREEN**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts
pnpm --filter web exec tsx --test src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
```

Expected: Text script, image upload/done, image BYOK missing-Endpoint, and video fixtures retain reachable controls, one scrollable prompt body, and vertically ordered fixed rails.

- [ ] **Step 3: Commit sizing correction**

```bash
git add apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts apps/web/src/components/create/canvas/canvasWorkspaceLayout.test.ts apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
git commit -m "fix: measure task dialog rails vertically"
```

### Task 5: Validate and close out Preview

**Files:**

- Verify: `apps/web/src/components/create/CanvasPromptBox.task-layout.test.ts`
- Modify: `docs/CURRENT_STATUS.md:3`
- Modify: `docs/NEXT_TASKS.md:10`

- [ ] **Step 1: Run focused regression coverage**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx src/components/create/CanvasPromptBox.task-layout.test.ts
```

Expected: all focused contracts pass at supported and 390x300 constrained dimensions.

- [ ] **Step 2: Run repository gates**

```bash
pnpm type-check
pnpm lint
pnpm --filter web build
pnpm agent:check
git diff --check
```

Expected: type-check/build/agent/diff PASS; lint only reports documented pre-existing warnings.

- [ ] **Step 3: Run browser verification**

Verify in Chromium: navigation → node → dialog order; top rail → prompt header → scrollable prompt → footer → billing rail order; no compact split column; no harness console error or 5xx. Do not click Generate.

- [ ] **Step 4: Record, push, and deploy Preview only**

Update the two fact-source documents with commits, test evidence, Preview URL, and any authenticated-browser limitation. Then run:

```bash
git push origin codex/video-gate-qa
pnpm dlx vercel@50.3.1 ls --yes
```

Wait for the branch Preview to be `Ready`, smoke `/` and unauthenticated `/create`, commit the docs, push them, and wait for that final Preview deployment. Do not deploy Production.

## Plan Self-Review

- The plan covers the screenshot root cause in CSS and the matching height calculation.
- The plan preserves all component ownership and behavioral boundaries from the approved specification.
- Every production change has a preceding failing test and an exact verification command.
