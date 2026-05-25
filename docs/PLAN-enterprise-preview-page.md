# Plan: /enterprise-preview Static Page

Task type: A类 — independent static page, no nav link

## Goal
Add a static enterprise version preview page at /enterprise-preview. No API calls, no DB, no generation triggers, no payment, no enterprise account creation, no navigation connections, no modification of existing components.

## Files

- [x] `apps/web/src/components/enterprise-preview/enterprisePreviewData.ts` — pure static TypeScript data
- [x] `apps/web/src/components/enterprise-preview/EnterprisePreviewPage.tsx` — server component, 11 sections
- [x] `apps/web/src/app/enterprise-preview/page.tsx` — Next.js route entry point

## Sections

1. Hero — title, 5 status chips, one-line tagline, disclaimer banner
2. Target Customers — 5 customer types (A–E): film, advertising, MCN, short drama, brand
3. Enterprise Capabilities — 12 capability cards with status chips
4. Workflow Steps — 8-step film/advertising team workflow
5. Permission Matrix — 8 roles × 6 permissions, scrollable table on narrow screens
6. Security — 9 items with green accent (data isolation, permissions, API key, audit, etc.)
7. Enterprise Plans — 3 tiers (Studio Team / Production Co. / Enterprise Private), all CTAs disabled
8. Value Points — 7 business value cards
9. Onboarding Flow — 8-step enterprise onboarding preview
10. Risks & Boundaries — 7 items with amber warning
11. Quick Links — /dashboard /about /roadmap /local-deploy-preview /pricing-preview /terms-preview /help (page-internal only)
12. Footer

## Definition of Done

- [ ] /enterprise-preview returns 200 in browser
- [ ] All 11 sections visible
- [ ] Permission matrix visible and scrollable on narrow screens
- [ ] No payment integration
- [ ] No enterprise account creation
- [ ] No auto POST to /api/generate/*
- [ ] No auto PUT/PATCH to canvas
- [ ] No DB calls
- [ ] type-check passes
- [ ] build passes
- [ ] git diff shows only allowed paths

## Forbidden (confirmed clean)

- No changes to: create/*, generate/*, canvas/*, media/proxy/*, cn-executor/*, navigation/*, TopNavigation, CanvasToolDock, any existing page or component

## Next task (separate, after this page is verified)

Add /enterprise-preview to SettingsHoverMenu MENU_ITEMS (C类 task, single commit).
