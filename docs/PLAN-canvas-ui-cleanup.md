# Plan: 画布 UI 基础整理 + 节点操作体验优化

## Goal
Minimal, targeted frontend-only cleanup of the canvas UI. Frozen generation chains must not be touched.

## Protected (do not modify)
- `apps/web/src/app/api/generate/image/route.ts`
- `apps/web/src/app/api/generate/video/route.ts`
- `apps/web/src/app/api/generate/image/status/route.ts`
- `apps/web/src/app/api/generate/video/status/route.ts`
- `apps/cn-executor/` (entire directory)
- OSS config, Supabase schema, Volcengine API config

## Allowed files
- `apps/web/src/components/create/CanvasNodeCard.tsx`
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- `apps/web/src/components/create/CanvasToolDock.tsx`

## Already confirmed OK (no action needed)
- `STORYBOARD_TOOLS_ENABLED = false` — storyboard buttons hidden ✅
- `ASSET_RECOVERY_TOOLS_ENABLED = false` — asset recovery hidden ✅
- `enabledSkillCount=0` + `onOpenSkillPanel=undefined` — skills hidden ✅
- Video slow hint added ("视频生成通常需要 1–3 分钟，请勿重复点击") ✅
- Kind-specific status labels during generation ✅
- Button disabled during active generation ✅
- Duplicate POST guard (beginNodeGeneration returns null) ✅
- Error display: errorCode + errorStage + stageTrace + generationJobId on node face ✅
- Copy diagnostic JSON button ✅
- Canvas save failure does NOT clear nodes ✅
- Polling ceiling: 12 polls image / 24 polls video ✅
- No auto-POST on refresh ✅

## Steps

- [x] Step 0: Audit existing state — confirms above list
- [ ] Step 1: CanvasToolDock — remove audio/world/upload from NODE_OPTIONS (keep text/image/video only); remove Assets/Templates/Comments from TOOLS; add 停止生成 conditional button; clean up props
- [ ] Step 2: CanvasNodeCard — getStatusLabel: 'done' → '已生成', default fallback → '待生成'
- [ ] Step 3: VisualCanvasWorkspace — update CanvasToolDock call site (new props); friendlier save-failure message (remove raw error detail prefix)
- [ ] Step 4: pnpm --filter web type-check && pnpm --filter web build && pnpm lint
- [ ] Step 5: git add + commit + push origin main; verify Vercel deploy

## Definition of done
- type-check passes
- build passes
- lint passes
- Toolbar add menu shows only text / image / video
- Stop-all button visible in toolbar when generation active
- Node status chip shows: 待生成 / 排队中 / 图片生成中|视频生成中 / 已生成 / 失败 / 已停止
- Canvas save failure shows friendly message, nodes intact
- No changes to any frozen file
- git status --short is empty after push
