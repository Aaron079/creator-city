# Generation Pipeline Guardrails

Rules that protect the stable generation chain. Read before touching any file in this list.

## Protected Files — Change Requires Explicit Justification

| File | Risk |
|------|------|
| `apps/web/src/app/api/generate/image/route.ts` | Image generation main chain |
| `apps/web/src/app/api/generate/video/route.ts` | Video generation main chain |
| `apps/web/src/app/api/generate/image/status/route.ts` | Image polling + stall detection |
| `apps/web/src/app/api/generate/video/status/route.ts` | Video polling + stall detection |
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

## Regression Test Checklist

Run manually after any change to protected files:

- [ ] Image generation: prompt → node shows image → refresh → image still there
- [ ] Video generation: prompt → node shows video → refresh → video still there
- [ ] Refresh while generating: node downgrades to error (not auto-resumed)
- [ ] Double-click Generate: only one POST sent (check network tab)
- [ ] 12-poll timeout: after 60s of polling QUEUED, node shows `executor_not_started`
- [ ] Canvas save failure: nodes still visible after save error toast
- [ ] No styleBible / compiledPrompt in image POST body (check network tab)
- [ ] No auto-POST on page load (check network tab on fresh load)
- [ ] `pnpm --filter web type-check` passes
- [ ] `pnpm --filter web build` passes
