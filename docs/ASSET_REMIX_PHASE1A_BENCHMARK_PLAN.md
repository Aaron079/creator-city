# Asset Remix — Phase 1A Benchmark & SLA Plan

**Status:** DESIGN_COMPLETE / WAITING_FOUNDER_REVIEW
**Date:** 2026-06-21
**Revision:** 2 — Added `uploading_ms` timing field; cost model updated for presigned PUT (no re-download hop); MEDIUM confidence band added to quality metrics
**Scope:** Capacity, cost, latency, and quality testing plan for subject extraction alpha

---

## 1. SLA Targets (Founder-Approved)

| Metric | Target | Hard Limit |
|---|---|---|
| Warm p95 latency (total) | ≤ 12s | 30s |
| Cold p95 latency (total) | ≤ 45s | 90s |
| Success rate | ≥ 98% | — |
| Worker hard timeout | 120s | 120s |
| Cost per job (p95) | ≤ US$0.02 | — |
| GPU class | 24GB VRAM | — |
| min workers | 0 | — |
| max workers | 3 | — |
| Worker concurrency | 1 job/worker | — |

---

## 2. Benchmark Matrix

Every cell: 10 sizes × 10 categories = 100 cells. Each cell runs 3 jobs, reporting p50/p95.

### 2.1 Input Size Dimension

| Size Class | Megapixels | Example Resolution | File Size (JPEG) |
|---|---|---|---|
| XS | 0.3 MP | 640×480 | ~50 KB |
| S | 1 MP | 1280×720 | ~100 KB |
| M | 2 MP | 1920×1080 | ~300 KB |
| L | 4 MP | 2560×1440 | ~600 KB |
| XL | 8 MP | 3840×2160 (4K) | ~1.5 MB |
| XXL | 12 MP | 4000×3000 | ~2 MB |
| MAX | 16 MP | 4920×3264 | ~3 MB |

All larger inputs are rejected at the validation layer (not sent to worker).

### 2.2 Content Category Dimension

| Category | Description | Key Challenge |
|---|---|---|
| Portrait solo (simple bg) | 1 person, plain background | Baseline |
| Portrait solo (complex bg) | 1 person, cluttered scene | Segmentation accuracy |
| Portrait two-person | 2 people visible | MEDIUM confidence expected |
| Product object | Single product, white/gradient bg | Edge precision |
| Animal | Pet, wildlife | Fur texture |
| Vehicle | Car, motorcycle | Reflections, wheels |
| Hair / long hair | Portrait emphasizing hair detail | Fine structure |
| Transparent/glass | Wine glass, acrylic | Known limitation |
| Low-contrast | Subject blends with background | Stability |
| Complex scene | Multiple subjects, overlapping | Multi-subject ambiguity |

---

## 3. Measurement Protocol

### Per-job timing breakdown (measured end-to-end)

All timings must be recorded in the worker output payload and CC Gateway structured log:

```json
{
  "timing": {
    "signed_url_generation_ms":   0,
    "runpod_queue_wait_ms":       0,
    "worker_cold_start_ms":       0,
    "download_ms":                0,
    "decode_ms":                  0,
    "inference_ms":               0,
    "filtering_ms":               0,
    "postprocess_ms":             0,
    "uploading_ms":               0,
    "ingestion_validation_ms":    0,
    "asset_create_ms":            0,
    "total_ms":                   0
  }
}
```

**Field definitions:**
- `signed_url_generation_ms` — CC Gateway: time to generate presigned GET + PUT URLs
- `runpod_queue_wait_ms` — Time RunPod status was `IN_QUEUE` (from submit to `IN_PROGRESS`)
- `worker_cold_start_ms` — Cold start (0 if worker was warm; model already loaded)
- `download_ms` — Worker: signed GET URL fetch
- `decode_ms` — Worker: image decode + EXIF normalize
- `inference_ms` — Worker: SAM 2.1 mask generation
- `filtering_ms` — Worker: candidate filter + score
- `postprocess_ms` — Worker: mask post-process + PNG encode
- `uploading_ms` — Worker: presigned PUT to CC OSS (subject + mask)
- `ingestion_validation_ms` — CC Gateway: HEAD + GET + SHA-256 verify + stable key PUT
- `asset_create_ms` — CC Gateway: `db.asset.create` DB write
- `total_ms` — End-to-end from POST `/api/asset-transform` to `ingestionStatus=validated`

### Warm worker measurement
1. Pre-warm by submitting a 1MP portrait image; wait for completion
2. Immediately submit benchmark image within 120s window
3. Record: warm measurement (`worker_cold_start_ms = 0`)

### Cold start measurement
1. Set `min_workers=0`; let endpoint idle for 5 minutes
2. Submit benchmark image
3. Record: cold-start measurement (`worker_cold_start_ms > 0`)

---

## 4. Quality Metrics

### Quality grades (human reviewer)
```
A: Subject extracted correctly, clean edge, no major artifacts
B: Subject extracted, minor edge issues (< 10% edge perimeter affected)
C: Subject extracted, noticeable edge artifacts but usable
F: Wrong subject selected, or subject clearly cut off, or background not removed
```

### Confidence outcome distribution

Track the fraction of images in each confidence band:

| Category | HIGH expected | MEDIUM expected | LOW / NO_VALID_MASK expected |
|---|---|---|---|
| Portrait solo (simple) | ≥ 85% | ≤ 10% | ≤ 5% |
| Portrait solo (complex) | ≥ 65% | ≤ 20% | ≤ 15% |
| Two-person | ≥ 30% | ≤ 30% | ≤ 40% |
| Product | ≥ 70% | ≤ 20% | ≤ 10% |
| Complex scene | ≤ 20% | ≤ 40% | ≥ 40% (expected) |
| Transparent object | ≤ 30% | ≤ 40% | ≥ 30% (known limitation) |

**Note on MEDIUM:** `USER_SELECTION_REQUIRED` in Phase 1A is returned as a failure to the user. These are tracked separately from `NO_VALID_MASK` because MEDIUM confidence means the mask data is plausibly correct — the issue is selection ambiguity, not model failure. Both must stay within acceptable bounds.

---

## 5. Cost Calculation

RunPod Serverless pricing (24GB GPU class, as of 2026):
- Estimate: ~US$0.00069 per GPU-second (verify at time of deployment)
- SAM 2.1 inference on 4MP image: estimated 8–12 GPU-seconds
- Model load on cold start: estimated 15–25 GPU-seconds (one-time per worker lifecycle)
- Presigned PUT (worker → OSS): not GPU compute, not billed
- CC Gateway ingestion (HEAD + GET + db.asset.create): Vercel Function compute, negligible vs RunPod

### Cost model per job
```
warm_cost = inference_seconds × gpu_cost_per_second
          ≈ 10s × $0.00069 = $0.0069 per job

cold_cost = (cold_start_seconds + inference_seconds) × gpu_cost_per_second
          ≈ (25 + 10) × $0.00069 = $0.024 per cold-start job
```

Target p95 cost ≤ $0.02 is achievable on warm workers. Cold starts may exceed target.

**Presigned PUT vs re-download:** Switching from ephemeral re-download to presigned PUT eliminates the extra Executor Gateway download step (~300–800ms latency savings) and eliminates OSS egress cost for the re-download hop. This improves both latency and cost slightly vs the previous design.

### Mitigation strategies if cost exceeds target
1. Use `min_workers=1` during business hours → eliminates cold-start billing, adds ~$1.50/day standing cost
2. Use smaller model: `sam2.1-hiera-small` (faster, lower cost, lower quality — separate artifact approval required)
3. Reduce max input resolution from 16MP to 8MP
4. Optimize Docker layer caching to reduce cold start time

---

## 6. Capacity Planning

Phase 1A alpha (internal only, no public users):
- Estimated volume: ≤ 100 jobs/day
- `max_workers=3` is sufficient for all alpha traffic
- No autoscaling configuration needed in Phase 1A

Phase 1B (internal beta, limited users):
- Review RunPod queue depth and p99 latency at 500 jobs/day
- Adjust `max_workers` if p99 > 60s

---

## 7. Failure Mode Testing

| Test | Method | Pass Criteria |
|---|---|---|
| Oversized input (> 12MB JPEG) | Submit 15MB file | Rejected at validation: `INPUT_TOO_LARGE` |
| Unsupported MIME (SVG) | Submit SVG file | Rejected at validation: `INPUT_MIME_UNSUPPORTED` |
| Decompression bomb | 1×1 PNG with 100MP decode size | Rejected at validation |
| Animated GIF | Multi-frame GIF | Rejected at MIME check |
| Corrupted JPEG | Truncate JPEG at byte 50000 | `IMAGE_DECODE_FAILED` |
| Presigned PUT failure | Block worker outbound to OSS in smoke test | `OUTPUT_UPLOAD_FAILED`, job retryable |
| SHA mismatch | Tamper with output buffer before PUT | CC Gateway: `ARTIFACT_HASH_MISMATCH` |
| Worker OOM | Submit 16MP image (edge of limit) | Should succeed; if OOM → `GPU_OOM` |
| Expired signed GET URL | Delay 10+ minutes after job submit before worker starts | Worker reports download failure |
| Expired presigned PUT URL | Delay 16+ minutes after submit before worker PUTs | Worker reports `OUTPUT_UPLOAD_FAILED` |
| Cross-user job poll | User A polls with User B's transformId (tampered token) | `TRANSFORM_TOKEN_INVALID` or `403 Forbidden` |
| Tampered objectKey in output | Worker returns wrong output_key | CC Gateway key prefix mismatch → `ARTIFACT_HASH_MISMATCH` |
| Replay attack (duplicate nonce) | Submit same ctid + nonce twice | Second returns existing job status (deduplication) |
| Token expired | Poll with transformId 3+ hours later | `TRANSFORM_TOKEN_EXPIRED` (410) |
| MEDIUM confidence image | Submit known ambiguous two-person image | `USER_SELECTION_REQUIRED` returned as failed |

---

## 8. Alpha Production Test Plan

After executor deployed and all unit/container tests pass:

### Alpha run: 500 jobs
- All submitted by internal team only
- Mix of benchmark matrix categories
- Record: latency p50/p95, success rate, confidence distribution, cost/job
- Human review: 100% of all grade A/B/C/F assessments

### Acceptance criteria to advance to Beta

| Metric | Required Value |
|---|---|
| Success rate (no error) | ≥ 95% |
| Grade A+B quality | ≥ 85% of HIGH-confidence jobs |
| HIGH confidence on portraits (solo simple) | ≥ 80% |
| MEDIUM confidence on portraits | ≤ 15% |
| `NO_VALID_MASK` on portraits | ≤ 10% |
| Warm p95 latency | ≤ 12s |
| Cold p95 latency | ≤ 50s |
| Cost p95 | ≤ $0.03 |
| `uploading_ms` p95 | ≤ 2000ms (presigned PUT to OSS) |
| `ingestion_validation_ms` p95 | ≤ 1500ms (HEAD + GET + SHA + stable PUT) |
| Zero security incidents | REQUIRED |
| Zero cross-user data leaks | REQUIRED |
| Zero `ARTIFACT_HASH_MISMATCH` | REQUIRED |

If any required metric fails → BLOCKED; investigate before Beta.

---

## 9. Decision Tree: What to Do If Targets Are Not Met

| Problem | Action |
|---|---|
| Warm latency > 12s | Profile `inference_ms`; try `sam2.1-hiera-small`; reduce `points_per_side` |
| Cold latency > 45s | Use `min_workers=1`; optimize Docker layer caching |
| Cost > $0.02 | Reduce input size limit; try smaller model |
| HIGH confidence rate < 60% on portraits | Lower `pred_iou_thresh` by 0.02; retest |
| MEDIUM rate > 30% on portraits | Lower score gap threshold from 0.10 to 0.08 |
| Quality < 85% A+B | Review top failure categories; tune postprocess feather_radius |
| OOM on 16MP | Reduce max input to 12MP; test with `crop_n_layers=1` |
| `uploading_ms` p95 > 2000ms | Check OSS region; ensure worker and OSS are in same region |
| Success rate < 95% | Root-cause by errorCode distribution; fix dominant failure |
| `ARTIFACT_HASH_MISMATCH` appears | STOP ALPHA; audit model checkpoint integrity immediately |

---

## 10. Observability Requirements for Benchmark

Every benchmark job must produce a structured log entry:

```json
{
  "event": "benchmark_job",
  "transformId_prefix": "ct-xxxxxxxx",
  "artifactId": "sam2.1-hiera-base-plus",
  "input_mp": 4.2,
  "input_bytes": 1245800,
  "category": "portrait_solo_complex",
  "worker_warm": true,
  "status": "done",
  "errorCode": null,
  "confidence": "high",
  "candidate_count": 4,
  "selected_iou": 0.921,
  "selected_stability": 0.944,
  "score_gap": 0.142,
  "timing": {
    "signed_url_generation_ms":   40,
    "runpod_queue_wait_ms":       340,
    "worker_cold_start_ms":       0,
    "download_ms":                280,
    "decode_ms":                  95,
    "inference_ms":               8420,
    "filtering_ms":               15,
    "postprocess_ms":             210,
    "uploading_ms":               890,
    "ingestion_validation_ms":    620,
    "asset_create_ms":            80,
    "total_ms":                   10990
  },
  "gpu_type": "NVIDIA RTX A5000",
  "cost_usd": 0.0083,
  "human_grade": null
}
```

No signed URLs, presigned PUT URLs, API tokens, user IDs, or raw image data in logs.
