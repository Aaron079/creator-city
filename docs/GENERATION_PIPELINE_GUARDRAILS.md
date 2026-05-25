# Generation Pipeline Guardrails

Rules that protect the stable generation chain. Read before touching any file in this list.

## Confirmed Stable (2026-05-25)

Both chains production-confirmed working:
- **Image**: Seedream → OSS → stableUrl → node display → refresh persists ✅
- **Video**: Seedance → OSS → stableUrl → node preview/playback → refresh persists ✅
- **Video status**: degraded mode (no session cookie) returns safe status without 401 ✅

## Protected Files — Change Requires Explicit Justification

| File | Risk |
|------|------|
| `apps/web/src/app/api/generate/image/route.ts` | Image generation main chain — FROZEN |
| `apps/web/src/app/api/generate/video/route.ts` | Video generation main chain — FROZEN |
| `apps/web/src/app/api/generate/image/status/route.ts` | Image polling + stall detection — FROZEN |
| `apps/web/src/app/api/generate/video/status/route.ts` | Video polling + degraded-mode auth — FROZEN |
| `apps/cn-executor/src/handlers/generateImage.ts` | Seedream → OSS pipeline |
| `apps/cn-executor/src/handlers/jobRunner.ts` | Job execution orchestration |
| `apps/cn-executor/src/oss.ts` | OSS upload with retry + error classification |
| `apps/cn-executor/src/volcengine.ts` | Seedream API caller |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | Canvas save/load + node display |

If you must touch a protected file, state why, what you changed, and how you verified the generation chain still works.

---

## Payload Contracts (must not expand without approval)

### Image generation payload (frontend → /api/generate/image)
```json
{
  "prompt": "string",
  "providerId": "string",
  "aspectRatio": "16:9",
  "projectId": "string",
  "workflowId": "string",
  "nodeId": "string"
}
```

### Video generation payload (frontend → /api/generate/video)
```json
{
  "prompt": "string",
  "providerId": "string",
  "aspectRatio": "16:9",
  "duration": 5,
  "projectId": "string",
  "workflowId": "string",
  "nodeId": "string"
}
```

**Permanently banned from image/video payloads:**
- `compiledPrompt` — prompt injection from complex tools
- `system` — system prompt injection
- `inputAssets` — upstream asset chaining
- `styleBible` / `sceneBible` / `characterBible` — style injection
- `skills` / `enabledCreatorSkills` — skill injection
- `storyboard` / `casting` — director tool injection

These fields MAY exist in the text node code path (`callGenerationApi` else branch). They must never be added to the image or video branches.

---

## Behaviour Rules

### 1. No auto-POST on page load or refresh
Canvas load (`applyCanvasSnapshot`) must downgrade any node with status in `ACTIVE_GENERATION_STATUSES` to `error` with `errorCode: generation_stopped_on_reload`. It must NEVER resume a generation POST.

`ACTIVE_GENERATION_STATUSES = ['generating', 'running', 'queued', 'pending', 'processing']`

### 2. One click = one POST
`beginNodeGeneration` returns `null` if the node is already in an active status. The caller must check for `null` and abort without sending a second POST.

### 3. Polling must have a ceiling
Image and video polling: `maxPolls = 12`, interval = 5s → max 60s wall time.
Text nodes may use up to 60 polls. Never remove the `polls < maxPolls` guard.

### 4. Stall detection in status routes
| Condition | Error code |
|-----------|-----------|
| `QUEUED` for > 2 min | `executor_not_started` |
| Any status for > 5 min | `generation_job_stalled` |

These thresholds may be adjusted but must never be removed.

### 5. Save failure must not clear nodes
`setNodes([])` and `setEdges([])` must never appear in any error handler for canvas save, canvas load, or API failure paths. If save fails, show a toast; leave nodes/edges intact.

### 6. Result display before save
After a successful generation:
1. Call `handleNodePatch` to set `resultImageUrl` / `stableUrl` on the node.
2. Write `localStorage` draft (`getDraftKey(projectId)`).
3. Then attempt DB canvas save.

Step 3 failing must not undo steps 1–2.

### 7. cn-executor changes require deployment
Any change to `apps/cn-executor/` requires:
1. `pnpm --filter cn-executor build` — verify it compiles
2. Build deployment zip
3. Upload zip to Aliyun FC console
4. Hit `GET /health` to confirm new code is live

**Do not claim a cn-executor fix is deployed until step 4 is verified.**

---

## Removed / Hidden Tools (DO NOT restore without feature flag)

| Tool | Status | Reason |
|------|--------|--------|
| 分镜 (storyboard) | Hidden | Polluted generation payload |
| 选角 (casting) | Hidden | Unused, added complexity |
| 风格圣经 (style bible) | Hidden | Injected styleBible into prompts |
| skills / enabledCreatorSkills | Hidden | Injected skill list into prompts |
| 高级编辑 (advanced edit) | Hidden | Triggered image-editor flow |
| Asset recovery / history recovery | Removed | Re-triggered stale generations |
| 批量运行工作流 (batch run workflow) | Removed | Caused token drain on all nodes |

Restoring any of these requires:
1. User explicitly requests it
2. Isolated behind a feature flag (default OFF)
3. Flag must not touch image/video generation payload
4. Full type-check + build must pass

---

## Future Video Optimization Scope

When asked to "optimize video speed" or "improve video UX", ONLY these changes are allowed:
- Progress messages / estimated wait time display
- Status polling interval tuning (must keep 24-poll ceiling)
- Toast / skeleton / loading state improvements

These are FORBIDDEN as "video optimization":
- Changing POST /api/generate/video payload or response
- Changing cn-executor /api/jobs/run-video handler
- Changing OSS upload for video
- Removing the degraded-mode (unauthenticated) lookup from video/status

## Auth Layer Guardrails (Added 2026-05-25)

### Session expiry — root cause of UNAUTHORIZED on generation

`getSession()` in `apps/web/src/lib/auth/session.ts` is **allowed** to be modified.
The video/image generation routes are **frozen** — any session issue must be fixed in the auth layer, not the route.

**Hard rules:**
- Middleware (`middleware.ts`) only checks cookie *presence*, not DB session validity. A user can reach the canvas with an expired DB session. Generation will return UNAUTHORIZED.
- **Never fix UNAUTHORIZED by adding auth bypass in the generation routes.** Fix the session layer.
- Sliding expiry is implemented: on each valid session use, `expiresAt` is extended by `SESSION_DAYS` from now.
- `getSession()` retries once on transient DB connection errors before returning null.

**For readonly/navigation pages (dashboard, projects, overview):**
- These pages MUST NOT import from or modify generation routes or auth middleware.
- GET-only pages are safe. POST-only concerns: never call generation routes from page-level code.
- If a deployment of a readonly page breaks generation, the cause is almost always a session expiry coincidence, not a code regression.

### Diagnosing UNAUTHORIZED in production
1. `errorCode: UNAUTHORIZED` in generation response → `getCurrentUser()` returned null
2. Check: does `/api/auth/me` return `authenticated: false`?
   - Yes → session expired. **Fix: user logs out and back in.**
   - No → DB connection issue. Check Supabase session pooler logs.
3. `model: null` in `submittedInput` is expected when body doesn't include `model` (all minimal payloads). It is NOT an indicator of provider misconfiguration.
4. `mode: unavailable` is always set in the UNAUTHORIZED path — not a provider status indicator.

---

## Regression Test Checklist

Run manually after any change to protected files:

- [ ] Image: prompt → generate → node shows image → refresh → image still there
- [ ] Video: prompt → generate → node shows video with preview/playback → refresh → video still there
- [ ] Refresh while generating: node downgrades to error (not auto-resumed)
- [ ] Double-click Generate: only one POST sent (check network tab)
- [ ] 12-poll timeout: after 60s of polling QUEUED, node shows `executor_not_started`
- [ ] Canvas save failure: nodes still visible after save error toast
- [ ] No styleBible / compiledPrompt in image POST body (check network tab)
- [ ] No auto-POST on page load (check network tab on fresh load)
- [ ] `pnpm --filter web type-check` passes
- [ ] `pnpm --filter web build` passes

---

## UI/UX Evidence-Based Acceptance Rule (Added 2026-05-25)

> Implementation is not acceptance.

Every UI/UX change must include browser verification steps in the format:

```
Step N: [操作]
Expected: [肉眼可见结果]
```

And a Network anti-regression check:
- No POST /api/generate/image
- No POST /api/generate/video

For modal/overlay/lightbox specifically:
- Must use `createPortal(…, document.body)`
- Must use `z-[99999]` (not z-[9999])
- Must use `fixed inset-0` (not affected by canvas transform)
- Media must have explicit `width + height + maxWidth + maxHeight` for `object-contain` to work

Full checklist: `docs/UI_ACCEPTANCE_CHECKLIST.md`

If AI cannot test in real browser, must state explicitly:
"我无法真实浏览器验收，请用户按以下步骤验收。"

---

## Nav Link → Page.tsx Rule (Added 2026-05-25)

> A nav link without a backing page.tsx causes a 404 in production.

**Rule:** Before adding any nav link (in `SettingsHoverMenu.tsx`, `TopNavigation.tsx`, `LINKS` arrays, or any other navigation component) that points to a new route, the corresponding `apps/web/src/app/<route>/page.tsx` file **MUST exist and be committed in the same PR/commit**.

**Violation that caused this rule:** Commit `86447d4` added `/settings` to `SettingsHoverMenu` without creating `apps/web/src/app/settings/page.tsx`, resulting in a `/settings 404` in production.

**Enforcement checklist before committing any nav change:**
- [ ] For every `href` added or changed in a nav component, verify the target `page.tsx` exists in `apps/web/src/app/`
- [ ] Run `git status` to confirm the page file is tracked
- [ ] If the page does not yet exist, create a minimal placeholder before or in the same commit as the nav link
