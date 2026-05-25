# Plan: Enhance Community Center 社区中心增强

**Goal:** 只增强现有 /community 页面内容和视觉，不新增重复社区入口，不改任何旧模块。

## Pre-flight 7 Answers

1. **What exactly:** `apps/web/src/app/community/page.tsx` 内容增强（唯一修改文件）; 新增 plan doc。
2. **Protected files?** NO — CanvasNodeCard, VisualCanvasWorkspace, generate routes, cn-executor 全部不动。
3. **Image/video generation payload?** NO — 静态只读页，零 fetch 调用。
4. **Auto-POST on page load?** NO — 纯前端 mock 数据，无 useEffect，无 fetch。
5. **Unbounded polling?** NO。
6. **Risk clearing nodes?** NO — 完全独立页面，不接触 canvas 状态。
7. **Verify:** type-check + build pass；用户按步骤验收。

---

## Steps

- [x] Write this plan file
- [ ] Enhance `apps/web/src/app/community/page.tsx`
- [ ] Diff gate: git diff --name-only must not include forbidden paths
- [ ] `pnpm --filter web type-check` — MUST PASS
- [ ] `pnpm --filter web build` — MUST PASS
- [ ] git add + commit + push

## Files to Modify (enhancement only)

- `apps/web/src/app/community/page.tsx` — add status chips, expand feed (4→8 items), add Collab + Rules sections

## No New Files (except plan doc)

All enhancement is inline in the existing page file.

## Forbidden Files (must not appear in diff)

- apps/web/src/components/create/CanvasNodeCard.tsx
- apps/web/src/components/create/VisualCanvasWorkspace.tsx
- apps/web/src/components/create/MediaLightbox.tsx
- apps/web/src/components/create/CanvasToolDock.tsx
- apps/web/src/app/create/*
- apps/web/src/app/api/generate/*
- apps/web/src/app/api/projects/*/canvas/*
- apps/cn-executor
- provider/model fallback
- auth/session helper
- OSS/Supabase/火山配置

## Content Enhancement Summary

| Area | Before | After |
|------|--------|-------|
| Channels | 6 cards (no status) | 11 cards (每张加 status chip) |
| Feed items | 4 items (meta combined) | 8 items (type/status/author 分开) |
| Sections | Hero + Channels + Feed | + Collab 入口 + Community Rules |
| Mock label | "前端 mock" | "前端 mock · 只读预览" |

## Definition of Done

- 所有现有内容保留，无删除
- 6+5=11 个频道卡片，每张有状态 chip
- 4+4=8 条 mock feed，类型+状态+作者标注为 demo
- Collab 区 4 个 disabled "即将开放" 入口
- Rules 区 5 条规则
- 零 POST/PUT/PATCH（Network tab 确认）
- type-check + build PASS
- git push + Vercel Ready

## Status: IN PROGRESS
