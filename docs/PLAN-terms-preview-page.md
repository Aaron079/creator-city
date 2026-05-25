# Plan: /terms-preview Static Page

Task type: A类 — independent static page, no nav link

## Goal
Add a static terms and copyright rules preview page at /terms-preview. No API calls, no DB, no generation triggers, no navigation connections, no modification of existing components. Does not constitute a formal legal agreement.

## Files

- [x] `apps/web/src/components/terms-preview/termsPreviewData.ts` — pure static TypeScript data
- [x] `apps/web/src/components/terms-preview/TermsPreviewPage.tsx` — server component, 9 sections
- [x] `apps/web/src/app/terms-preview/page.tsx` — Next.js route entry point

## Sections

1. Hero — title, disclaimer chips, one-line tagline, formal-text disclaimer banner
2. Rule Overview — 6 categories (A–F): material copyright, AI content, API security, community, marketplace, enterprise
3. User Responsibilities — 5-row table: title × detail
4. Platform Boundaries — 5 cards with blue accent
5. Marketplace Flow — 6-step creator transaction preview
6. Prohibited Actions — split into severe / general violations
7. Risk Warnings — 5 cards with emoji icons
8. Future Legal Docs — 8-item table with status chips (优先级高 / 规划中 / 待补齐)
9. Quick Links — /dashboard /roadmap /pricing-preview /community /help (page-internal only)
10. Footer

## Definition of Done

- [ ] /terms-preview returns 200 in browser
- [ ] All 9 sections visible
- [ ] Disclaimer banner visible in Hero
- [ ] No auto POST to /api/generate/*
- [ ] No auto PUT/PATCH to canvas
- [ ] No payment integration
- [ ] No DB calls
- [ ] type-check passes
- [ ] build passes
- [ ] git diff shows only allowed paths

## Forbidden (confirmed clean)

- No changes to: create/*, generate/*, canvas/*, media/proxy/*, cn-executor/*, navigation/*, TopNavigation, CanvasToolDock, any existing page or component

## Next task (separate, after this page is verified)

Add /terms-preview to SettingsHoverMenu MENU_ITEMS (C类 task, single commit).
