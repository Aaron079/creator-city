# Plan: /roadmap Static Page

Task type: A类 — independent static page, no nav link

## Goal
Add a static product roadmap page at /roadmap that communicates the 6-phase plan for Creator City. No API calls, no DB, no generation triggers, no navigation connections.

## Files

- [x] `apps/web/src/components/roadmap/roadmapData.ts` — pure static TypeScript data
- [x] `apps/web/src/components/roadmap/RoadmapPage.tsx` — server component, renders roadmap
- [x] `apps/web/src/app/roadmap/page.tsx` — Next.js route entry point

## Definition of Done

- [ ] /roadmap returns 200 in browser
- [ ] Page shows Phase 1–6 with timeline and status chips
- [ ] Page shows frozen rules section
- [ ] Page shows risk level classification
- [ ] Page shows recommended next steps
- [ ] Page has quick links to /dashboard, /create, /projects, /help
- [ ] No auto POST to /api/generate/*
- [ ] No auto PUT/PATCH to canvas
- [ ] type-check passes
- [ ] build passes
- [ ] git diff shows only allowed paths

## Forbidden (confirmed clean)

- No changes to: create/*, generate/*, canvas/*, media/proxy/*, cn-executor/*, navigation/*, TopNavigation, CanvasToolDock

## Next task (separate, after this page is verified)

Add /roadmap to SettingsHoverMenu MENU_ITEMS (C类 task, single commit).
