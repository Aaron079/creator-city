# Creator City Regional Execution System

## Overview

Creator City operates as a dual-region AI director platform. Generation work is routed
to one of two execution zones based on the provider's home region:

| Region | Execution Layer | Storage | Providers |
|--------|----------------|---------|-----------|
| `cn` | Aliyun Function Compute (`cn-executor`) | Aliyun OSS | Volcengine Seedream, Seedance, Jimeng, DeepSeek |
| `global` | Vercel (Next.js runtime) | Global (S3/R2/Vercel Blob — future) | OpenAI, Runway, Replicate, Fal, Stability, Google, Midjourney, Kling |

---

## Why CN API uses Aliyun FC

China-region AI providers (火山引擎 / Volcengine, 即梦 / Jimeng, DeepSeek) are:

1. **Not reachable from Vercel** — Vercel runs in global edge PoPs (US, EU, APAC).
   Connections to `ark.cn-beijing.volces.com` time out or fail DNS resolution.
2. **Require Chinese ICP-compliant infrastructure** — API keys issued by Chinese
   platforms are typically restricted to mainland IP ranges.
3. **Return assets to Chinese storage (Aliyun OSS)** — OSS buckets are private,
   scoped to a VPC or IP allowlist. Downloading from a Vercel IP is not allowed.

Solution: `cn-executor` is a Node.js HTTP server deployed as an Aliyun Function
Compute (FC) instance. Vercel delegates CN generation requests to it via
`CREATOR_CN_API_BASE_URL`.

---

## Why Global API uses Vercel

Global providers (OpenAI, Runway, Replicate, etc.) are:

1. **Reachable from Vercel** — All listed providers have global API endpoints with
   no geo-restriction on requests from Vercel PoPs.
2. **Return assets to CDN / global storage** — URLs are publicly reachable; no bridge needed.
3. **Latency is acceptable from US/EU PoPs** — Latency from CN PoPs to these providers
   would be worse, not better.

---

## Provider Region Table

### CN Providers

| Adapter ID | Label | Runtime Provider IDs |
|---|---|---|
| `volcengine_seedream` | Volcengine Seedream | `volcengine-seedream-image` |
| `volcengine_seedance` | Volcengine Seedance | `volcengine-seedance-video` |
| `jimeng` | Jimeng (即梦) | `jimeng-image`, `jimeng-video`, `jimeng` |
| `deepseek` | DeepSeek | `deepseek`, `deepseek-chat`, `deepseek-v3`, `deepseek-r1`, `deepseek-text` |

### Global Providers (registered, availability: future)

| Adapter ID | Label | Runtime Provider IDs |
|---|---|---|
| `openai` | OpenAI | `openai`, `openai-image`, `openai-video` |
| `runway` | Runway | `runway`, `runway-video` |
| `replicate` | Replicate | `replicate`, `replicate-image`, `replicate-video` |
| `fal` | Fal | `fal`, `fal-ai`, `fal-image`, `fal-video` |
| `stability` | Stability AI | `stability`, `stable-diffusion`, `sdxl` |
| `google` | Google (Imagen / Veo) | `google`, `google-imagen`, `google-veo` |
| `midjourney` | Midjourney | `midjourney`, `midjourney-image` |
| `kling_global` | Kling (Global) | `kling`, `kling-video`, `kling-image`, etc. |

---

## Asset storageRegion and sourceProviderRegion

Every Asset and every GenerationJob input/output carries region metadata:

| Field | Meaning |
|---|---|
| `storageRegion` | Where the asset bytes are stored: `cn` = Aliyun OSS, `global` = S3/R2/Vercel Blob |
| `sourceProviderRegion` | Which region produced the asset (provider home region) |
| `executionRegion` | Which execution layer ran the generation (cn-executor vs Vercel) |
| `executorKind` | Specific executor: `aliyun_fc`, `vercel`, `global_executor`, `none` |

These fields are written into:
- `Asset.metadataJson`
- `GenerationJob.input` and `GenerationJob.output`
- `CanvasNode.metadataJson`

---

## Cross-Region Asset Use — Why Bridge Is Required

### Problem

When a user uploads an image to **Aliyun OSS** (a CN asset) and then asks a
**global provider** (e.g. Runway) to use it as a reference:

- The global provider API is called from Vercel
- Vercel passes the OSS URL to Runway
- Runway tries to download it from a US IP → **OSS blocks the request**
  (private bucket, no public access from outside CN VPC)

The reverse is also true: a CN provider (Seedream) cannot download assets
from Vercel Blob or S3 because those URLs may be signed/ephemeral or
geo-restricted.

### Detection

`detectAssetRegionBridgeRequirement(asset, targetExecutionRegion)` in
`apps/web/src/lib/assets/asset-region-bridge.ts` checks `sourceStorageRegion`
vs `targetExecutionRegion` and returns:

```ts
{
  required: true,
  reason: 'asset_region_bridge_required',
  sourceStorageRegion: 'cn',
  targetExecutionRegion: 'global',
}
```

### Current v1 Behaviour

**v1 only detects — it does not copy.**

If `required=true`, the response includes `errorCode: 'asset_region_bridge_required'`
and generation is blocked with a clear message. No silent cross-region download
is attempted.

---

## v2 Roadmap — Regional Asset Copy

The following features are deferred to v2:

1. **CN → Global bridge**: Download from Aliyun OSS (via cn-executor which has
   access), re-upload to global storage (S3/R2), return a globally accessible URL.

2. **Global → CN bridge**: Download from global storage (via Vercel), upload to
   Aliyun OSS (via cn-executor), return an OSS URL for CN providers.

3. **Regional asset copy queue**: Async bridge jobs tracked in a `BridgeJob` table,
   with retry and status polling.

4. **Task / queue table**: For long-running cn-executor tasks (video generation),
   persist task state in a DB table instead of in-memory Map + OSS JSON.

---

## Key Files

| File | Purpose |
|---|---|
| `apps/web/src/lib/regions/registry.ts` | Canonical provider + storage registry |
| `apps/web/src/lib/regions/types.ts` | `Region`, `ExecutorKind`, `ProviderAdapterId`, etc. |
| `apps/web/src/lib/regions/router.ts` | Region decision functions |
| `apps/web/src/lib/providers/provider-region-registry.ts` | Convenience helpers: `isCnProvider`, `isGlobalProvider`, etc. |
| `apps/web/src/lib/executors/executor-gateway.ts` | Core routing + HTTP forwarding to executors |
| `apps/web/src/lib/executors/regional-executor-gateway.ts` | Regional gateway façade + diagnostic types |
| `apps/web/src/lib/generation/regional-generation-contract.ts` | `RegionalGenerationRequest`, `RegionalGenerationResponse`, `REGIONAL_ERROR_CODES` |
| `apps/web/src/lib/assets/asset-region-bridge.ts` | Cross-region asset detection |
| `apps/cn-executor/src/` | Aliyun FC HTTP server (cn-executor) |
| `docs/ALIYUN-FC-CN-EXECUTOR-SETUP.md` | cn-executor deployment guide |

---

## Error Codes

| Code | Meaning |
|---|---|
| `executor_region_missing` | CN provider but `CREATOR_CN_API_BASE_URL` not set |
| `provider_region_mismatch` | Provider home region ≠ expected execution region |
| `asset_region_bridge_required` | Asset in wrong region for target executor |
| `asset_region_bridge_failed` | Bridge attempted and failed |
| `provider_network_failed` | Timeout / DNS / TCP failure reaching provider |
| `provider_invalid_parameter` | Provider rejected API parameters |
| `provider_model_invalid` | Model/endpoint ID not found |
| `oss_upload_error` | Aliyun OSS upload failure |
| `canvas_save_error` | CanvasNode DB write failure |
| `regional_execution_error` | Generic regional execution failure |
