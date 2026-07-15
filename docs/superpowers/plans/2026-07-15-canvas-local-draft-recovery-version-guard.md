# Canvas Local Draft Recovery Version Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep an authorized server canvas authoritative on load while preserving a provably newer, matching local draft behind an explicit recovery choice.

**Architecture:** A pure helper classifies local version markers without browser or React dependencies. `VisualCanvasWorkspace` rejects cross-project records during parsing, renders the authorized server response first, and opens the existing recovery prompt only for a matching unsynced draft. Successful save markers remain synchronized and therefore reload cleanly.

**Tech Stack:** React, TypeScript, Next.js, browser localStorage, Node test runner, `tsx`.

---

### Task 1: Add recovery-decision red tests

**Files:**
- Create: `apps/web/src/lib/canvas/canvasDraftRecovery.test.ts`
- Create: `apps/web/src/lib/canvas/canvasDraftRecovery.ts`

- [ ] **Step 1: Write the failing pure tests**

Test this public contract:

```ts
export type CanvasDraftRecoveryInput = {
  projectId: string
  workflowId: string
  serverUpdatedAt?: string
  serverNodeCount: number
  local?: {
    projectId: string
    workflowId: string
    updatedAt?: string
    syncedAt?: string
    serverUpdatedAt?: string
    nodeCount: number
  } | null
}

export type CanvasDraftRecoveryDecision =
  | { action: 'server'; reason: string }
  | { action: 'prompt-local-recovery'; reason: 'unsynced-local-draft' }

export function decideCanvasDraftRecovery(
  input: CanvasDraftRecoveryInput,
): CanvasDraftRecoveryDecision
```

Cover synchronized, stale, invalid-time, project-mismatch, workflow-mismatch, newer-unsynced, and empty-server cases. Require newer unsynced state to return a prompt action rather than an automatic local-render action.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/web
node_modules/.bin/tsx --test src/lib/canvas/canvasDraftRecovery.test.ts
```

Expected: FAIL because `./canvasDraftRecovery` does not exist.

- [ ] **Step 3: Implement the smallest pure decision helper**

Parse timestamps defensively. Return `server` unless identity matches, node count is positive, and `local.updatedAt` exceeds `max(local.syncedAt, local.serverUpdatedAt, serverUpdatedAt) + 500`.

- [ ] **Step 4: Re-run the focused test and verify GREEN**

Expected: all recovery-decision cases PASS.

### Task 2: Add workspace integration red tests

**Files:**
- Create: `scripts/canvas-local-draft-recovery-static.test.mjs`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`

- [ ] **Step 1: Write static assertions for the integration contract**

Assert that the workspace:

```text
imports and calls decideCanvasDraftRecovery
rejects parsed projectId values that differ from the requested project key
applies server nodes/edges/viewport before evaluating a recovery prompt
populates draftRestorePrompt only for prompt-local-recovery
does not define shouldRestoreLocalCanvas or effectiveNodes/effectiveEdges
labels the secondary action as keeping the server version
```

- [ ] **Step 2: Run the static test and verify RED**

Run:

```bash
node --test scripts/canvas-local-draft-recovery-static.test.mjs
```

Expected: FAIL because the helper is not integrated and the automatic restore branch still exists.

- [ ] **Step 3: Tighten local snapshot normalization**

When `parsed.projectId` exists and differs from the requested project key, return `null`. Continue accepting old records without a stored project ID by assigning the requested key.

- [ ] **Step 4: Replace automatic local restoration with server-first loading**

After the authorized GET:

```ts
const decision = decideCanvasDraftRecovery({
  projectId: resolvedProjectId,
  workflowId: serverWorkflowId,
  serverUpdatedAt: serverUpdatedAtText,
  serverNodeCount: serverNodes.length,
  local: localCandidate ? {
    projectId: localCandidate.value.projectId,
    workflowId: localCandidate.value.workflowId,
    updatedAt: localCandidate.value.updatedAt,
    syncedAt: localCandidate.value.syncedAt,
    serverUpdatedAt: localCandidate.value.serverUpdatedAt,
    nodeCount: localCandidate.value.nodes.length,
  } : null,
})
```

Apply server nodes, edges, and viewport unconditionally. For `prompt-local-recovery`, populate `draftRestorePrompt` and report that a local draft is available without marking the visible server canvas dirty. Otherwise write the synchronized server cache and report `saved`.

- [ ] **Step 5: Make dismissal preserve the visible server version**

Rename `keepServerEmptyCanvas` to `keepServerCanvas`, use the message `继续使用服务器版本`, and update the button label to `使用服务器版本`. Do not issue a PUT.

- [ ] **Step 6: Re-run pure and static tests and verify GREEN**

Run both targeted commands and require all cases to pass.

### Task 3: Run regression and repository gates

**Files:**
- Test: `apps/web/src/lib/canvas/canvasSaveIntegrity.test.ts`
- Test: `scripts/canvas-save-integrity-static.test.mjs`

- [ ] **Step 1: Run save-integrity regressions**

```bash
cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/canvasSaveIntegrity.test.ts
cd ../../ && node --test scripts/canvas-save-integrity-static.test.mjs
```

Expected: all existing save contract tests PASS.

- [ ] **Step 2: Run full gates**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit 0. Existing lint warnings may be reported but no new warning is accepted.

- [ ] **Step 3: Audit boundaries**

Require the diff to exclude schema/migrations, APIs, generate routes, Provider adapters, BYOK, billing, credits, wallet, payment, env files, packages, lockfiles, `next.config.js`, and `cn-executor`.

### Task 4: Publish and verify Production

- [ ] **Step 1: Commit implementation**

```bash
git add apps/web/src/lib/canvas/canvasDraftRecovery.ts \
  apps/web/src/lib/canvas/canvasDraftRecovery.test.ts \
  apps/web/src/components/create/VisualCanvasWorkspace.tsx \
  scripts/canvas-local-draft-recovery-static.test.mjs
git commit -m "fix: guard canvas local draft recovery"
```

- [ ] **Step 2: Push and wait for the matching Vercel Production deployment**

Push `main`, verify `origin/main` equals local HEAD, and require the deployment for that SHA to reach Ready before browser claims.

- [ ] **Step 3: Run authenticated Production Chrome QA**

Open the known two-node QA project and verify the server canvas remains visible instead of the stale one-node draft. Verify any recoverable draft appears only as an explicit prompt, keeping the server does not issue a canvas PUT, and a clean save/reload remains `已同步`. Check project switching and the one-node asset QA project for isolation.

- [ ] **Step 4: Verify boundaries in Production**

Confirm no deliberate Generate, Provider, billing, credits, wallet, payment, recharge, or checkout mutation; no product console error; and no canvas PUT storm. Classify browser tooling limitations separately.

### Task 5: Close documentation

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Record verified evidence**

Record implementation SHA, test counts, full gates, Production deployment SHA, Chrome results, remaining blockers, and forbidden-boundary status. Mark the task closed only after Production evidence passes.

- [ ] **Step 2: Commit and push docs**

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: close canvas draft recovery guard"
git push origin main
```

- [ ] **Step 3: Finalize**

Wait for docs SHA Production Ready, then require local `main`, `origin/main`, and deployment SHA to match and `git status --short` to be empty. Stop without starting the next task.
