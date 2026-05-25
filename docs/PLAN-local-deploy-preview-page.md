# Plan: /local-deploy-preview Static Page

Task type: A类 — independent static page, no nav link

## Goal
Add a static local deployment preview page at /local-deploy-preview. No API calls, no DB, no generation triggers, no navigation connections, no real downloads, no deployment execution, no modification of existing components.

## Files

- [x] `apps/web/src/components/local-deploy-preview/localDeployPreviewData.ts` — pure static TypeScript data
- [x] `apps/web/src/components/local-deploy-preview/LocalDeployPreviewPage.tsx` — server component, 10 sections
- [x] `apps/web/src/app/local-deploy-preview/page.tsx` — Next.js route entry point

## Sections

1. Hero — title, 5 status chips, one-line tagline, disclaimer banner
2. Reasons — 5 cards: why local deployment matters
3. Deploy Modes — 4 forms (Workstation / Studio LAN / Enterprise Private Cloud / Hybrid Cloud)
4. Capability Map — 12 capabilities with status chips (规划中 / 预览 / 长期规划)
5. Architecture Preview — 8-layer table (Web UI → Enterprise Auth) with color accents
6. Security Principles — 5 cards with green accent
7. Prerequisites — 9-item table (required / optional split)
8. Roadmap — 6 phases (Preview → Offline Pack)
9. Risks & Boundaries — 7 items with amber warning
10. Quick Links — /dashboard /about /roadmap /pricing-preview /terms-preview /help (page-internal only)
11. Footer

## Definition of Done

- [ ] /local-deploy-preview returns 200 in browser
- [ ] All 10 sections visible
- [ ] No real download links
- [ ] No real deployment commands
- [ ] No auto POST to /api/generate/*
- [ ] No auto PUT/PATCH to canvas
- [ ] No DB calls
- [ ] type-check passes
- [ ] build passes
- [ ] git diff shows only allowed paths

## Forbidden (confirmed clean)

- No changes to: create/*, generate/*, canvas/*, media/proxy/*, cn-executor/*, navigation/*, TopNavigation, CanvasToolDock, any existing page or component

## Next task (separate, after this page is verified)

Add /local-deploy-preview to SettingsHoverMenu MENU_ITEMS (C类 task, single commit).
