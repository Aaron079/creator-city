# Canvas Golden Path Independent Context QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that a Preview-only canvas project restores cloud-saved content in a fresh authenticated browser context without the first context's local state.

**Architecture:** Reuse the guarded Preview registration fixture to create a disposable user and project. The first Playwright context imports the existing in-memory PNG and saves it. A second new context gets authentication cookies through `storageState`, but starts with no first-context local storage, opens the same project, and asserts the asset node is restored. Both contexts reject generation, Provider, payment, billing, credit, wallet, recharge, and checkout mutations.

**Tech Stack:** Playwright, existing Preview safety fixture, Next.js Preview deployment.

---

### Task 1: Add the independent-context Golden Path regression

**Files:**
- Modify: `apps/web/tests/e2e/canvas-preview-local-import.spec.ts`
- Test: `apps/web/tests/e2e/canvas-preview-local-import.spec.ts`

- [x] **Step 1: Write the failing test**

Add a test that registers a Preview-only user, imports the PNG fixture, saves, captures `context.storageState()`, calls `browser.newContext({ storageState })`, and requires one `media-preview-image` plus one canvas node after the second page opens the same project URL.

- [x] **Step 2: Run the focused test to verify RED**

```bash
PLAYWRIGHT_SAFE_ENV=preview PLAYWRIGHT_ALLOW_SAFE_WRITES=1 PLAYWRIGHT_PREVIEW_E2E_REGISTER=1 PLAYWRIGHT_BASE_URL=https://<approved-preview-host> PLAYWRIGHT_SAFE_PREVIEW_HOST=<approved-preview-host> pnpm --filter web exec playwright test tests/e2e/canvas-preview-local-import.spec.ts -g "independent authenticated context" --config=playwright.canvas.config.ts --reporter=line
```

Expected: FAIL because the regression does not exist yet.

- [x] **Step 3: Implement the minimal test-only verification**

Import Playwright's `Browser` type and add the test using a `try/finally` to close the second context. Do not alter application code, credentials, deployment configuration, or product routes.

- [x] **Step 4: Run the focused test to verify GREEN**

Re-run Step 2 and require one passed test, zero forbidden mutations, and zero page errors in both contexts.

- [x] **Step 5: Run the existing Preview canvas regression suite**

```bash
PLAYWRIGHT_SAFE_ENV=preview PLAYWRIGHT_ALLOW_SAFE_WRITES=1 PLAYWRIGHT_PREVIEW_E2E_REGISTER=1 PLAYWRIGHT_BASE_URL=https://<approved-preview-host> PLAYWRIGHT_SAFE_PREVIEW_HOST=<approved-preview-host> pnpm --filter web exec playwright test tests/e2e/canvas-preview-local-import.spec.ts --config=playwright.canvas.config.ts --reporter=line
```

Outcome: the four non-video guarded Preview flows passed. The video-keyframe flow failed because its close control was outside a 1280x720 viewport; this is recorded as `P1-CANVAS-TOOL-PANEL-VIEWPORT-CONSTRAINT` and is not masked as a test-only issue.

### Task 2: Record and publish the QA conclusion

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [x] **Step 1: Record the exact independent-context evidence**

Change `P0-CANVAS-COMMERCIAL-MATURITY-GOLDEN-PATH-QA` to `VALIDATED / CLOSED` only when the second context restores saved nodes and asset with no forbidden mutation or page error. Otherwise retain `PARTIAL` and document the observed blocker.

- [ ] **Step 2: Verify repository boundaries**

```bash
git diff --check
git diff --name-only
```

Expected: only this plan, the Preview E2E test, and the two task-status documents change.

- [ ] **Step 3: Commit and push QA-only evidence**

```bash
git add apps/web/tests/e2e/canvas-preview-local-import.spec.ts docs/superpowers/plans/2026-08-04-canvas-golden-path-independent-context-qa.md docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "test: verify canvas recovery in independent context"
git push origin main
```

Expected: one QA-only commit on `main`. Observe Vercel's deployment result before reporting closure.
