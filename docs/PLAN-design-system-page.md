# Plan: /design-system Static Page

Task type: A类 — independent static page, no nav link

## Goal
Add a static design system reference page at /design-system. No API calls, no DB, no generation triggers, no navigation connections, no modification of existing components.

## Files

- [x] `apps/web/src/components/design-system/designSystemData.ts` — pure static TypeScript data
- [x] `apps/web/src/components/design-system/DesignSystemPage.tsx` — server component, 12 sections
- [x] `apps/web/src/app/design-system/page.tsx` — Next.js route entry point

## Sections

1. Hero — title, status chips, quick links
2. Design Principles — 7 principles
3. Color Tokens — 15 color samples
4. Typography — 7 type levels
5. Button Variants — 5 variants (primary/secondary/ghost/danger/disabled)
6. Status Chip specs — 9 chips with usage and avoid notes
7. Card Examples — 8 card types with DEMO markers
8. Empty/Error/Loading states — 7 scenarios with actionable suggestions
9. Media Ratio specs — 5 ratios (pure CSS placeholders, no media URLs)
10. Navigation Rules — 6 rules
11. Do / Don't — 6+6 items
12. Footer

## Definition of Done

- [ ] /design-system returns 200 in browser
- [ ] All 12 sections visible
- [ ] No auto POST to /api/generate/*
- [ ] No auto PUT/PATCH to canvas
- [ ] No media URLs used in placeholders
- [ ] type-check passes
- [ ] build passes
- [ ] git diff shows only allowed paths

## Forbidden (confirmed clean)

- No changes to: create/*, generate/*, canvas/*, media/proxy/*, cn-executor/*, navigation/*, TopNavigation, CanvasToolDock, any existing page or component

## Next task (separate, after this page is verified)

Add /design-system to SettingsHoverMenu MENU_ITEMS (C类 task, single commit).
