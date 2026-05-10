# P0 Asset Loss Incident Repair

## Problem

Some paid image and video nodes on `/create` could no longer display after refresh or redeploy. The UI showed generic recovery states such as unreadable media, expired links, or object storage errors instead of either restoring the media or recording a final unrecoverable reason.

## Root Cause

Older canvas nodes often kept temporary provider URLs in node data without a durable `assetId`. Some Asset rows also lacked first-class durable fields such as `storageKey`, `storageProvider`, `bucket`, `originalUrl`, `providerJobId`, and `recoveryStatus`.

The earlier repair added diagnostics and partial resolve logic, but it still had gaps:

- If an Asset had `storageKey` but the object was missing or unreadable, resolve stopped at `missing` instead of trying `originalUrl` or `providerJobId`.
- Provider retrieve not implemented could leave the asset in `NEEDS_RECOVERY`.
- Canvas cards did not have an assetId-level recover action.
- There was no `/api/assets/[assetId]/recover` or `/api/assets/recover-batch` endpoint.

## Recovery Strategy

For each Asset:

1. Check `storageKey` through the storage adapter.
2. If the object exists, generate a fresh `resolvedUrl`.
3. If the object is missing or unreadable, try `originalUrl` or legacy `url`.
4. If the URL downloads, upload the bytes to durable storage and update the Asset with `storageProvider`, `bucket`, `storageKey`, `mimeType`, `size`, `status=READY`, and `recoveryStatus`.
5. If the URL is expired but `providerJobId` exists, try provider retrieval.
6. If provider retrieval is unavailable, write `recoveryStatus=unrecoverable_provider_retrieve_not_implemented`.
7. If recovery is impossible, write a concrete `unrecoverable_*` reason.

## Future Protection

New generated media must immediately pass through `persistGeneratedMedia`:

1. Download provider output.
2. Upload to durable storage.
3. Create Asset with `storageKey`.
4. Link GenerationJob/provider metadata.
5. Store `assetId` on the canvas node.
6. On page load, call resolve APIs to get a fresh `resolvedUrl`.

## Asset Fields

Asset persistence depends on first-class fields:

`provider`, `providerJobId`, `providerAssetId`, `storageProvider`, `bucket`, `storageKey`, `url`, `thumbnailUrl`, `originalUrl`, `filename`, `mimeType`, `size`, `width`, `height`, `duration`, `prompt`, `negativePrompt`, `metadata`, `metadataJson`, `status`, `recoveryStatus`, and `error`.

## GenerationJob Fields

Generation jobs must retain:

`userId`, `projectId`, `providerId`, `provider`, `providerJobId`, `nodeType`, `kind`, `status`, `input`, `output`, `outputAssetId`, `error`, and `completedAt`.

## Storage Adapter

`/Users/aaron/creator-city/apps/web/src/lib/assets/storage-adapter.ts` owns storage operations:

- `uploadAsset`
- `resolveAssetUrl`
- `downloadExternalAsset`
- `checkObjectExists`

Production storage should use Supabase Storage or configured object storage. `local_dev` is only allowed outside production.

## APIs

- `GET /api/assets/:assetId/resolve`
- `GET /api/media/resolve?assetId=...`
- `POST /api/assets/resolve-batch`
- `POST /api/assets/:assetId/recover`
- `POST /api/assets/recover-batch`
- `POST /api/media/resync`

Resolve APIs may perform recovery when needed. Recover APIs always attempt to reach a final state: `ready`, `missing`, or a concrete `unrecoverable_*` reason.

## Scripts

- `cd /Users/aaron/creator-city && pnpm dlx tsx scripts/audit-assets.ts`
- `cd /Users/aaron/creator-city && pnpm dlx tsx scripts/recover-assets.ts`
- `cd /Users/aaron/creator-city && pnpm dlx tsx scripts/backfill-canvas-asset-ids.ts`

Run audit first, then recover, then canvas backfill.

## Local Test

1. `cd /Users/aaron/creator-city && pnpm install`
2. `cd /Users/aaron/creator-city && pnpm --filter web prisma:generate`
3. `cd /Users/aaron/creator-city && pnpm --filter web type-check`
4. `cd /Users/aaron/creator-city && pnpm --filter web build`
5. Run the three recovery scripts with a reachable `DATABASE_URL` and storage credentials.

## Online Verification

After migration and scripts run against production:

1. Open `/create`.
2. Confirm old image nodes display or show a concrete unrecoverable reason.
3. Confirm old video nodes display or show a concrete unrecoverable reason.
4. Click “立即恢复资产” on failed nodes.
5. Click “扫描并恢复历史资产” for canvas-wide recovery.
6. Generate a new image, refresh, and confirm it still displays.
7. Generate a new video, refresh, and confirm it still displays.
8. Confirm Asset rows have `storageKey`.
9. Confirm resolve APIs return fresh `resolvedUrl`.

## Explaining Unrecoverable Assets

Use the recorded `recoveryStatus`:

- `unrecoverable_blob_url`: only a browser blob URL was saved.
- `unrecoverable_data_url_without_file`: the saved data URL could not be parsed into a file.
- `unrecoverable_expired_signed_url_without_storage_key`: only an expired signed URL was saved.
- `unrecoverable_provider_expired`: the provider result is no longer retrievable.
- `unrecoverable_provider_retrieve_not_implemented`: a provider job ID exists, but no retrieve adapter is implemented yet.
- `unrecoverable_no_record`: no assetId, stable URL, original URL, or provider job ID exists.

## Prevention Checklist

- Never store signed URLs as the asset body.
- Never rely on `blob:`, `/tmp`, `public/generated`, localStorage, or frontend state for paid assets.
- Every generated media response must create an Asset.
- Every canvas media node must save `assetId`.
- Every page load must resolve by `assetId`.
- Recovery scripts must run after schema changes.
- Production deploys must include migration confirmation.
