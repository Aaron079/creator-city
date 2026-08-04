# Canvas Delivery Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Close the repository-controlled Canvas delivery gaps with a viewport-safe Keyframe Extractor, canonical Preview evidence, and a truthful release gate.

**Architecture:** Keep Keyframe Extractor as a compact Canvas floating surface. Constrain its shell to the viewport and use its existing independent scroll body and focus-node footer; preserve its two explicit draft buttons. Reuse the existing Chromium component harness, guarded Preview registration fixture, and render-planning contracts. Production validation remains read-only.

**Tech Stack:** Next.js/React, Tailwind utility classes, Node test runner, Playwright, Vercel Preview and Production.

---

### Task 1: Make Keyframe Extractor viewport-safe

**Files:**
- Modify: \`apps/web/src/components/create/KeyframeExtractorPanel.tsx:252-279,497-511\`
- Modify: \`apps/web/src/lib/canvas/tool-result-quality.test.ts:245-275,350-380\`
- Modify: \`apps/web/tests/e2e/canvas-preview-local-import.spec.ts:279-315\`

- [ ] **Step 1: Write the failing component viewport regression**

In \`tool-result-quality.test.ts\`, add a test using the existing \`renderClientPanel('keyframe-extract')\` harness. Set each page viewport to \`{ width: 1280, height: 720 }\` and \`{ width: 390, height: 844 }\`; locate the dialog, unique close control, and \`定位到视频节点\` footer button. Require each bounding box to be inside the viewport with a 16px safety margin.

\`\`\`ts
test('keeps keyframe extractor controls inside desktop and narrow viewports', async () => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const page = await renderClientPanel('keyframe-extract')
    await page.setViewportSize(viewport)
    const dialog = page.getByRole('dialog', { name: '关键帧提取' })
    const close = page.getByRole('button', { name: '关闭关键帧提取' })
    const footer = page.getByRole('button', { name: '定位到视频节点' })
    for (const box of await Promise.all([dialog.boundingBox(), close.boundingBox(), footer.boundingBox()])) {
      assert.ok(box)
      assert.ok(box.x >= 15)
      assert.ok(box.y >= 15)
      assert.ok(box.x + box.width <= viewport.width - 15)
      assert.ok(box.y + box.height <= viewport.height - 15)
    }
    await page.close()
  }
})
\`\`\`

- [ ] **Step 2: Run the focused test to verify RED**

\`\`\`bash
pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts --test-name-pattern="keyframe extractor controls"
\`\`\`

Expected: FAIL because the existing panel lacks dialog semantics, a unique close label, and constrained top/bottom bounds.

- [ ] **Step 3: Apply the minimal floating-shell layout change**

Replace the translate-centered outer panel class with a fixed bounded shell. The implementation must use these structural properties:

\`\`\`tsx
<aside
  className="fixed bottom-4 left-4 top-4 z-[1200] flex w-[calc(100vw-32px)] max-w-[400px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl md:left-20"
  role="dialog"
  aria-modal="true"
  aria-label="关键帧提取"
  data-no-node-drag="true"
  onPointerDown={(event) => event.stopPropagation()}
>
\`\`\`

Keep the existing body as \`min-h-0 flex-1 overflow-y-auto\`, make the footer \`flex-shrink-0\`, and change the header button to \`aria-label="关闭关键帧提取"\`. Do not change the video, extraction, draft creation, provenance, or focus-node callbacks.

- [ ] **Step 4: Run focused component and provenance regressions**

\`\`\`bash
pnpm --filter web exec tsx --test src/lib/canvas/tool-result-quality.test.ts
\`\`\`

Expected: all Keyframe quality, provenance, cancellation, and new viewport tests pass.

- [ ] **Step 5: Update the guarded Preview video flow**

Change only the close selector in \`canvas-preview-local-import.spec.ts\` to \`getByRole('button', { name: '关闭关键帧提取' })\`. After clicking it, assert the Keyframe dialog is absent before saving.

- [ ] **Step 6: Run Preview video regression**

\`\`\`bash
PLAYWRIGHT_SAFE_ENV=preview PLAYWRIGHT_ALLOW_SAFE_WRITES=1 PLAYWRIGHT_PREVIEW_E2E_REGISTER=1 PLAYWRIGHT_BASE_URL=https://<safe-preview-host> PLAYWRIGHT_SAFE_PREVIEW_HOST=<safe-preview-host> pnpm --filter web exec playwright test tests/e2e/canvas-preview-local-import.spec.ts -g "local video" --config=playwright.canvas.config.ts --reporter=line
\`\`\`

Expected: one pass. It imports a disposable WebM, creates two explicit drafts, closes the tool panel, saves, reloads, and sees the restored nodes with no forbidden mutation or page error.

- [ ] **Step 7: Commit the scoped implementation**

\`\`\`bash
git add apps/web/src/components/create/KeyframeExtractorPanel.tsx apps/web/src/lib/canvas/tool-result-quality.test.ts apps/web/tests/e2e/canvas-preview-local-import.spec.ts
git diff --cached --check
git commit -m "fix: constrain keyframe tool panel to viewport"
\`\`\`

### Task 2: Consolidate Canvas QA evidence

**Files:**
- Modify: \`docs/CURRENT_STATUS.md\`
- Modify: \`docs/NEXT_TASKS.md\`

- [ ] **Step 1: Run the complete guarded Preview Canvas suite**

\`\`\`bash
PLAYWRIGHT_SAFE_ENV=preview PLAYWRIGHT_ALLOW_SAFE_WRITES=1 PLAYWRIGHT_PREVIEW_E2E_REGISTER=1 PLAYWRIGHT_BASE_URL=https://<safe-preview-host> PLAYWRIGHT_SAFE_PREVIEW_HOST=<safe-preview-host> pnpm --filter web exec playwright test tests/e2e/canvas-preview-local-import.spec.ts --config=playwright.canvas.config.ts --reporter=line
\`\`\`

Expected: five passes for local image import, independent-context recovery, freeform reference extraction, local video/keyframe drafts, and local storyboard sketch recovery.

- [ ] **Step 2: Verify the existing tooling and performance contracts**

\`\`\`bash
pnpm --filter web exec tsx --test src/components/create/canvas/canvasWorkspaceLayout.test.ts src/components/create/canvas/canvasRenderPlanning.test.ts
\`\`\`

Expected: compact task-dialog layout and 20/50/100-node render planning contracts pass.

- [ ] **Step 3: Audit historical QA rows against current evidence**

Update only task rows directly covered by fresh evidence:

- Mark \`P1-CANVAS-TOOL-PANEL-VIEWPORT-CONSTRAINT\` closed only after Task 1 passes.
- Mark \`P0-CANVAS-PENDING-BROWSER-QA-CONSOLIDATION\` closed only if the Preview suite passes and the final Production smoke is read-only and clean.
- Keep \`P1-CANVAS-TOOL-PANEL-MIGRATION-PHASE-1-QA\` as a discrete read-only Production verification if Camera/Lighting cannot be truthfully exercised by the isolated Preview test.
- Do not alter payment, executor, or external-environment blocker rows.

- [ ] **Step 4: Commit QA status consolidation**

\`\`\`bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: consolidate canvas delivery QA"
\`\`\`

### Task 3: Run the delivery release gate

**Files:**
- Modify: \`docs/CURRENT_STATUS.md\`
- Modify: \`docs/NEXT_TASKS.md\`

- [ ] **Step 1: Run repository checks**

\`\`\`bash
pnpm --filter web type-check
pnpm --filter web lint
pnpm --filter web build
pnpm agent:check
git diff --check
\`\`\`

Expected: commands succeed; any pre-existing lint warnings are reported as warnings rather than silently ignored.

- [ ] **Step 2: Push and wait for Vercel**

\`\`\`bash
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
\`\`\`

Expected: local and remote SHA match, then Vercel reports the exact commit Ready.

- [ ] **Step 3: Perform a Production read-only smoke check**

Open the existing authenticated Production Canvas in Chrome. Read only the existing Canvas, NodeToolCenter, task/tool/asset entry, and browser console. Do not create, save, upload, invoke a tool action, generate, call a Provider, or make payment-related requests. Record product errors separately from harness failures.

- [ ] **Step 4: Record final outcome and commit docs**

Record exact test counts, deployment SHA/state, Preview-only write boundary, Production read-only outcome, and any retained external blockers. Do not claim a Production write test.

\`\`\`bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close canvas delivery QA"
git push origin main
\`\`\`

- [ ] **Step 5: Final clean-worktree verification**

\`\`\`bash
git status --short
git diff --check
git rev-parse HEAD
git rev-parse origin/main
\`\`\`

Expected: clean worktree and matching local/remote SHA.
