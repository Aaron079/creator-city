# Plan: Project Detail 项目详情页

**Goal:** 新增 /projects/[id]/overview 项目详情页，聚合该项目的资产/任务/统计数据。只增加，不删改。

**Pre-flight 7 answers:**
1. What: NEW `apps/web/src/app/projects/[id]/overview/page.tsx`; NEW `apps/web/src/app/api/projects/[projectId]/summary/route.ts`; +1 link in projects/page.tsx; +1 link in dashboard/page.tsx
2. Protected files? `projects/[id]/page.tsx` is NOT touched. `apps/web/src/app/projects/page.tsx` only gets +1 "详情" link added. Dashboard gets +1 link. No generate routes.
3. Image/video generation payload? No
4. Auto-POST? New API is GET-only. New page is GET-only.
5. Unbounded polling? No — single fetch on mount
6. Risk clearing nodes? No — different page
7. Verify: type-check + build must pass

**Routing note:** `[id]` already exists at `apps/web/src/app/projects/[id]/`. Cannot create `[projectId]` at same level (conflict). Using nested route: `/projects/[id]/overview`.

**Security:**
- GET /api/projects/[projectId]/summary auth-gated (getCurrentUser + ownerId check)
- prompt truncated to 80 chars (promptPreview)
- No secret/env/API key returned
- No input JSON returned
- No storageKey/bucket/error returned

---

## Steps

- [x] Read required docs (STABLE_BASELINE, GUARDRAILS, AI_AGENT_WORKFLOW_RULES, UI_ACCEPTANCE_CHECKLIST, memory)
- [x] Explore: routing structure, schema, existing APIs
- [x] Create `apps/web/src/app/api/projects/[projectId]/summary/route.ts` — committed 86178d7
- [x] Create `apps/web/src/app/projects/[id]/overview/page.tsx` — committed 86178d7
- [x] Update `apps/web/src/app/projects/page.tsx` — added "详情" link — committed 86178d7
- [x] Update `apps/web/src/app/dashboard/page.tsx` — added "详情" link to RecentProjects — committed 1c4c76f
- [x] `pnpm --filter web type-check` — PASSED 2026-05-25
- [x] `pnpm --filter web build` — PASSED 2026-05-25 (/projects/[id]/overview in build output, 4.24 kB)
- [x] git add + commit + push — deployed on Vercel (commit 86178d7 + 1c4c76f)

## Status: COMPLETE — All steps done, in production.

## Files Changed

**New (additions only):**
- `apps/web/src/app/api/projects/[projectId]/summary/route.ts`
- `apps/web/src/app/projects/[id]/overview/page.tsx`

**Modified (additive +1 link each):**
- `apps/web/src/app/projects/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`

**Unchanged (frozen):**
- All generate routes, cn-executor, MediaLightbox, canvas logic

## API Response Shape

GET /api/projects/[projectId]/summary → {
  success, project: { id, title, type, status, createdAt, updatedAt },
  stats: { workflowCount, nodeCount, assetCount, imageAssetCount, videoAssetCount, taskCount, runningTaskCount, succeededTaskCount, failedTaskCount },
  recentAssets: [{ id, type, url, thumbnailUrl, providerId, promptPreview, generationJobId, createdAt }],
  recentTasks: [{ id, type, status, promptPreview, providerId, nodeId, errorCode, errorStage, createdAt, completedAt, durationMs }]
}

## URL

- Detail page: `/projects/[id]/overview`
- Summary API: `/api/projects/[projectId]/summary`
- "详情" link from projects list → `/projects/${project.id}/overview`
- "详情" link from dashboard recent projects → `/projects/${p.id}/overview`

## Definition of Done

- /projects/[id]/overview loads with project info + stats + recent assets + recent tasks
- projectId copyable
- 进入画布 → /create?projectId=xxx
- 查看资产 → /assets?projectId=xxx
- 查看任务 → /tasks?projectId=xxx
- /projects page has "详情" per card
- /dashboard recent projects has "详情" per item
- type-check + build pass
- No POST generated
- push + Vercel ready
