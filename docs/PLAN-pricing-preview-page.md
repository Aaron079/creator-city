# Plan: /pricing-preview Static Page

Task type: A类 — independent static page, no nav link

## Goal
Add a static commercial model preview page at /pricing-preview. No API calls, no DB, no generation triggers, no navigation connections, no modification of existing components.

## Files

- [x] `apps/web/src/components/pricing-preview/pricingPreviewData.ts` — pure static TypeScript data
- [x] `apps/web/src/components/pricing-preview/PricingPreviewPage.tsx` — server component, 8 sections
- [x] `apps/web/src/app/pricing-preview/page.tsx` — Next.js route entry point

## Sections

1. Hero — title, status chips, one-line tagline
2. Revenue Model Overview — 5 revenue directions (A–E)
3. Pricing Plans — 4 tiers (Free / Pro / Studio / Enterprise), all CTAs disabled
4. Commission Flow — 6-step creator market commission model (30% preview)
5. API Cost Principles — 4 cards explaining API passthrough model
6. Investor Highlights — 6-row table: dimension × business mechanic
7. Risks & Boundaries — 7 explicit disclaimers
8. Quick Links — /dashboard /roadmap /community /help /projects (page-internal only, no nav change)
9. Footer

## Definition of Done

- [ ] /pricing-preview returns 200 in browser
- [ ] All 8 sections visible
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

Add /pricing-preview to SettingsHoverMenu MENU_ITEMS (C类 task, single commit).
