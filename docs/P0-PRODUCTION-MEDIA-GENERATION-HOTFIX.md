# P0 Production Media, Generation, And Drag Hotfix

Date: 2026-05-11

## Why Previous Fixes Did Not Close P0

`cf81fd9` and `5b9c209` improved local resolver code, but they did not remove the real acceptance blocker: the production `/create` page still had no logged-in, current-canvas diagnostic surface. Local scripts could report zero local assets or pass route checks while the real browser still rendered legacy CanvasNode data that the scripts never saw.

Earlier success reports were misleading because they mixed server/script reachability with page acceptance. The correct standard is: latest Vercel Production commit deployed, logged-in `/create` opened, current real image/video nodes diagnosed from the page, recoverable nodes fixed in-place, and drag verified in the browser.

## Old Image/Video Display Root Cause

Legacy CanvasNodes were not consistent about where `assetId` lived. The page must read all historical fields: `node.assetId`, `node.data.assetId`, `node.metadataJson.assetId`, `node.metadataJson.asset.id`, `asset_id`, `mediaAssetId`, `resultAssetId`, `outputAssetId`, `generationJob.outputAssetId`, `generationResult.outputAssetId`, `pluginResult.outputAssetId`, and `mediaPersistence.assetId/outputAssetId`.

Some nodes also had `storageKey` but stale provider URLs or expired signed URLs. A failed old URL does not prove the object is unrecoverable when `storageKey` exists. The resolver now avoids marking signed URL failures as `unrecoverable_expired_signed_url_without_storage_key` when a storage key is present.

`CanvasNodeCard` should display `metadataJson.resolvedUrl` / `assetUrl` / `stableUrl` before old `resultImageUrl` / `resultVideoUrl`. If a resolved URL exists, it must not show “不可恢复”.

## Recovery Strategy

For nodes with `assetId`, `/api/assets/resolve-batch` and `/api/assets/{assetId}/recover` resolve the Asset and return:

```json
{
  "assetId": "...",
  "status": "ready | missing | needs_signed_url | proxy_required | missing_env | storage_permission_error | object_missing | provider_error | unrecoverable_*",
  "resolvedUrl": "...",
  "storageKey": "...",
  "storageProvider": "aliyun-oss",
  "bucket": "...",
  "recoveryStatus": "...",
  "error": null,
  "actionTaken": "resolved_existing_storage"
}
```

For nodes without `assetId`, the page now first calls `/api/assets/resolve-by-node` to find an existing Asset owned by the current user for that `nodeId`. If found, it writes `assetId`, `resolvedUrl`, storage fields, and recovery status back into the current node.

If no Asset is found but an old URL exists, `/api/media/resync` downloads that URL, uploads the bytes to Aliyun OSS or the configured storage provider, creates an Asset, writes `CanvasNode.metadataJson.assetId`, writes `resolvedUrl/stableUrl/storageKey`, and saves the canvas. This is not a mock recovery path.

## Aliyun OSS Resolution

Storage resolution attempts object existence and then signed/public URL resolution. For private buckets, `403` means permission/signing is required, not automatic unrecoverability. Valid non-final classifications include:

- `needs_signed_url`
- `proxy_required`
- `missing_env`
- `storage_permission_error`
- `object_missing`
- `provider_error`

Truly unrecoverable is reserved for no Asset ID, no storage key, no original/provider URL, no provider job, expired `blob:` URL, or unusable data URL without file bytes.

## Page-Level P0 Panel

`/create` now has a logged-in page panel named `P0 媒体自检`. It reads the current in-memory canvas nodes, not local mock data and not the admin debug route.

The panel shows:

- current project id and workflow id
- total node count
- image/video node count
- per-node `nodeId`, kind, position, prompt, provider, `assetId`, assetId source field, generation job id, provider job id
- URL existence for `resultImageUrl`, `resultVideoUrl`, `stableUrl`, `originalUrl`, `currentUrl`, `storageKey`, and `resolvedUrl`
- the inferred `CanvasNodeCard` media `src`
- `recoveryStatus`, `error`, unrecoverable flag, storage-key failure reason, and whether the node has any recoverable source
- full diagnostic JSON for screenshot/copy

Per node actions:

- `重新 resolve 该节点`
- `立即恢复资产`
- `从 nodeId 查找已有 Asset`
- `从旧 URL 重新导入到 OSS`
- `用原 Prompt 重新生成`
- `复制该节点诊断 JSON`

The regenerate button first runs provider health (`GET /api/generate/image` or `GET /api/generate/video`) and requires user confirmation before any real paid generation call.

## New Generation Chain

Image generation calls `/api/generate/image`; video generation calls `/api/generate/video`. Provider/env/API errors are returned with `errorCode`, missing env keys, upstream status/message, raw code, and request id when available.

On provider success, `persistGeneratedMedia` downloads the provider file, uploads it to storage, creates an Asset, links `GenerationJob.outputAssetId`, writes `assetId` and stable URL to CanvasNode metadata, and allows refresh recovery through `getNodeAssetId` plus `resolve-batch`.

Production env checklist:

- `DATABASE_URL`
- `MEDIA_PERSISTENCE_ENABLED` not `false`
- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_OSS_BUCKET`
- `ALIYUN_OSS_REGION`
- `ALIYUN_OSS_ENDPOINT`
- `ALIYUN_OSS_PUBLIC_BASE_URL`
- image provider env, for example `VOLCENGINE_ARK_API_KEY`, `VOLCENGINE_SEEDREAM_MODEL`, `VOLCENGINE_ARK_BASE_URL`
- video provider env, for example `VOLCENGINE_SEEDANCE_MODEL`
- optional admin automation env `P0_DEBUG_TOKEN`

## Drag Regression

The `/create` canvas is custom pointer-based canvas, not ReactFlow. There are no `nodesDraggable` or `nodeDragHandle` ReactFlow settings.

Drag wiring:

- `CanvasNodeCard.tsx`: root `onPointerDown` starts drag unless the target is interactive.
- `VisualCanvasWorkspace.tsx`: `handleNodeDragStart` records pointer/start position.
- window `pointermove` updates `node.x/node.y`.
- window `pointerup/pointercancel` flushes local snapshot and calls `scheduleCanvasSave(0)`.

Draggable areas are the node root frame, border, header, and blank zones. Buttons, inputs, textareas, selects, connection handles, dialogs, preview click surfaces, and the P0 panel are `nodrag`.

The root double-click behavior no longer opens the prompt editor through the frame; it selects the node and leaves it movable. Preview double-click remains scoped to preview.

## Real Browser Acceptance

After latest Vercel Production deploy is green and points to the newest commit:

1. Open `https://creator-city-vert.vercel.app/create`.
2. Log in.
3. Click `P0 媒体自检`.
4. Copy full diagnostics JSON.
5. For an old image node, click `立即恢复资产`.
6. For an old video node, click `立即恢复资产`.
7. Confirm old image/video render in the node card.
8. Generate a new image; confirm it renders and still renders after refresh.
9. Generate a new video, or confirm the displayed provider/env/API error is concrete.
10. Double-click/select the node frame, drag from frame/header/blank area, refresh, and confirm position persists.
11. Confirm node buttons still click normally.

Scripts passing is not page acceptance. The P0 rule is: no “代码已修复” claim until production deploy is current and the logged-in real page can diagnose and repair the current canvas.
