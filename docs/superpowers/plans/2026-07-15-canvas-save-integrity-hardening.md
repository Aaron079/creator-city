# Canvas Save Integrity Hardening Implementation Plan

> **For agentic workers:** Execute this plan inline with test-driven development. Keep the change inside the active canvas save client, canvas PUT route, focused helpers/tests, and task documentation.

**Goal:** Make every canvas cloud-save acknowledgement truthful, serialize saves from one browser, reject stale concurrent snapshots, and keep retries recoverable without schema changes.

**Architecture:** Add a small shared save-contract helper for response validation, deadline constants, and pending-save consumption. The client sends the last known workflow `updatedAt` as `baseUpdatedAt`, drains one coalesced save after an in-flight request, and never clears deletion state on a failed or partial acknowledgement. The route uses a conditional workflow `updateMany` as an optimistic write reservation before node/edge writes, returns fail-closed 409/503 responses with the reserved server version, and removes the detached `Promise.race` timeout so no request continues writing after its response.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma 5, Node test runner, `tsx`.

---

## Task 1: Add the shared save contract with failing tests

**Files:**
- Create: `apps/web/src/lib/canvas/canvasSaveIntegrity.test.ts`
- Create: `apps/web/src/lib/canvas/canvasSaveIntegrity.ts`

1. Write tests proving that a save is rejected when HTTP is non-OK, `success === false`, `partialSave === true`, or either failed-ID array is non-empty.
2. Write tests proving that a clean success is acknowledged, a pending-save flag is consumed exactly once, and the client timeout is greater than the server deadline but below Vercel's 60-second ceiling.
3. Run `cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/canvasSaveIntegrity.test.ts` and record the expected module-not-found failure.
4. Implement the minimal contract:

```ts
export const CANVAS_SAVE_SERVER_DEADLINE_MS = 45_000
export const CANVAS_SAVE_CLIENT_TIMEOUT_MS = 55_000

export type CanvasSaveResponseData = {
  success?: boolean
  message?: string
  partialSave?: boolean
  failedNodeIds?: string[]
  failedEdgeIds?: string[]
  savedAt?: string
  serverUpdatedAt?: string
  details?: { serverUpdatedAt?: string }
}

export function canvasSaveFailure(
  responseOk: boolean,
  data: CanvasSaveResponseData,
): string | null

export function consumePendingCanvasSave(
  pendingRef: { current: boolean },
): boolean
```

5. Re-run the targeted test and require all cases to pass.

## Task 2: Add a failing static route/client contract test

**Files:**
- Create: `scripts/canvas-save-integrity-static.test.mjs`

1. Assert the route no longer contains a save `Promise.race` or 20-second detached response timer.
2. Assert the route accepts `baseUpdatedAt`, reserves the workflow with `updateMany`, and returns `CANVAS_SAVE_CONFLICT` when the version does not match.
3. Assert node, edge, clear, and deletion failures return `CANVAS_PARTIAL_SAVE` instead of reaching `jsonOk`.
4. Assert the client sends `baseUpdatedAt`, calls `canvasSaveFailure`, preserves deletion queues until acknowledged, and schedules `saveCanvasRef.current()` when `consumePendingCanvasSave` returns true.
5. Run `node --test scripts/canvas-save-integrity-static.test.mjs` and record the expected failure before changing production code.

## Task 3: Make the server save route fail closed and ordered

**Files:**
- Modify: `apps/web/src/app/api/projects/[projectId]/canvas/route.ts`

1. Import `CANVAS_SAVE_SERVER_DEADLINE_MS`.
2. Replace the outer `Promise.race` with one awaited `putImpl` call and pass a single `saveStart` timestamp.
3. Accept optional `baseUpdatedAt` for backward compatibility.
4. Before node writes, reserve the workflow version with:

```ts
const reservation = body.baseUpdatedAt
  ? await db.canvasWorkflow.updateMany({
      where: { id: workflow.id, updatedAt: new Date(body.baseUpdatedAt) },
      data: { updatedAt: now },
    })
  : { count: 1 }
```

5. Return 409 `CANVAS_SAVE_CONFLICT` with the current server version when `reservation.count !== 1`.
6. Apply viewport/workflow metadata through the reserved workflow update, so the version and metadata change together.
7. After each write stage, return 503 `CANVAS_PARTIAL_SAVE` with failed IDs and `serverUpdatedAt: now.toISOString()` when any operation fails.
8. Treat clear-canvas and deleted-node/deleted-edge failures as blocking save failures.
9. Keep `lastOpenedAt` best effort, empty-node protection, ownership checks, payload limits, source media preservation, and schema-error classification unchanged.
10. Use `CANVAS_SAVE_SERVER_DEADLINE_MS` at stage boundaries and never return while another route promise continues writing.

## Task 4: Make the client acknowledgement and queue truthful

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`

1. Import the save-contract helper and constants.
2. Add `saveCanvasRef` and `serverSaveVersionRef` refs.
3. Populate the server-version ref from project ensure/load, server-version selection, successful draft restore, and successful save responses.
4. Send `baseUpdatedAt: serverSaveVersionRef.current` in the primary save request.
5. Replace the 15-second timeout with `CANVAS_SAVE_CLIENT_TIMEOUT_MS`.
6. Parse `partialSave`, failed-ID arrays, and error details. Update only the in-memory server-version ref from an error detail; do not mark the local snapshot synced.
7. Call `canvasSaveFailure(response.ok, data)` before clearing deletion queues or setting `saved`.
8. In `finally`, release the in-flight lock, consume the pending flag once, and queue the latest save through `saveCanvasRef.current` unless the component is switching projects.
9. Reuse `canvasSaveFailure` for draft restore and shot-sequence cloud save so no PUT caller accepts a partial acknowledgement.
10. Preserve local-only autosave, emergency 401 draft behavior, explicit manual cloud-save semantics, and project-switch abort behavior.

## Task 5: Verify the focused behavior

1. Run `cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/canvasSaveIntegrity.test.ts`.
2. Run `node --test scripts/canvas-save-integrity-static.test.mjs`.
3. Re-run both tests together after refactoring.
4. Review the route to confirm no success path includes `partialSave` or ignored deletion catches.
5. Review the client to confirm deletion queues are cleared only after `canvasSaveFailure` returns null.

## Task 6: Run repository gates and boundary checks

1. Run `pnpm type-check`.
2. Run `pnpm lint` and classify only pre-existing warnings as non-blocking.
3. Run `pnpm build`.
4. Run `git diff --check`.
5. Require `git diff --name-only` to contain no Prisma/schema/migration, env, payment, credits, wallet, billing, Provider adapter, BYOK, generation route, `cn-executor`, `package.json`, `pnpm-lock.yaml`, or `next.config.js` changes.
6. Review the complete diff for accidental canvas behavior changes outside save/recovery.

## Task 7: Commit, push, and production QA

1. Commit implementation and tests with `fix: harden canvas save integrity`.
2. Push `main` and wait for the matching Vercel Production deployment to become Ready.
3. In authenticated Production Chrome, verify one manual save, immediate second save while the first is active, refresh/reopen, deletion persistence, project switch, and a stale second-tab save conflict.
4. Assert no automatic Provider/generate/payment request, no PUT storm, no product console error, and no API 5xx storm.
5. Classify browser-control failures separately as `QA_HARNESS_LIMITATION`.

## Task 8: Close documentation

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

1. Record implementation SHA, targeted tests, repository gates, browser evidence, and forbidden-boundary results.
2. Unblock Golden Path QA only if Production save/reload evidence passes.
3. Commit documentation with `docs: close canvas save integrity hardening`.
4. Push, wait for Vercel Production Ready, confirm local/remote/deployment SHA equality, and require a clean worktree.
