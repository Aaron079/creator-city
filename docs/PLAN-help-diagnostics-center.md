# Plan: Help / Diagnostics Center 诊断帮助中心

**Goal:** 新增 /help 诊断帮助中心，只增加，不删改任何已稳定代码。

**Pre-flight 7 answers:**
1. What: NEW `apps/web/src/app/help/page.tsx`; NEW `apps/web/src/components/help/DiagnosticsCenter.tsx`; NEW `apps/web/src/components/help/diagnosticData.ts`; +1 link in dashboard/page.tsx
2. Protected files? NO — /create, /api/generate/*, cn-executor NOT touched. dashboard gets +1 nav link only.
3. Image/video generation payload? NO
4. Auto-POST? NO — static read-only page
5. Unbounded polling? NO
6. Risk clearing nodes? NO — completely separate page
7. Verify: type-check + build pass; diff gate confirms no forbidden files

---

## Steps

- [x] Read required docs (STABLE_BASELINE, GUARDRAILS, AI_AGENT_WORKFLOW_RULES, UI_ACCEPTANCE_CHECKLIST, memory)
- [x] Explore: routing, existing pages, nav structure
- [ ] Create `apps/web/src/components/help/diagnosticData.ts`
- [ ] Create `apps/web/src/components/help/DiagnosticsCenter.tsx`
- [ ] Create `apps/web/src/app/help/page.tsx`
- [ ] Update `apps/web/src/app/dashboard/page.tsx` — add "帮助/诊断" link only
- [ ] Diff gate: git diff --name-only must not include forbidden paths
- [ ] `pnpm --filter web type-check` — MUST PASS
- [ ] `pnpm --filter web build` — MUST PASS
- [ ] git add + commit + push

## Status: IN PROGRESS

## Files to Create (new)

- `apps/web/src/components/help/diagnosticData.ts` — static diagnostic data (no API calls, no secrets)
- `apps/web/src/components/help/DiagnosticsCenter.tsx` — UI component
- `apps/web/src/app/help/page.tsx` — Next.js page at /help

## Files to Modify (additive link only)

- `apps/web/src/app/dashboard/page.tsx` — +1 "帮助/诊断" link, no other change

## Forbidden Files (must not appear in diff)

- apps/web/src/components/create/*
- apps/web/src/app/create/*
- apps/web/src/app/api/generate/*
- apps/web/src/app/api/projects/*/canvas/*
- apps/cn-executor
- auth/session helper
- OSS/Supabase/火山配置

## Page Sections

1. 顶部概览 — 系统稳定基线说明
2. 快速诊断卡片 — 10+ 常见问题入口
3. 错误码参考表 — 已知 errorCode + 含义 + 处理步骤
4. Network 检查指南 — DevTools 步骤
5. 开发保护红线 — 禁止修改的文件/行为
6. 快速导航入口 — 返回各功能页面

## Definition of Done

- /help 页面可访问，包含所有 6 个功能区
- 错误码表格可读
- 无 POST /api/generate/*
- 无 canvas PUT/PATCH
- 不暴露 secret/env/API key value
- /create 不受影响
- type-check + build 通过
- 推送 Vercel 成功
