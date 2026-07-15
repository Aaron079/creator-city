# Creator City Canvas Commercial Maturity Audit

Date: 2026-07-15
Task: P0-CANVAS-COMMERCIAL-MATURITY-NEXT-AUDIT
Mode: AUDIT_ONLY
Decision: FOUNDER_DECISION_REQUIRED

## Executive Verdict

Creator City can continue feature development and controlled demonstrations, but the canvas is not ready for an unrestricted public beta. The immediate blocker is not missing creative tooling. It is cloud-save integrity: the current API can partially persist a canvas while returning HTTP 200, and the client then reports that the canvas is synchronized.

The recommended next task is `P0-CANVAS-SAVE-INTEGRITY-HARDENING`. No other canvas feature should become the active task until the Founder approves or rejects that priority.

## Evidence Baseline

- Authenticated Production Chrome QA on 2026-07-14 passed login, `/create`, safe Text-node creation, manual cloud save, refresh/reopen recovery, `/projects`, `/dashboard`, `/assets`, `/tasks`, and BYOK-page boundaries.
- Storyboard Grid Split Production QA passed source-image split, four asset uploads, four child nodes, cloud save/reload, and asset-library recovery.
- Project summary count consistency Production QA passed on 2026-07-15.
- This audit was source-level and read-only. A fresh Chrome navigation attempt timed out before leaving `about:blank`; it is classified as `QA_HARNESS_LIMITATION`, not a product failure.
- No real Provider request, payment, schema change, migration, environment change, or Production DB mutation was performed.

## Golden Path Matrix

| Stage | Current evidence | Status | Release requirement |
|---|---|---|---|
| Login | Production registration/login previously passed | PASS | Repeat in final release QA |
| Open `/create` | Production project bootstrap/open passed | PASS | Repeat with existing and new project |
| Project load | Server authorization plus local/server draft conflict handling exists | PASS_WITH_RISK | Test project switching and stale local drafts |
| Create Text/Image nodes | Text safe path and local image import are implemented | PASS | Repeat with mixed node types |
| Prompt and task inputs | Text prompt, local script, local image reference, and upstream strip implemented | PASS_WITH_PROVIDER_LIMIT | Image-to-image reference remains Provider-dependent |
| BYOK selection | UI and read boundaries verified; no automatic Provider POST found | PASS | Final QA must assert zero unexpected Provider requests |
| Generate image | Existing BYOK path implemented | REQUIRES_AUTHORIZED_REAL_QA | No real Provider call in this audit |
| Video | Public path is deliberately blocked/gated | EXPECTED_BLOCK | Keep hidden or clearly unavailable |
| Derived tools | Tool center, source lock, derived nodes, lineage, and edge metadata implemented | PASS_WITH_PENDING_BROWSER_QA | Consolidate old spot checks into one browser pack |
| Annotation | Implemented and locally verified; production authenticated closeout remains historical evidence | PASS_WITH_PENDING_FINAL_QA | Include persistence and normalized-position checks |
| Storyboard split | Production upload/create/save/reload/assets path passed | PASS | Regression test after save hardening |
| Manual cloud save | Basic Production path passed | BLOCKED_BY_INTEGRITY_DEFECTS | Must fail closed on every partial write |
| Refresh/reopen | Basic Text and split-node restoration passed | PASS_WITH_RISK | Validate partial failure, timeout, and project switching |
| Asset library recovery | Production split assets found in `/assets` | PASS | Test missing-asset fallback |
| Cross-browser recovery | Shot sequence QA and camera/lighting context remain incomplete | NOT_PROVEN | Required before public beta |

## P0 Launch Blockers

### P0-1 False Cloud-Save Success

`apps/web/src/app/api/projects/[projectId]/canvas/route.ts` collects failed node and edge writes, but still returns `jsonOk` with `partialSave: true`. `VisualCanvasWorkspace.tsx` does not parse `partialSave`, `failedNodeIds`, or `failedEdgeIds`; it clears deletion queues and displays `已同步到云端` for any successful HTTP response.

Impact: a user can receive a success message while nodes or edges are missing after refresh. Failed deletions are also logged and ignored, so deleted content can reappear while the client reports success.

Required gate:

- Any failed node, edge, workflow-metadata, or deletion write must produce a non-success save result.
- The client must preserve unsynced/deletion state and show an actionable retry state.
- Tests must prove that partial writes never produce a saved indicator.

### P0-2 Queued Save Is Dropped

When a save is in flight, the client sets `pendingSaveRef.current = true`. The `finally` block then resets the flag to false without executing another save.

Impact: edits made during an explicit save can remain only in the local draft while the earlier snapshot is reported as synchronized.

Required gate:

- Drain exactly one coalesced pending save after the active request completes.
- Preserve latest snapshot semantics across success, timeout, and retry.
- Add deterministic concurrent-save tests.

### P0-3 Client and Server Save Deadlines Conflict

The client aborts after 15 seconds. The route wrapper returns a 503 after 20 seconds, while the underlying database operation is not cancelled and contains a separate 52-second soft deadline.

Impact: the browser can report failure and retry while the original write is still running, increasing pool pressure and creating ambiguous persistence order.

Required gate:

- Use one explicit deadline contract with request version or equivalent stale-write protection.
- Ensure late work cannot overwrite a newer accepted snapshot.
- Verify timeout/retry behavior against a real PostgreSQL-compatible test environment.

## P1 Before Public Beta

### P1-1 Cross-Browser Director Context Loss

Per-node camera and scene-lighting settings are stored only in browser `localStorage`. They are not part of the cloud canvas payload and therefore do not follow the project to another browser.

Decision required: either persist this context in existing node metadata without a schema change, or label it as device-local and exclude it from the public cross-browser promise.

### P1-2 Recovery Guard Is Not Project-Scoped

`reloadRecoveryDoneRef` is a single component-lifetime boolean. After recovery runs for one project, switching projects can suppress pending-generation asset recovery in the next project.

Required gate: scope/reset the guard by `projectId` and `workflowId`, then test two projects in one session.

### P1-3 Performance Baseline Is Missing

The main canvas workspace is 10,656 lines and currently contains 63 `useState`, 31 `useEffect`, and 24 `fetch` call sites. The `/create` production build baseline is approximately 338 kB route size and 524 kB first-load JavaScript. There is no recorded 20/50/100-node latency, request-count, memory, pan/zoom, or save-time gate.

Required gate: measure first, then fix observed bottlenecks. Do not begin a broad refactor without a reproducible profile.

### P1-4 Browser Regression Harness Is Missing

The web app has 18 source-level unit/static test files but no Playwright/Cypress E2E configuration, and `apps/web/package.json` has no test script. Canvas save protocol, partial failure, project switching, and browser network/console boundaries are not part of a standard automated gate.

Required gate: add a safe, deterministic browser suite after the P0 save contract is fixed. Any package or lockfile change needs explicit scope approval.

### P1-5 Pending Browser QA Is Fragmented

The queue contains old `TODO`, `NEXT`, or `WAITING_QA` rows for left rail, node toolbar, camera/lighting isolation, derived edge labels, visual polish, modal manager, generation dialog, generation reliability, and shot-sequence cloud persistence, even though later shell and combined closeouts depend on some of those rows.

Required gate: run one consolidated authenticated Chrome pack and close or reopen each legacy row from evidence. Do not execute stale rows independently.

## P2 Later

- Split the canvas workspace and `/create` page along measured ownership boundaries.
- Continue visual polish only after save integrity, Golden Path, and performance gates pass.
- Resume Storyboard Script V1 after the commercial baseline is stable.
- Keep AI Director, Asset Remix infrastructure, deep payment hardening, and paid recharge outside this canvas sequence until explicitly resumed.

## Normalized Task Order

1. `P0-CANVAS-SAVE-INTEGRITY-HARDENING` - Founder approval required.
2. `P0-CANVAS-COMMERCIAL-MATURITY-GOLDEN-PATH-QA` - blocked by save integrity.
3. `P0-CANVAS-PENDING-BROWSER-QA-CONSOLIDATION` - may run inside the Golden Path session after save integrity passes.
4. `P1-CANVAS-PERFORMANCE-AND-REQUEST-STORM-CLEANUP` - profile 20/50/100 nodes, then apply scoped fixes.
5. `P1-CANVAS-E2E-REGRESSION-HARNESS` - automate the proven Golden Path and network/console boundaries.
6. `P0-CANVAS-STORYBOARD-SCRIPT-V1` - next product feature after the commercial baseline.
7. Reference-image real Provider QA - only with explicit account/budget authorization.
8. Guided first-user trial, then public-beta decision.

## Release Gate

Public beta requires all of the following:

- P0 launch blockers = 0.
- Blocking P1 issues = 0 or explicitly removed from the public promise.
- No false cloud-save success under partial DB failure or timeout.
- Golden Path passes in authenticated Production Chrome, including refresh, project switch, asset recovery, and a second browser/profile.
- 20/50/100-node performance thresholds and request/console boundaries pass.
- No automatic Provider request, duplicate generation, duplicate billing, PUT storm, 401 loop, API 5xx storm, unhandled rejection, hydration error, or React update-depth error.
- Video and other unavailable features are hidden or honestly blocked.
- Paid recharge remains unavailable until payment integrity review is unblocked and separately approved.

## Scope Boundary

- Product code changed: No
- API changed: No
- Schema or migration changed: No
- Generate routes changed: No
- Provider or BYOK semantics changed: No
- Billing/payment/credits/wallet changed: No
- `cn-executor` changed: No
- Environment changed: No
- Production DB changed: No
