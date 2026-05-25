# Plan: Asset Library

**Goal:** Upgrade /assets page to dark premium style matching Task Center + Provider Center.
Reuse existing /api/assets (already auth-gated, comprehensive). Add CanvasToolDock link.

**Pre-flight answers (7 questions):**
1. Rewriting /assets/page.tsx (read-only UI). Adding "资产中心" link to CanvasToolDock (+1 line).
2. No protected files touched
3. No payload changes
4. No auto-POST (single GET fetch on mount)
5. No polling (one-shot fetch, manual refresh only)
6. No node/edge clearing (different page entirely)
7. type-check + build pass; generation routes untouched

**Key finding:** /api/assets already exists, auth-gated, returns:
- id, type, url, dataUrl, thumbnailUrl, resolvedUrl, generationJobId, prompt (full — truncate in UI to 80)
- width, height, duration, mimeType, providerId, sizeBytes, createdAt, project

---

## Steps

- [x] Read required docs
- [x] Explore Asset schema + existing API and page
- [ ] Rewrite `apps/web/src/app/assets/page.tsx` — dark premium style, video support, stats, copy buttons
- [ ] Update `apps/web/src/components/create/CanvasToolDock.tsx` — add "资产中心" link
- [ ] `pnpm --filter web type-check` — must pass
- [ ] `pnpm --filter web build` — must pass
- [ ] git add + commit + push
- [ ] Confirm Vercel production ready

## Files Changed

**Modified (rewrite):**
- `apps/web/src/app/assets/page.tsx`

**Modified (+1 line):**
- `apps/web/src/components/create/CanvasToolDock.tsx`

**Unchanged (reusing existing):**
- `apps/web/src/app/api/assets/route.ts`

## Security Constraints

- Auth handled by existing /api/assets (getCurrentUser, ownerId filter)
- No storageKey / bucket / providerJobId / error (raw) displayed in UI
- prompt truncated to 80 chars in UI
- No env/secret values displayed

## Definition of Done

- /assets page loads with grid of image + video assets
- Image cards show thumbnail
- Video cards show inline player (controls, no autoplay)
- generationJobId and URL copyable
- Stats: total, images, videos
- Type filter: all/image/video
- Dark style matches Task Center / Provider Center
- type-check + build pass
- push + Vercel ready
