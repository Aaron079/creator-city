# Asset Remix — Output Ingestion Design (Presigned PUT via Gateway Service)

**Status:** APPROVED / DESIGN_FROZEN
**Date:** 2026-06-21
**Revision:** 3 — Gateway Service (Railway) handles output validation and calls CC Internal Ingest API; Gateway holds no Prisma/DATABASE_URL; CC generates all signed URLs; asset creation happens entirely within CC
**Scope:** End-to-end design for ingesting executor output into Creator City platform storage

---

## 1. Ingestion Goal

After a RunPod worker completes subject extraction, we must:

1. Verify the output object is valid and owned by this job (key prefix check)
2. HEAD verify: object exists, correct MIME and size
3. GET buffer from CC OSS; compute SHA-256; compare to worker-reported hash
4. PUT stable permanent key in CC OSS (separate from the worker-upload temp key)
5. Create Asset record (`type=IMAGE`, `source='transform'`, `status=READY`)
6. Record lineage in `metadataJson`
7. Resolve `pendingAssetTransforms` entry in `CanvasWorkflow.metadataJson`
8. Return `{ outputAssetId, stableOutputMediaUrl, outputOwner: 'creator-city', ingestionStatus: 'validated' }`

Only after all 8 steps complete does the frontend receive `status: 'done'`.

Steps 1–4 (key verify, HEAD, SHA-256, stable key PUT) run inside the **Gateway Service on Railway Pro** when it polls RunPod and first observes `COMPLETED`. Steps 5–7 (Asset create, pendingAssetTransforms update, response) execute via **CC Internal Ingest API** (`/api/internal/asset-transform/ingest`), called by the Gateway Service over HMAC-authenticated service-to-service request. The Gateway Service holds no Prisma/DATABASE_URL.

---

## 2. Presigned PUT Output Transmission Design

### Why presigned PUT (not ephemeral re-download)

| Approach | Latency | Complexity | Buffer route |
|---|---|---|---|
| Worker → presigned PUT → CC OSS | One hop | Requires real PUT URL (stub fix needed) | Worker → OSS directly |
| Worker → RunPod temp storage → Executor re-download → CC OSS | Two hops + extra service | Simpler credentials | Worker → RunPod → Executor → OSS |
| Worker returns base64 in job output | Zero hops | Trivial | Worker → RunPod JSON → CC |

**Decision: Presigned PUT.** Base64 is eliminated (10MB output limit; large PNGs would hit it). Ephemeral re-download requires an Executor Gateway service (Option B, not selected). Presigned PUT gives direct Worker → CC OSS path with no intermediate buffer and no extra service.

### Prerequisite: fix `getAliyunOssSignedUploadUrl` stub

`apps/web/src/lib/storage/china/aliyun-oss.ts` line 326 currently returns a public URL. This must be fixed to return a real HMAC-signed Aliyun OSS PUT URL before ingestion can be implemented.

Required change (see ASSET_REMIX_EXECUTOR_PHASE1A_DESIGN.md Section 6.4 for full code).

---

## 3. Key Reservation (Before RunPod Submit)

CC Gateway reserves OSS keys before submitting to RunPod. This ensures the worker's upload target is known ahead of time and owned by CC:

```
Phase 1: Key reservation (in CC Gateway, before RunPod /run call)

  ctid = "ct-" + hex(sha256(uid + nid + nonce)[0:16])

  temp_subject_key = "assets/transforms/{ctid}/subject.png"
  temp_mask_key    = "assets/transforms/{ctid}/mask.png"
  stable_key       = "assets/transforms/{ctid}/subject-stable.png"

  subject_put_url = getAliyunOssSignedUploadUrl(temp_subject_key, { expiresInSeconds: 900 })
  mask_put_url    = getAliyunOssSignedUploadUrl(temp_mask_key,    { expiresInSeconds: 900 })

  These presigned PUT URLs are included in the RunPod job input payload.
  They are NEVER returned to the frontend.
```

---

## 4. Worker Output Flow

```
Worker receives in event.input:
  source_url      ← signed GET URL (5-min expiry)
  output_key      ← "assets/transforms/{ctid}/subject.png"
  output_put_url  ← presigned PUT URL (15-min expiry)
  mask_key        ← "assets/transforms/{ctid}/mask.png"
  mask_put_url    ← presigned PUT URL
  ctid            ← echoed back in output for ownership verification

Worker completes inference:
  → RGBA PNG buffer (subject with transparent background)
  → Grayscale PNG buffer (alpha mask)

Worker uploads directly to CC OSS:
  PUT {output_put_url}
    Content-Type: image/png
    Content-Length: {subject_png_bytes}
    Body: {rgba_png_buffer}

  PUT {mask_put_url}
    Content-Type: image/png
    Content-Length: {mask_png_bytes}
    Body: {mask_png_buffer}

Worker returns in RunPod output JSON (no binary data):
  {
    ctid, output_key, output_sha256, output_size_bytes,
    output_width, output_height, alpha_present,
    mask_key, mask_sha256, mask_size_bytes,
    candidate_count, selected_iou, selected_stability,
    score_gap, confidence, artifact_id, artifact_sha256,
    timing: { download_ms, decode_ms, inference_ms, filtering_ms,
              postprocess_ms, uploading_ms, total_worker_ms }
  }
```

---

## 5. CC Gateway Ingestion Pipeline (on RunPod COMPLETED)

All steps run in `assetTransformGateway.ts` inside the Vercel Function handling the poll request.

```
RunPod returns COMPLETED with worker output
    │
    ▼
Step 1: Key ownership verification
    output_key from worker payload:
      must start with "assets/transforms/{ctid}/"
      ctid is extracted from the VERIFIED HMAC token (not from worker output)
    If prefix mismatch → ARTIFACT_HASH_MISMATCH
      Rationale: worker should never upload to another job's prefix; mismatch = integrity violation

    │
    ▼
Step 2: HEAD CC OSS — verify object uploaded
    HEAD "assets/transforms/{ctid}/subject.png"
    Expect:
      HTTP 200
      Content-Type: image/png
      Content-Length = output_size_bytes from worker output
    If HEAD fails → OUTPUT_UPLOAD_FAILED (worker PUT may have failed silently)
    If Content-Length mismatch → ARTIFACT_HASH_MISMATCH

    │
    ▼
Step 3: GET buffer + SHA-256 verify
    GET "assets/transforms/{ctid}/subject.png" → buffer
    actual_sha256 = sha256(buffer).hexdigest()
    If actual_sha256 ≠ output_sha256 → ARTIFACT_HASH_MISMATCH
    Parse PNG header → verify dimensions = { output_width, output_height }
    Verify pixel count ≤ 16,000,000
    Verify bit depth = 8, color type = 6 (RGBA)
    If any verify fails → OUTPUT_VALIDATION_FAILED

    │
    ▼
Step 4: PUT stable key (permanent platform copy)
    putChinaObject({
      key: "assets/transforms/{ctid}/subject-stable.png",
      body: buffer,
      contentType: 'image/png',
      metadata: {
        'x-oss-meta-transform-id': ctid,
        'x-oss-meta-owner': 'creator-city',
        'x-oss-meta-sha256': actual_sha256
      }
    })
    This is the key written to Asset.storageKey and returned as stableOutputMediaUrl.
    The temp key (subject.png) may be cleaned up in a future lifecycle policy.

    │
    ▼
Step 5: db.asset.create (idempotent — see Section 7)
    {
      id:              crypto.randomUUID(),
      type:            'IMAGE',
      status:          'READY',
      ownerId:         uid,        ← from verified HMAC token
      projectId:       pid,        ← from verified HMAC token
      workflowId:      workflowId, ← from sourceNode lookup
      nodeId:          nid,        ← source nodeId (transform result associated with source node)
      source:          'transform',
      storageProvider: 'aliyun-oss',
      bucket:          OSS_BUCKET,
      storageKey:      "assets/transforms/{ctid}/subject-stable.png",
      url:             getPublicUrl(stable_key),
      mimeType:        'image/png',
      sizeBytes:       buffer.byteLength,
      tags:            ['transform', 'remove-background', 'subject'],
      metadataJson: {
        assetTransform: {
          transformKind:      'remove-background',
          transformId:        ctid,
          sourceNodeId:       nid,
          sourceAssetId:      null,         // Phase 1A: no FK
          maskStorageKey:     "assets/transforms/{ctid}/mask.png",
          artifactId:         'sam2.1-hiera-base-plus',
          artifactSha256:     output.artifact_sha256,
          selectedIou:        output.selected_iou,
          selectedStability:  output.selected_stability,
          candidateCount:     output.candidate_count,
          timing:             output.timing,
          ingestedAt:         new Date().toISOString()
        }
      }
    }

    │
    ▼
Step 6: Resolve pendingAssetTransforms
    PUT /api/projects/{pid}/canvas
    body: { workflowMetadata: {
      pendingAssetTransforms: [
        // remove the entry for this ctid from the array
      ]
    }}
    (Uses existing workflowMetadata merge mechanism in canvas PUT route line 415)

    │
    ▼
Step 7: Return to polling client
    {
      transformId: token,       ← same HMAC token (unchanged)
      status: 'done',
      outputAssetId: newAsset.id,
      stableOutputMediaUrl: getPublicUrl(stable_key),
      outputOwner: 'creator-city',
      ingestionStatus: 'validated',
      maskUrl: getPublicUrl(mask_stable_key),
      metadata: {
        outputWidth:           output.output_width,
        outputHeight:          output.output_height,
        alphaPresent:          output.alpha_present,
        candidateCount:        output.candidate_count,
        selectedCandidateIou:  output.selected_iou,
        artifactId:            output.artifact_id
      }
    }
```

---

## 6. Mask Asset Storage

Subject PNG and mask PNG are stored as separate objects:

```
Temp keys (worker PUT targets, 15-min presigned URL):
  assets/transforms/{ctid}/subject.png
  assets/transforms/{ctid}/mask.png

Stable keys (after CC verification + stable copy):
  assets/transforms/{ctid}/subject-stable.png
  assets/transforms/{ctid}/mask-stable.png   ← PUT stable copy of mask too
```

The mask URL is returned as `maskUrl` in the transform result. The panel can pass it to `onCreateDerivedNode({ maskUrl })` for future editing capabilities.

The mask does NOT get its own Asset record in Phase 1A. It is attached to the subject Asset via `metadataJson.assetTransform.maskStorageKey`. A separate Mask Asset record can be added in Phase 1B.

---

## 7. Idempotent Asset Creation

A transform job must never create more than one Asset per output.

Guards:
- CC Gateway sets an in-memory or `pendingAssetTransforms.status = 'ingesting'` marker before Step 5
- On concurrent polls that both observe COMPLETED: only the first one through reaches `db.asset.create`; the second finds `status='ingesting'` and waits or returns current state
- If `db.asset.create` fails due to unique constraint: query `Asset` by `metadataJson.assetTransform.transformId` = ctid and return existing record
- `pendingAssetTransforms` entry removed from array on `done` — subsequent polls return the already-written result without re-ingesting

---

## 8. Canvas Node Binding

Canvas node creation is frontend-driven (not server-driven during ingestion):

1. Panel receives `{ outputAssetId, stableOutputMediaUrl, outputOwner, ingestionStatus }`
2. User clicks "创建主体节点"
3. `handleCreateNode()` calls `onCreateDerivedNode()`
4. VCW creates a new canvas node:
   ```
   kind: 'image'
   status: 'done'
   resultImageUrl: stableOutputMediaUrl
   metadataJson.assetTransform: { transformId: ctid, outputAssetId, sourceNodeId: nid }
   ```
5. Canvas save persists via existing `/api/projects/{id}/canvas`

No server-side canvas mutation during ingestion. The derived node is user-initiated.

---

## 9. OSS Key Namespace

```
Prefix:  assets/transforms/{ctid}/
Keys:
  subject.png           ← temp (worker PUT target)
  mask.png              ← temp (worker PUT target)
  subject-stable.png    ← permanent (CC stable copy, written after SHA verify)
  mask-stable.png       ← permanent (CC stable copy)
```

Same OSS bucket as generated assets. Separated by `assets/transforms/` prefix for IAM scoping and future lifecycle policies (e.g., auto-delete temp keys after 24h).

---

## 10. Lineage (No Schema Change Required)

`Asset.metadataJson` carries lineage for Phase 1A:

```json
{
  "assetTransform": {
    "transformKind":     "remove-background",
    "transformId":       "ct-xxxxxxxxxxxxxxxx",
    "sourceNodeId":      "node-uuid",
    "sourceAssetId":     null,
    "maskStorageKey":    "assets/transforms/ct-xxxx/mask-stable.png"
  }
}
```

`CanvasNode.metadataJson` for the derived node:

```json
{
  "assetTransform": {
    "transformKind":  "remove-background",
    "transformId":    "ct-xxxxxxxxxxxxxxxx",
    "sourceNodeId":   "source-node-uuid",
    "outputAssetId":  "asset-uuid"
  }
}
```

Schema migration (`parentAssetId`, `assetTransformId`) deferred to Phase 1B.

---

## 11. Failure Paths

| Failure | Ingestion State | Asset Created | Recovery |
|---|---|---|---|
| Worker OOM / timeout | `failed` | No | User retries |
| Worker: no valid mask | `failed` | No | User retries or crops |
| Worker PUT to presigned URL fails | `failed` / `OUTPUT_UPLOAD_FAILED` | No | User retries |
| HEAD verify fails | `failed` / `OUTPUT_UPLOAD_FAILED` | No | User retries |
| SHA-256 mismatch | `failed` / `ARTIFACT_HASH_MISMATCH` | No | Alert ops; do not retry automatically |
| Stable key PUT fails | `failed` / `OUTPUT_VALIDATION_FAILED` | No | User retries |
| `db.asset.create` fails | `failed` / `ASSET_CREATE_FAILED` | Maybe partial | Query by ctid; idempotent retry |
| Ingestion succeeds; `pendingAssetTransforms` update fails | `done` (Asset exists) | Yes | Next poll returns existing result; safe |
| Presigned PUT URL expired before worker uploads | `failed` / `OUTPUT_UPLOAD_FAILED` | No | User retries; 15-min window is generous |

---

## 12. SCHEMA_DECISION_REQUIRED Items (All Deferred to Phase 1B)

| Item | Decision Needed | Impact If Deferred |
|---|---|---|
| `Asset.parentAssetId` | FK to source Asset | Lineage queries harder; `metadataJson` works |
| `Asset.assetTransformId` | Reference to transform job | No cascades; manual lookup only |
| Mask as separate Asset record | New row per mask | Mask not independently queryable in Phase 1A |
| Transform job state table | Dedicated table | HMAC token + canvas metadataJson covers Phase 1A |
