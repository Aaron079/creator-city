# P0 Production Media, Generation, And Drag Hotfix

Date: 2026-05-10

## Why `cf81fd9` Was Not Enough

`cf81fd9` shipped code that could pass local scripts with zero local assets, but the real production page still depended on legacy CanvasNode shapes and production-only media URLs. The visible page still showed recovery copy because `CanvasNodeCard` could choose stale `resultImageUrl` / `resultVideoUrl` before a resolved storage URL, and some legacy nodes did not expose `assetId` through the narrow fields the UI was reading.

The previous reports were misleading because local scripts saw `0` assets and `0` canvas nodes. That proves the scripts ran, not that production nodes rendered. The acceptance standard is the real `/create` page after login and deployment.

## Old Media Root Cause

Legacy image/video nodes can have `assetId` in several historical locations: `node.assetId`, `node.data.assetId`, `metadataJson.assetId`, `metadataJson.asset.id`, `asset_id`, `mediaAssetId`, `resultAssetId`, `outputAssetId`, and `generationJob.outputAssetId`. The old UI only read a subset, so good assets could look unrecoverable.

`CanvasNodeCard` now uses `resolvedUrl` / `assetUrl` / `stableUrl` before old provider URLs. `resolve-batch` returns `ready` with `resolvedUrl` when storage can be signed or otherwise resolved. Storage failures are classified as `needs_signed_url`, `proxy_required`, `missing_env`, `storage_permission_error`, `object_missing`, or `provider_error` before using truly unrecoverable states.

Assets are truly unrecoverable only when there is no usable `assetId`, no `storageKey`, no original/provider URL, no `providerJobId`, and the only saved source is an expired `blob:` URL or unusable data URL.

## Recovery Strategy

When a node has no visible `assetId`, `/api/media/resync` first looks up an existing `Asset` by `nodeId`. If found and resolvable, it writes `assetId`, `resolvedUrl`, storage fields, and recovery status back to `CanvasNode.metadataJson`.

If no existing Asset is found but an old URL exists, resync downloads the URL, uploads the bytes to configured storage, creates an Asset, updates CanvasNode metadata, and returns a stable URL for immediate display.

For Aliyun OSS, storage resolution attempts object existence through a signed URL, then returns a signed/public URL through `resolveAssetUrl`. A 403 is treated as a permission/signing problem, not automatically unrecoverable.

## New Generation Chain

Image generation submits to `/api/generate/image`; video generation submits to `/api/generate/video`. Provider/env errors are returned to the UI with `errorCode`, missing env keys, upstream status/message, raw code, and request id when available.

On provider success, `persistGeneratedMedia` downloads the provider file, uploads it to storage, creates an Asset, links the GenerationJob `outputAssetId`, and writes the Asset ID plus stable URL back to CanvasNode. Refresh can then recover through `getNodeAssetId`, `resolve-batch`, and `CanvasNodeCard`.

The dry-run health path does not call paid providers. Real generation still requires production provider env and user credits.

## Drag Interaction

The create canvas is custom pointer-based canvas, not ReactFlow. Dragging is owned by:

- `apps/web/src/components/create/CanvasNodeCard.tsx`: root `onPointerDown` starts node drag unless the target is interactive.
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx`: `handleNodeDragStart`, window `pointermove`, and window `pointerup` update `x/y`, flush local snapshot, and call `scheduleCanvasSave(0)`.

Draggable areas: node root, border, header, and empty zones.

Nodrag areas: buttons, inputs, textarea, select, preview click surfaces, connection handles, dialogs, context menus, and side panels.

Error overlays are scoped to `.canvas-node-preview`, so they do not cover the header or drag handle. Dragging uses `cursor: grab` and `cursor: grabbing`.

## Debug API

`GET /api/admin/p0-media-debug` is protected by `P0_DEBUG_TOKEN`. Missing or wrong token returns 404. The route does not return secrets or full URLs; URL fields are summarized as existence/host/type.

The response includes node id, kind, project id, position, metadata keys, asset ID source, generation job id, URL existence booleans, storage key existence, Asset existence/status, resolve status, resolved URL existence/source, CanvasNodeCard source choice, recovery status, error, object check result, and drag wiring.

Required production invocation:

```bash
cd /Users/aaron/creator-city && \
P0_DEBUG_TOKEN=<token configured in Vercel Production> pnpm dlx tsx scripts/test-real-canvas-node-debug.ts --base-url https://creator-city-vert.vercel.app
```

## Vercel Production Checklist

- `P0_DEBUG_TOKEN` configured.
- `DATABASE_URL` configured.
- Aliyun OSS env configured: `ALIYUN_ACCESS_KEY_ID`, `ALIYUN_ACCESS_KEY_SECRET`, `ALIYUN_OSS_BUCKET`, `ALIYUN_OSS_REGION`, `ALIYUN_OSS_ENDPOINT`, `ALIYUN_OSS_PUBLIC_BASE_URL`.
- Image provider env configured: `VOLCENGINE_ARK_API_KEY`, `VOLCENGINE_SEEDREAM_MODEL`, `VOLCENGINE_ARK_BASE_URL`.
- Video provider env configured: `VOLCENGINE_ARK_API_KEY`, `VOLCENGINE_SEEDANCE_MODEL`, `VOLCENGINE_ARK_BASE_URL`.
- `MEDIA_PERSISTENCE_ENABLED` is not `false`.

## Real Browser Acceptance Steps

1. Open `https://creator-city-vert.vercel.app/create` in a real logged-in browser.
2. Confirm old image/video nodes show media, or show a specific classified reason.
3. Click `立即恢复资产` on failed nodes and confirm recoverable nodes render media.
4. Generate a new image and confirm it renders after refresh.
5. Generate a new video or confirm a concrete provider/env/API error is visible.
6. Double-click/select a node frame, drag it from frame/header/blank area, and confirm buttons still click.
7. Refresh and confirm the dragged position persists.
8. Use `/api/admin/p0-media-debug` with `P0_DEBUG_TOKEN` to compare the rendered node with DB/Asset/OSS state.

Passing scripts is not equivalent to passing the page. Completion requires latest Vercel Production deployed commit plus real browser verification after login.
