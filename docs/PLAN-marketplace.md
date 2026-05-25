# Plan: Creator Marketplace 创作者市场

**Goal:** 新增 /marketplace 创作者市场页面，只做新增，不删改任何已稳定代码。

## Pre-flight 7 Answers

1. **What exactly:** 3 new files (marketplaceData.ts, MarketplaceCenter.tsx, marketplace/page.tsx); additive link in TopNavigation.tsx LINKS array (+1 entry); additive item in SettingsHoverMenu.tsx MENU_ITEMS (+1 item); plan doc.
2. **Protected files?** NO — CanvasNodeCard, VisualCanvasWorkspace, generate routes, cn-executor all untouched.
3. **Image/video generation payload?** NO — purely static read-only page.
4. **Auto-POST on page load?** NO — server component, no fetch, no useEffect.
5. **Unbounded polling?** NO.
6. **Risk clearing nodes?** NO — completely independent page.
7. **Verify:** type-check + build pass; browser acceptance steps provided.

---

## Steps

- [x] Write this plan file
- [ ] Create `apps/web/src/components/marketplace/marketplaceData.ts`
- [ ] Create `apps/web/src/components/marketplace/MarketplaceCenter.tsx`
- [ ] Create `apps/web/src/app/marketplace/page.tsx`
- [ ] Append `/marketplace` to TopNavigation LINKS (additive)
- [ ] Append marketplace to SettingsHoverMenu MENU_ITEMS (additive)
- [ ] Diff gate
- [ ] type-check + build
- [ ] git add + commit + push

## Files to Create (new)

- `apps/web/src/components/marketplace/marketplaceData.ts` — static data only
- `apps/web/src/components/marketplace/MarketplaceCenter.tsx` — server component
- `apps/web/src/app/marketplace/page.tsx` — Next.js route

## Files to Modify (additive only)

- `apps/web/src/components/layout/TopNavigation.tsx` — +1 LINKS entry `{ href: '/marketplace', label: '市场' }`
- `apps/web/src/components/navigation/SettingsHoverMenu.tsx` — +1 MENU_ITEMS entry

## Forbidden Files (must not appear in diff)

- apps/web/src/components/create/*
- apps/web/src/app/create/*
- apps/web/src/app/api/generate/*
- cn-executor, auth/session, OSS/Supabase config

## Page Sections

1. Hero — 创作者市场, 副标题, 快速入口 (4 buttons)
2. 市场概览 — 4 stats (明标"预览")
3. 服务分类 — 8 categories with status chips
4. 创作者服务卡片 — 8 mock creators (marked demo)
5. 项目需求卡片 — 5 mock requirements
6. 平台交易规则预览 — 4 rules
7. 安全提示 — 4 tips
8. 快速入口 — 8 destination links

## Status: IN PROGRESS
