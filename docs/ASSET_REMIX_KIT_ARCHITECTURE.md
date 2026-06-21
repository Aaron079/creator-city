# Asset Remix Kit — Architecture
## Creator City — Pixel Execution Layer Design

> **Status**: IMPLEMENTED / WAITING_FOUNDER_REVIEW — type-check PASS · lint PASS · build PASS
>
> **Blocked by**: Production GPU executor deployment
>
> **Last updated**: 2026-06-21

---

## 1. Product Positioning

The Asset Remix Kit is the **pixel execution layer** of Creator City. It is distinct from the Director Tools (professional judgment layer).

| Layer | Purpose | Tools |
|---|---|---|
| Director Tools | Prompt enhancement, creative judgment, style guidance | Camera, Lighting, Lexicon, Bible, Shot List, Shot Sequencer |
| Asset Remix Tools | Real pixel-level transforms on generated assets | Remove Background, HD Reconstruction, Inpaint (future), Outpaint (future) |

**Core invariant**: Source assets are NEVER modified. Every transform creates a new derived node with its own asset ID, edge label, and lineage metadata.

---

## 2. Architecture Overview

```
Creator City Canvas (Browser)
     │
     │  User selects Image node with result
     │  → 工具 → 资产再创作 → 主体抠图 / 高清重建
     │
     ▼
RemoveBackgroundPanel / HdReconstructionPanel
     │ POST /api/asset-transform
     ▼
apps/web/src/app/api/asset-transform/route.ts
     │ Auth check → Kind validation → Env check
     │
     ├─ ASSET_TRANSFORM_EXECUTOR_URL not set
     │    → 503 TRANSFORM_EXECUTOR_UNAVAILABLE
     │
     └─ ASSET_TRANSFORM_EXECUTOR_URL set
          → proxy to external GPU service
          │
          ▼
     [External GPU Executor Service]
      POST {EXECUTOR_URL}/transform
      ├─ remove-background (SAM2 / rembg)
      └─ upscale (Real-ESRGAN or commercial equivalent)
          │
          ▼
     AssetTransformResult { transformId, status, outputMediaUrl }
          │
          ▼
Panel receives result → user confirms → createNode() called
     │
     ▼
New Derived Image Node
  └─ resultImageUrl: output asset URL
  └─ metadataJson.assetTransform: lineage record
  └─ metadataJson.derivedToolChannel: { label, icon }
  └─ Edge: ✂ 主体抠图 / ⬆ 高清重建
```

---

## 3. File Map

### New files

| Path | Purpose |
|---|---|
| `apps/web/src/lib/asset-transform/assetTransformTypes.ts` | Contract types: Request, Result, Executor adapter, Lineage |
| `apps/web/src/lib/asset-transform/assetTransformErrors.ts` | Error codes + user-facing messages |
| `apps/web/src/lib/asset-transform/assetTransformRegistry.ts` | Kind metadata, V1 availability flag, preferred executors |
| `apps/web/src/lib/asset-transform/assetTransformMetadata.ts` | Build/parse lineage from metadataJson |
| `apps/web/src/app/api/asset-transform/route.ts` | NEW POST route — proxies to external executor; not touching any generate route |
| `apps/web/src/components/create/RemoveBackgroundPanel.tsx` | Remove Background panel using DirectorToolPanelFrame |
| `apps/web/src/components/create/HdReconstructionPanel.tsx` | HD Reconstruction panel using DirectorToolPanelFrame |

### Modified files

| Path | Change |
|---|---|
| `apps/web/src/components/canvas/modal/canvasModalTypes.ts` | Added `'remove-background'` and `'hd-reconstruction'` to CanvasModalId |
| `apps/web/src/components/create/AssetAgentToolbar.tsx` | Added `onOpenRemoveBackground` + `onOpenHdReconstruction` props; added 资产再创作 section; **removed fake 增强 SOON button** |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | Added state + reset + open cases + panel renders + toolbar callbacks |

### Untouched (confirmed)

- `apps/web/src/app/api/generate/image/route.ts` — NOT TOUCHED
- `apps/web/src/app/api/generate/video/route.ts` — NOT TOUCHED
- `apps/cn-executor/` — NOT TOUCHED
- `apps/web/src/lib/billing/` — NOT TOUCHED
- `apps/web/src/lib/providers/` — NOT TOUCHED
- `prisma/schema.prisma` — NOT TOUCHED

---

## 4. Executor Adapter Interface

```typescript
interface AssetTransformExecutorAdapter {
  executorId: string
  getCapability(): Promise<AssetTransformExecutorCapability>
  submit(request: AssetTransformRequest): Promise<AssetTransformResult>
  poll(transformId: string): Promise<AssetTransformResult>
  cancel?(transformId: string): Promise<void>
}
```

The external GPU executor must implement a compatible HTTP API:
- `POST /transform` → accepts `AssetTransformRequest`, returns `AssetTransformResult`
- Optional: `GET /transform?transformId=...` → returns current `AssetTransformResult` for polling
- Optional: `DELETE /transform/:id` → cancel
- Optional: `GET /capabilities` → returns `AssetTransformExecutorCapability`

---

## 5. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ASSET_TRANSFORM_ENABLED` | **Required** | Must be `'true'` to enable the feature gate |
| `ASSET_TRANSFORM_EXECUTOR_URL` | **Required** | Base URL of the external GPU executor service |
| `ASSET_TRANSFORM_EXECUTOR_TOKEN` | Optional | Bearer token for executor auth (legacy fallback: `ASSET_TRANSFORM_EXECUTOR_API_KEY`) |

When `ASSET_TRANSFORM_ENABLED !== 'true'` or `ASSET_TRANSFORM_EXECUTOR_URL` is not set, the API route returns `503 TRANSFORM_EXECUTOR_UNAVAILABLE` immediately. The capability discovery GET returns `{ enabled: false, executorReady: false, capabilities: [] }`. All toolbar entries are hidden by default — not disabled, not "coming soon" — completely absent.

---

## 6. Asset Lineage Storage

Transform lineage is stored in `canvasNode.metadataJson.assetTransform`:

```typescript
{
  assetTransform: {
    transformKind: 'remove-background' | 'upscale',
    transformId: string,
    sourceNodeId: string,
    sourceAssetId?: string,
    outputAssetId?: string,
    executorId: string,
    modelId?: string,
    params: Record<string, unknown>,
    createdAt: string,
  },
  derivedToolChannel: {
    toolId: string,
    label: string,    // "✂ 主体抠图" | "⬆ 高清重建"
    icon: string,
    sourceNodeId: string,
  },
  toolSummaryText: string,       // shown in node badge
  sourceNodeTitle?: string,
}
```

No schema migration needed — uses existing `metadataJson` JSONB field.

---

## 7. Source Immutability Guarantee

The transform pipeline enforces source immutability at three levels:

1. **API route**: Never modifies the source asset; only creates a new output
2. **Panel**: Creates a new canvas node via `createNode()`, never patching source node
3. **Contract**: `AssetTransformRequest.sourceNodeId` is read-only; adapter has no write access to source

---

## 8. Deprecation Plan for Replaced Entries

| Old entry | Status | When removed |
|---|---|---|
| `增强 SOON` (disabled button) | **REMOVED in this commit** | Done — replaced by 高清重建 |
| `截图 SOON` (video, disabled) | **Kept** | Remove when real screenshot capability ships |
| Reframe modes (CSS-only) | Kept | Remove when real inpaint/reframe ships |

Old tools NOT removed (preserved per task spec):
- 资产变体规划 (Variant Planner) — planning tool, no executor
- 版本对比 A/B (A/B Compare) — informational, no executor
- 关键帧提取 (Keyframe Extractor) — browser canvas, real capability
- 调色盘 (Color Grade) — CSS + prompt, no executor
- 视觉风格包 (Look Package) — planning tool

---

## 9. V2 Roadmap (not in V1)

These capabilities are registered in `assetTransformRegistry.ts` with `v1Available: false`. Their toolbar entries are suppressed until a production executor is validated.

| Kind | V2 Executor | Notes |
|---|---|---|
| `segment` | SAM2 with click/text prompt | Requires UI for click input |
| `inpaint` | IOPaint / ComfyUI workflow | Requires mask drawing UI |
| `outpaint` | ComfyUI / commercial | Requires canvas extension UI |
| `variation` | img2img pipeline | Requires strength control |
| `extract-control-map` | ControlNet preprocessors | Output: depth/canny/pose |
| `interrogate` | CLIP/BLIP | Output: text prompt |
