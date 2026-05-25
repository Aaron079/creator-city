# Plan: 媒体节点双击放大预览 (Media Lightbox)

## Goal
Add double-click-to-expand lightbox for image and video nodes. Pure frontend UI only — no API, no generation chain.

## Protected (do not modify)
- Any file under `apps/web/src/app/api/generate/`
- `apps/cn-executor/` (entire directory)
- OSS config, Supabase schema, Volcengine API config

## Allowed files
- `apps/web/src/components/create/CanvasNodeCard.tsx`
- `apps/web/src/components/create/MediaLightbox.tsx` (new)

## Design decisions
- `MediaLightbox` renders via `createPortal(…, document.body)` → z-[9999], above canvas/toolbar/AI button
- State `lightbox: { type, url } | null` lives in CanvasNodeCard (per-node, no prop-threading)
- ESC: `document.addEventListener('keydown', …)` inside `useEffect`, cleaned up on close/unmount
- Backdrop click: closes for both image and video
- Image click: also closes (natural UX)
- Video: `stopPropagation` on `<video onClick>` so controls work; backdrop still closes
- `event.stopPropagation()` on `onDoubleClick` prevents bubbling to root card's `onEdit()`
- No changes to polling, generation, save, or node state

## Steps

- [x] Step 0: Audit CanvasNodeCard image/video preview areas
- [ ] Step 1: Create `MediaLightbox.tsx` — portal, ESC, backdrop close, hover hint
- [ ] Step 2: Wire CanvasNodeCard — add lightbox state + onDoubleClick on both preview areas + render
- [ ] Step 3: pnpm --filter web type-check && pnpm --filter web build
- [ ] Step 4: git add + commit + push origin main

## Definition of done
- Double-click image → fullscreen lightbox (object-contain, max 88vw/88vh)
- Double-click video → fullscreen lightbox with controls
- Click backdrop or ESC → close
- Close → node untouched, imageUrl/videoUrl intact, no generation POST
- type-check + build pass
- git status --short empty after push
