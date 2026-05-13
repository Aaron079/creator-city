# Creator City Dual Region Architecture

Status: architecture foundation only. This document and the region router do not migrate existing data, do not change `/create`, and do not change current image/video generation behavior.

## 1. Why Dual Region Is Needed Now

Creator City already has two very different execution realities:

- China projects depend on Volcengine and China-accessible object storage.
- Global projects will need OpenAI, Runway, Replicate, Fal, S3, R2, or Vercel Blob, usually from overseas workers.

Treating all jobs as one region makes provider calls, media downloads, persistence, and retry behavior fragile. A first-class region model lets the product decide where generation and storage should happen before we attach more providers.

## 2. Current Vercel To China Provider/OSS Problem

The current production app runs on Vercel and calls China providers and OSS from a global/serverless environment. That creates several risks:

- Higher latency from Vercel regions to Volcengine Ark endpoints.
- Provider media URLs can expire before persistence finishes.
- China object storage signing and download paths behave differently from overseas storage.
- Retry logic can accidentally treat provider API endpoints as media URLs if routing metadata is not separated from media metadata.

The current fix is not to move all workloads immediately. The current fix is to model the regions explicitly so later executors can be selected without changing the business surface.

## 3. China Stack

The China Stack is the active stack today for generated media:

- Providers: Volcengine Seedream and Volcengine Seedance.
- Storage: Aliyun OSS.
- Backend placement: China, Hong Kong, or Singapore-adjacent service runtime.
- Audience: China users and China projects.

Current defaults keep `projectRegion = "cn"`, Volcengine providers in `cn`, and `aliyun_oss` in `cn`.

## 4. Global Stack

The Global Stack is registered as future infrastructure only:

- Providers: OpenAI, Runway, Replicate, Fal.
- Storage: S3, Cloudflare R2, Vercel Blob.
- Execution: overseas Worker or Executor close to those APIs and storage buckets.
- Audience: overseas users and overseas projects.

No Global provider is wired into the live generation path in this change.

## 5. Provider Router

Provider routing is represented in `apps/web/src/lib/regions/registry.ts` and `apps/web/src/lib/regions/router.ts`.

Current mapping:

| Provider adapter | Region | Availability | Runtime aliases |
| --- | --- | --- | --- |
| `volcengine_seedream` | `cn` | `active` | `volcengine-seedream-image` |
| `volcengine_seedance` | `cn` | `active` | `volcengine-seedance-video` |
| `openai` | `global` | `future` | `openai`, `openai-image`, `openai-video` |
| `runway` | `global` | `future` | `runway`, `runway-video` |
| `replicate` | `global` | `future` | `replicate`, `replicate-image`, `replicate-video` |
| `fal` | `global` | `future` | `fal`, `fal-ai`, `fal-image`, `fal-video` |

`getProviderRegion(provider)` returns the configured provider region while preserving unknown providers as the project default for now.

## 6. Storage Router

Storage routing is represented in the same registry and router.

Current mapping:

| Storage adapter | Region | Availability | Runtime aliases |
| --- | --- | --- | --- |
| `aliyun_oss` | `cn` | `active` | `aliyun-oss`, `aliyun_oss` |
| `s3` | `global` | `future` | `s3`, `aws-s3` |
| `cloudflare_r2` | `global` | `future` | `cloudflare-r2`, `cloudflare_r2`, `r2` |
| `vercel_blob` | `global` | `future` | `vercel_blob`, `vercel-blob` |

`resolveStorageProvider({ projectRegion, providerRegion })` currently chooses a storage provider in the project region. For `cn`, that means `aliyun_oss`.

## 7. GenerationJob Router

`resolveGenerationRegion({ userRegion, projectRegion, provider })` returns:

- `userRegion`
- `projectRegion`
- `providerRegion`
- final `region`
- whether the job is cross-region
- whether it should use an async executor

Today, the returned final region is the project region. This keeps China projects on the China Stack and gives future Global projects a stable place to route from.

## 8. Asset Replica Strategy

The eventual asset model should distinguish:

- Primary asset storage region.
- Optional replica storage regions.
- Provider original URL.
- Durable storage key.
- Signed URL generation region.

For China projects, the primary should stay in China storage first. For Global projects, the primary should be in global storage first. Replication can be added later for review links, delivery, and collaboration, but this change does not add replica writes.

## 9. pending_persistence Strategy

`pending_persistence` should remain a first-class state. In a dual-region architecture it means:

- Provider generation may have succeeded.
- Durable storage in the target project region has not completed.
- The client may show a temporary provider URL only when it is a real media URL.
- Recovery should retry persistence through the correct regional executor.

Cross-region persistence should not block the UI indefinitely. It should enqueue and surface a retryable state.

## 10. Future Global API Integration

To connect a Global provider later:

1. Add the real provider adapter under the provider layer.
2. Keep its registry entry as `global`.
3. Select a Global Executor when `resolveGenerationRegion()` reports `global` or cross-region.
4. Persist media to `s3`, `cloudflare_r2`, or `vercel_blob`.
5. Keep China project routing unchanged.

The registry already marks OpenAI, Runway, Replicate, and Fal as `future` so their presence cannot be mistaken for live availability.

## 11. China Projects Use China Providers

For current projects:

- Default project region is `cn`.
- Volcengine Seedream and Seedance are `cn`.
- Aliyun OSS is `cn`.

So current China projects continue to generate and persist through the existing China chain.

## 12. Overseas Projects Use Global Executor

When project region support is later added to project records, a `global` project should:

- Route OpenAI, Runway, Replicate, or Fal calls to the Global Executor.
- Persist generated assets to Global storage.
- Avoid sending provider downloads through China storage unless an explicit replica job asks for it.

This is not connected to the live generation route yet.

## 13. Why Cross-Region Jobs Must Be Async

Cross-region jobs require async execution because they may involve:

- Long provider generation times.
- Remote media download from another region.
- Durable upload to a different storage region.
- Replica creation.
- Retry after provider URL expiry or storage timeout.

Synchronous request/response handling is too fragile for that path. `shouldUseAsyncExecutor()` therefore returns true whenever user, project, provider, or storage regions differ.

## 14. No Data Migration In This Change

This change does not:

- Add database columns.
- Migrate existing projects.
- Migrate assets.
- Change current provider calls.
- Change current storage writes.
- Delete old nodes.
- Mock provider success.

It only creates the type model, registries, router functions, and architecture document needed for the next phase.
