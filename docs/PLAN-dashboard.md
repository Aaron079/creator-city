# Plan: Dashboard 创作者工作台 + 导航信息架构优化

**Goal:** 新增 /dashboard 创作者工作台首页，聚合项目/资产/任务/API 状态；优化导航为"创作/管理/系统"三级结构。只增加，不删改已有功能。

**Pre-flight 7 answers:**
1. Modified: `apps/web/src/app/dashboard/page.tsx` (rewrite, explicitly allowed); `CanvasToolDock.tsx` (+2 lines nav); `VisualCanvasWorkspace.tsx` (+3 lines nav link)
2. VisualCanvasWorkspace is protected — only adding a single `<a href="/dashboard">` nav link, zero logic changes
3. No image/video payload changes
4. Dashboard: GET-only fetch on mount — no auto-POST
5. No unbounded polling — single one-shot fetch
6. No nodes/edges touched — different page entirely
7. Verify: type-check + build must pass; generation routes completely untouched

**Security constraints:**
- GET /api/projects, /api/assets, /api/generation-tasks only
- No POST triggered from Dashboard
- No secret/env values displayed
- Provider status shown as card linking to /providers (no env reading on client)
- prompt truncated to 80 chars in UI

---

## Steps

- [x] Read required docs (STABLE_BASELINE, GUARDRAILS, AI_AGENT_WORKFLOW_RULES, UI_ACCEPTANCE_CHECKLIST, memory)
- [x] Explore: current nav structure, existing dashboard, existing routes
- [x] Rewrite `apps/web/src/app/dashboard/page.tsx` — dark premium creator workbench
- [x] Update `apps/web/src/components/create/CanvasToolDock.tsx` — add "工作台" link + group labels
- [x] Update `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — add "工作台" top nav link
- [x] `pnpm --filter web type-check` — passed
- [x] `pnpm --filter web build` — passed
- [x] git add + commit 1c4c76f + push origin main
- [ ] Provide browser verification steps (required per UI_ACCEPTANCE_CHECKLIST)

## Files Changed

**Modified (rewrite, explicitly allowed):**
- `apps/web/src/app/dashboard/page.tsx`

**Modified (+1-3 lines each):**
- `apps/web/src/components/create/CanvasToolDock.tsx`
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`

**Unchanged (frozen):**
- All generate routes
- cn-executor
- OSS config, Supabase schema
- Canvas generation logic
- MediaLightbox logic
- Provider/Task/Asset/Project Center core logic

## Dashboard Layout

```
[ sticky header: 创作 | 管理 | 系统 groups ]
[ hero: Creator City 工作台 | 进入画布 | 新建项目 ]
[ 4 stat cards: 项目 | 资产 | 任务 | API ]
[ 2-col: 最近项目 | 最近资产 ]
[ 最近任务 row ]
[ API 状态小组件 ]
```

## Data Sources (GET only)
- `/api/projects` — project list + counts
- `/api/assets?limit=8` — recent assets
- `/api/generation-tasks?limit=10` — recent tasks
- Provider status: card linking to /providers (no env reading client-side)

## Definition of Done

- /dashboard shows Creator City 工作台 title
- Hero has "进入创作画布" primary CTA
- 4 overview cards with real data counts
- Recent projects with enter canvas / view assets / view tasks links
- Recent assets with thumbnails
- Recent tasks with status chips
- Grouped nav: 创作 / 管理 / 系统
- CanvasToolDock user menu has "工作台" entry
- Canvas top nav has "工作台" link
- type-check + build pass
- No POST /api/generate/* triggered
- push + Vercel ready
