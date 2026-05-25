# Plan: Settings Hover Menu — Left Floating Nav ⚙️

**Goal:** 在左侧悬浮导航（CanvasToolDock）中追加 ⚙️ 设置按钮，鼠标 hover 显示子导航。只做新增/附加，不删改任何已稳定代码。

## Pre-flight 7 Answers

1. **What exactly:** New file `apps/web/src/components/navigation/SettingsHoverMenu.tsx`; additive import + JSX in `CanvasToolDock.tsx` (append settings trigger after U button); new plan doc.
2. **Protected files?** NO — CanvasNodeCard, VisualCanvasWorkspace, MediaLightbox, create routes, cn-executor all untouched.
3. **Image/video generation payload?** NO — pure navigation, zero fetch calls.
4. **Auto-POST on page load?** NO — no useEffect, no fetch, no API calls.
5. **Unbounded polling?** NO.
6. **Risk clearing nodes?** NO — isolated navigation component.
7. **Verify:** type-check + build pass; browser acceptance steps provided.

---

## Steps

- [x] Write this plan file
- [ ] Create `apps/web/src/components/navigation/SettingsHoverMenu.tsx`
- [ ] Append settings trigger to `apps/web/src/components/create/CanvasToolDock.tsx` (additive only)
- [ ] Diff gate: git diff --name-only must not include forbidden paths
- [ ] `pnpm --filter web type-check` — MUST PASS
- [ ] `pnpm --filter web build` — MUST PASS
- [ ] git add + commit + push

## Files to Create (new)

- `apps/web/src/components/navigation/SettingsHoverMenu.tsx` — hover menu component, no API calls

## Files to Modify (additive only)

- `apps/web/src/components/create/CanvasToolDock.tsx` — +1 import + +1 `<SettingsHoverMenu />` after divider; nothing else changed

## Forbidden Files (must not appear in diff)

- apps/web/src/components/create/CanvasNodeCard.tsx
- apps/web/src/components/create/VisualCanvasWorkspace.tsx
- apps/web/src/components/create/MediaLightbox.tsx
- apps/web/src/app/create/*
- apps/web/src/app/api/generate/*
- apps/web/src/app/api/projects/*/canvas/*
- apps/cn-executor
- provider/model fallback
- auth/session helper
- OSS/Supabase/火山配置

## Definition of Done

- Left floating nav shows ⚙️ button below U button
- + button behavior unchanged
- U button behavior unchanged
- Hover on ⚙️ → sub-nav appears with 4 links
- Mouse into sub-nav → does not dismiss
- Mouse leave both → sub-nav dismisses after 150ms
- Sub-nav links: /settings, /providers, /help, /tasks
- Zero POST to /api/generate/* (confirmed by Network tab)
- type-check + build pass
- Pushed and Vercel Production Ready

## Status: IN PROGRESS
