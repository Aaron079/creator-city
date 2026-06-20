# Creator City Locked Stable Modules

> These modules are production-confirmed stable. Modifying them without explicit user instruction and a full regression checklist run is forbidden.

Last updated: 2026-05-25

---

## How to Read This Document

Each module lists:
- **Scope** — which files/directories are frozen
- **What is stable** — exact behaviors that must not regress
- **Allowed touch points** — the only conditions under which a change is permitted
- **Forbidden** — changes that are always blocked regardless of task

---

## 1. 创作画布 /create

**Scope:**
- `apps/web/src/components/create/*`
- `apps/web/src/app/create/*`
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- `apps/web/src/components/create/CanvasNodeCard.tsx`
- `apps/web/src/components/create/MediaLightbox.tsx`
- `apps/web/src/components/create/CanvasToolDock.tsx`

**What is stable:**
- Node drag, connect, resize — exact interaction model
- Node CRUD (add / delete / duplicate) without page reload
- Canvas save to DB on node change (auto-save)
- localStorage draft protection (`creator-city-canvas-draft:<projectId>`)
- Refresh recovery: canvas reloads from DB; draft fallback if DB fails
- CanvasNodeCard error display: `errorCode`, `errorStage`, `stageTrace` fields
- CanvasNodeCard auth_required / UNAUTHORIZED path → "刷新页面并重新登录" message
- CanvasNodeCard media display: `resultImageUrl` → `stableUrl` fallback chain
- MediaLightbox: double-click to enlarge image/video, `createPortal` to body, `z-[99999]`
- CanvasToolDock: `+` button (add node), `U` button (undo), `⚙` settings hover menu
- Stop All Generations button behavior
- Provider status display in node dialog
- Zoom / pan / MiniMap

**Allowed touch points:**
- Only when the user explicitly reports a regression in /create
- Only when the fix scope is isolated to the broken behavior
- Must pass full regression checklist before commit

**Forbidden:**
- Adding tool panels (storyboard, casting, style bible, skills) — permanently hidden
- Adding `styleBible`, `sceneBible`, `characterBible`, `skills`, `inputAssets`, `system` to image/video generation payload
- Auto-resuming generation on page load
- Calling `setNodes([])` or `setEdges([])` in any error handler
- Any change made for a navigation, page, or docs task

---

## 2. 图片生成链路

**Scope:**
- `apps/web/src/app/api/generate/image/route.ts` — **FROZEN**
- `apps/web/src/app/api/generate/image/status/route.ts` — **FROZEN**

**What is stable:**
- Prompt → Seedream API → job submission → status polling → OSS URL → canvas node update
- Polling ceiling: `maxPolls = 12`, interval = 5 s → max 60 s wall time
- Stall detection: `QUEUED` > 2 min → `executor_not_started`; any status > 5 min → `generation_job_stalled`
- Image payload (must not expand):

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

**Allowed touch points:**
- Only when Seedream API or OSS integration changes require it
- User must explicitly approve the change
- Full regression checklist must pass

**Forbidden:**
- Adding `compiledPrompt`, `system`, `inputAssets`, `styleBible`, `sceneBible`, `characterBible`, `skills`, `storyboard`, `casting` to payload
- Changing the status polling interval or ceiling without explicit approval
- Any change made for a navigation, page, or docs task

---

## 3. 视频生成链路

**Scope:**
- `apps/web/src/app/api/generate/video/route.ts` — **FROZEN**
- `apps/web/src/app/api/generate/video/status/route.ts` — **FROZEN**

**What is stable:**
- Prompt → Seedance API → job submission → status polling → OSS URL → canvas node update
- Polling ceiling: `maxPolls = 24`, interval = 5 s → max 120 s wall time
- Degraded mode: video status route returns safe status (no 401) when session cookie absent
- Video payload (must not expand):

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

**Allowed touch points:**
- Only when Seedance API or OSS integration changes require it
- User must explicitly approve the change
- Full regression checklist must pass

**Forbidden:**
- Same payload field restrictions as image (see §2)
- Removing the degraded-mode (unauthenticated) safe-response path from video/status
- Any change made for a navigation, page, or docs task

---

## 4. Canvas API

**Scope:**
- `apps/web/src/app/api/projects/[projectId]/canvas/route.ts`
- Any file under `apps/web/src/app/api/projects/*/canvas/`

**What is stable:**
- `GET` returns the current canvas snapshot from DB
- `PUT` saves nodes + edges to DB
- On save failure: toast is shown, nodes/edges are NOT cleared from local state
- On load failure: localStorage draft is used as fallback (never `setNodes([])`)
- Error codes: `CANVAS_DB_TIMEOUT`, `CANVAS_DB_CONNECTION` → 503
- `DB_SCHEMA_MISSING` → 503

**Allowed touch points:**
- Only for canvas feature development explicitly requested by the user
- Must not change error codes already in production use

**Forbidden:**
- Calling `setNodes([])` or `setEdges([])` on any failure path
- Any change made for a navigation, page, or docs task

---

## 5. Media Proxy

**Scope:**
- `apps/web/src/app/api/media/proxy/route.ts`
- All files under `apps/web/src/app/api/media/proxy/`

**What is stable:**
- Proxies OSS media URLs through session-authenticated endpoint
- Returns 401 `proxy_auth_required` when session is expired (correct behavior — fix by re-login, not by bypassing auth)
- Validates URL with `isRenderableMediaUrl` before proxying
- Saved images/videos must not be hidden by proxy auth errors caused by session expiry

**Allowed touch points:**
- Only when OSS region or auth layer changes require it

**Forbidden:**
- Bypassing auth check to fix a session-expiry 401 (fix the session layer instead)
- Any change made for a navigation, page, or docs task

---

## 6. cn-executor

**Scope:**
- `apps/cn-executor/**` — **FROZEN**
- `apps/cn-executor/src/handlers/generateImage.ts`
- `apps/cn-executor/src/handlers/jobRunner.ts`
- `apps/cn-executor/src/oss.ts`
- `apps/cn-executor/src/volcengine.ts`

**What is stable:**
- Seedream → OSS upload pipeline with retry + error classification
- Seedance → OSS upload pipeline
- Job execution orchestration
- Aliyun Function Compute deployment

**Allowed touch points:**
- Only when the user explicitly asks to fix or update cn-executor
- Requires deployment verification after every change:
  1. `pnpm --filter cn-executor build`
  2. Build deployment zip
  3. Upload to Aliyun FC console
  4. `GET /health` confirms new code is live

**Forbidden:**
- Any change made for a navigation, page, or docs task

---

## 7. Provider / Model Fallback

**Scope:**
- Seedream image provider fallback logic
- Seedance video provider fallback logic
- Provider status aggregation helpers

**What is stable:**
- Image provider falls back gracefully when primary provider unavailable
- Video provider falls back gracefully when primary provider unavailable
- Provider status is readable in canvas node dialog

**Allowed touch points:**
- Only when provider configuration or fallback logic needs updating
- User must explicitly approve

**Forbidden:**
- Any change made for a navigation, page, or docs task

---

## 8. Auth / Session Helper

**Scope:**
- `apps/web/src/lib/auth/session.ts`
- `apps/web/src/lib/auth/client.ts`
- `apps/web/src/lib/auth/use-current-user.ts`
- `middleware.ts`
- Session DB queries

**What is stable:**
- `getSession()` returns null on expired session (correct behavior)
- `getSession()` retries once on transient DB errors before returning null
- Sliding expiry: each valid session use extends `expiresAt` by `SESSION_DAYS`
- Middleware checks cookie presence only (does not hit DB)
- `clientLogout()` clears session cookie

**Allowed touch points:**
- Only when session expiry or auth flow needs fixing
- NEVER fix an UNAUTHORIZED error by bypassing auth in generation routes

**Forbidden:**
- Adding auth bypass to generation or proxy routes
- Any change made for a navigation, page, or docs task

---

## 9. Stable Pages

The following pages are deployed and verified working. They must not be broken by any new task.

| Page | Route | Notes |
|------|-------|-------|
| 工作台 | `/dashboard` | Stable — read-only |
| 工作空间 | `/projects` | Stable — read-only |
| 项目详情 | `/projects/[id]` | Stable |
| 项目概览 | `/projects/[id]/overview` | Stable |
| 资产库 | `/assets` | Stable |
| 任务中心 | `/tasks` | Stable |
| API 中心 | `/providers` | Stable |
| 诊断帮助 | `/help` | Stable |
| 设置中心 | `/settings` | Stable (added 2026-05-25) |
| 社区 | `/community` | Stable |
| 创作者市场 | `/marketplace` | Stable (added 2026-05-25) |
| 创作画布 | `/create` | Stable — generation chain active |
| Legacy redirect | `/create-v2` | Redirects to /create — removed 2026-06-20 |
| 账号 | `/account` | Stable |
| 账号计费 | `/account/credits` | Stable |

**Rule:** A new task must not cause a 404, 500, or visual regression on any of these pages.

---

## Summary: Touch-Permission Matrix

| Module | Navigation task | New page task | Generation fix | Explicit user request |
|--------|----------------|---------------|----------------|-----------------------|
| /create components | ❌ | ❌ | ✅ (scoped) | ✅ |
| image/video generate routes | ❌ | ❌ | ✅ (scoped) | ✅ |
| canvas API | ❌ | ❌ | ✅ (scoped) | ✅ |
| media proxy | ❌ | ❌ | ✅ (scoped) | ✅ |
| cn-executor | ❌ | ❌ | ❌ | ✅ + deploy verify |
| provider fallback | ❌ | ❌ | ✅ (scoped) | ✅ |
| auth/session | ❌ | ❌ | ✅ (scoped) | ✅ |
| stable pages | read only | read only | read only | read only |
