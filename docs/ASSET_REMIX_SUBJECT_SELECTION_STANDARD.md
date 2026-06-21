# Asset Remix — Subject Selection Standard (Phase 1A)

**Status:** DESIGN_COMPLETE / WAITING_FOUNDER_REVIEW
**Date:** 2026-06-21
**Revision:** 2 — Added MEDIUM confidence band; `needs_user_selection` defined as real Phase 1A status (returned as failure); "不得默认只选最大区域" rule added
**Scope:** SAM 2.1 auto mode candidate generation, filtering, ranking, and confidence gating

---

## 1. The Core Problem

SAM 2 is a segmentation model, not a subject-recognition model. Its `SamAutomaticMaskGenerator` produces a list of candidate masks for every detectable region in the image. This list typically includes:

- Multiple overlapping objects at different granularities
- Background regions (sky, wall, floor)
- Partial body parts (hand, face, leg)
- Small fragments (shadow, reflection, edge artifact)
- Near-border regions that touch or span image edges
- Holes within larger masks

Selecting "the main subject" from this list requires an explicit, inspectable algorithm — not guesswork. This document defines that algorithm for Phase 1A auto mode.

**What we do NOT claim:**
- SAM 2 auto mode does not perform semantic "character recognition"
- The algorithm cannot reliably identify "the person the user cares about" in multi-person scenes
- Automatic selection is a best-effort heuristic, not a ground-truth label
- No subjective quality judgment is made — only measurable geometric properties

**Rule: 不得默认只选最大区域。**
Selecting the largest mask by area is explicitly forbidden. Large masks are frequently the background (sky, floor, wall). The scoring algorithm in Section 5 penalizes both very large and very small masks; the top-scoring mask is selected, not the largest-area mask.

---

## 2. Input Contract

```python
source_image: np.ndarray    # HxWx3 or HxWx4, uint8, RGB or RGBA
                             # After EXIF normalization and color-space conversion
                             # Dimensions validated: 1 ≤ W,H ≤ 4096, W*H ≤ 16_000_000
```

### Input validation order (8 steps, at worker)

```
1. Content-Type check
   - Accept: image/jpeg, image/png, image/webp
   - Reject: image/svg+xml, image/gif, all others
   → Reject: INPUT_MIME_UNSUPPORTED

2. Content-Length check
   - Must be ≤ 12 MB (12_582_912 bytes)
   - If Content-Length absent: stream until limit then reject
   → Reject: INPUT_TOO_LARGE

3. Download body (stream, hard limit 12 MB + 1 byte)
   → Abort and return INPUT_TOO_LARGE if over limit

4. Magic byte verification
   - PNG:  \x89PNG\r\n\x1a\n at offset 0
   - JPEG: \xff\xd8 at offset 0
   - WebP: RIFF????WEBP at offset 0
   → Mismatch: IMAGE_DECODE_FAILED (prevents MIME spoofing)

5. Parse image headers only (not full decode)
   - Read: width, height, bit depth, color space
   - Reject if width × height > 16_000_000 (16 MP decompression bomb guard)
   - Reject if width > 4096 or height > 4096
   → Reject: INPUT_TOO_LARGE or IMAGE_DECODE_FAILED

6. EXIF orientation normalization
   - Apply EXIF rotation before inference
   - Strip all EXIF after normalization (no PII in forwarded metadata)

7. Full decode to numpy array (RGB uint8)
   - Re-verify decoded dimensions match header-parsed dimensions
   → Mismatch: IMAGE_DECODE_FAILED

8. Color space normalization
   - CMYK / LAB / P-mode → convert to RGB
   - SAM 2.1 expects RGB uint8
```

---

## 3. SAM 2.1 Mask Generator Parameters (Phase 1A defaults)

```python
mask_generator = SamAutomaticMaskGenerator(
    model=sam2_model,
    points_per_side=32,           # Grid density; 32 is standard
    points_per_batch=128,
    pred_iou_thresh=0.80,         # Pre-filter: drop masks with IoU < 0.80
    stability_score_thresh=0.90,  # Pre-filter: drop unstable masks
    crop_n_layers=0,              # No multi-crop in Phase 1A
    min_mask_region_area=2000,    # Drop tiny fragments (< ~45×45 pixels)
    output_mode="binary_mask",
)

raw_masks = mask_generator.generate(source_image)
```

Each mask in `raw_masks` has:
```python
{
    "segmentation": np.ndarray,           # HxW bool mask
    "area": int,                          # Pixel count
    "bbox": [x, y, w, h],                # Bounding box (XYWH)
    "predicted_iou": float,               # SAM's predicted mask quality
    "stability_score": float,             # Mask stability under perturbation
    "point_coords": [[x, y]],            # Seed point
    "crop_box": [0, 0, W, H],
}
```

---

## 4. Candidate Filtering Pipeline

All filters are applied in order. A mask failing any filter is discarded.

### F1 — Minimum IoU
```python
mask["predicted_iou"] >= 0.82
```
Rationale: Masks with IoU < 0.82 are unreliable even if stable.

### F2 — Minimum Stability
```python
mask["stability_score"] >= 0.88
```
Rationale: Unstable masks produce jagged, unusable cutouts.

### F3 — Minimum Area
```python
area_fraction = mask["area"] / (image_width * image_height)
area_fraction >= 0.005    # At least 0.5% of image
```
Rationale: Eliminates micro-fragments (dust, text artifacts, edge halos).

### F4 — Maximum Area
```python
area_fraction <= 0.90     # Must not cover more than 90% of image
```
Rationale: Full-image masks are always background captures. This also implements the "不得默认只选最大区域" rule — candidates covering >90% of image are eliminated.

### F5 — Border Contact Ratio
```python
border_pixels = count_border_contact(mask["segmentation"])
border_fraction = border_pixels / (2 * (W + H) - 4)
border_fraction <= 0.50   # Mask must not be primarily border-attached
```
Rationale: Background regions always touch the image border.

### F6 — Fragment Ratio (Compactness)
```python
num_components = count_connected_components(mask["segmentation"])
num_components <= 5       # Limit fragmentation
```
Rationale: A subject mask should be largely contiguous.

### F7 — Hole Ratio
```python
hole_fraction = count_holes(mask["segmentation"]) / mask["area"]
hole_fraction <= 0.30     # No more than 30% internal holes
```
Rationale: Masks with many holes are typically background lattice regions.

---

## 5. Candidate Scoring

After filtering, surviving candidates are scored. Higher score = better subject candidate.

**Rule: The top-scoring candidate is selected, not the largest-area candidate.**

```python
def score_candidate(mask, image_width, image_height):
    W, H = image_width, image_height
    total_px = W * H

    area_frac = mask["area"] / total_px
    iou = mask["predicted_iou"]
    stability = mask["stability_score"]

    bbox = mask["bbox"]  # [x, y, w, h]
    bbox_cx = bbox[0] + bbox[2] / 2
    bbox_cy = bbox[1] + bbox[3] / 2
    cx_image, cy_image = W / 2, H / 2

    # Center distance: lower = more central = better
    center_dist = sqrt(((bbox_cx - cx_image) / W)**2 + ((bbox_cy - cy_image) / H)**2)
    center_score = max(0, 1 - 2 * center_dist)

    # Compactness: how well mask fills its bounding box
    bbox_area = bbox[2] * bbox[3]
    compactness = mask["area"] / bbox_area if bbox_area > 0 else 0

    # Size preference: 5–60% of image area is ideal
    if 0.05 <= area_frac <= 0.60:
        size_score = 1.0
    elif area_frac < 0.05:
        size_score = area_frac / 0.05
    else:
        size_score = max(0, 1 - (area_frac - 0.60) / 0.30)

    score = (
        0.30 * iou           +   # SAM quality signal
        0.20 * stability     +   # Mask consistency
        0.20 * center_score  +   # Prefer centered subjects
        0.15 * compactness   +   # Prefer solid shapes
        0.15 * size_score        # Prefer medium-sized subjects
    )

    return score
```

---

## 6. Confidence Gate (Three Bands)

After scoring, the top candidate is selected. Confidence is then assessed across three bands.

### HIGH confidence — return result immediately

All of the following must be true:
```python
top_score >= 0.72
top_candidate["predicted_iou"] >= 0.88
top_candidate["stability_score"] >= 0.92
(top_score - second_score) >= 0.10   # Clear winner over runner-up
area_frac between 0.03 and 0.80
```

If all conditions met → proceed to mask post-processing → generate transparent PNG → PUT to presigned URL → return `confidence: "high"`.

### MEDIUM confidence — needs user selection

Conditions: `top_score >= 0.60` but fails HIGH criteria (score gap < 0.10, or iou/stability below HIGH threshold).

Phase 1A behavior: worker returns `error_code: "USER_SELECTION_REQUIRED"` + `confidence: "medium"`. CC Gateway maps to `failed` with errorCode `USER_SELECTION_REQUIRED`. No mask PNG is generated.

Phase 1B extension: return `status: needs_user_selection` with up to 5 candidate masks as overlay options for user selection in the panel.

Log fields when MEDIUM:
```json
{
  "confidence": "medium",
  "candidate_count": 4,
  "top_score": 0.68,
  "score_gap": 0.04,
  "top_iou": 0.85,
  "top_stability": 0.89
}
```

### LOW confidence — fail gracefully

Conditions: `top_score < 0.60` or fewer than 1 candidate survived all filters.

Worker returns `error_code: "NO_VALID_MASK"` + `confidence: "low"`. No mask PNG generated.

Log fields when LOW:
```json
{
  "confidence": "low",
  "candidate_count": 1,
  "top_score": 0.55,
  "score_gap": null
}
```

---

## 7. Multi-Subject Handling

When multiple candidates have score_gap < 0.10 (unclear winner):

| Scenario | Phase 1A Response |
|---|---|
| Two people of similar size/position | `needs_user_selection` (MEDIUM) |
| Person + pet, clearly different sizes | Select larger if > 2× area AND score_gap ≥ 0.08 |
| Product shot, multiple objects of similar score | `needs_user_selection` (MEDIUM) |
| Portrait with clear foreground subject | HIGH confidence — select |
| Group scene (3+) | `needs_user_selection` (MEDIUM) or `NO_VALID_MASK` (LOW) |

**Rule: When in doubt, MEDIUM confidence and `USER_SELECTION_REQUIRED` is always safer than selecting the wrong subject.** The user can retry.

---

## 8. Special Cases

### 8.1 Transparent / Semi-transparent Objects
SAM 2 is trained on opaque objects. Transparency in source causes unreliable masks. If source has significant non-opaque pixels (> 5% with alpha < 200), log a warning and proceed — quality may be degraded but worker does not reject.

### 8.2 Hair / Fur / Fine Structure
SAM 2.1 handles hair better than earlier versions. No special treatment in Phase 1A. Quality tracked in benchmark plan.

### 8.3 Low-contrast / Monochrome Images
F2 (stability) and F5 (border contact) are most likely to eliminate these. If no candidates survive, `NO_VALID_MASK`. Worker does not lower thresholds dynamically.

### 8.4 Portraits
Best case for auto mode. Center preference (center_score) strongly benefits single-person portraits.

### 8.5 Products / Objects
Generally good. Risk: objects against same-color background produce low stability. F2 and F6 guard.

### 8.6 Vehicles
Complex edges and reflections cause fragmentation. F6 (fragment count) guards. May yield MEDIUM or NO_VALID_MASK in complex scenes.

### 8.7 Animals
Fur similar to hair. Spot-check in benchmark recommended.

---

## 9. Mask Post-Processing (After HIGH Confidence)

```python
def postprocess_mask(binary_mask: np.ndarray, feather_radius: int = 2) -> np.ndarray:
    mask = binary_fill_holes(binary_mask)
    mask = remove_small_objects(mask, min_size=500)

    kernel = disk_kernel(radius=1)
    mask = binary_erosion(mask, kernel)
    mask = binary_dilation(mask, disk_kernel(radius=2))

    if feather_radius > 0:
        alpha = gaussian_blur(mask.astype(float), sigma=feather_radius)
    else:
        alpha = mask.astype(float)

    return alpha  # Float 0..1, H×W

# Subject PNG: RGBA, transparent background
subject_rgba = np.zeros((H, W, 4), dtype=np.uint8)
subject_rgba[:, :, :3] = source_rgb
subject_rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
# → PUT to output_put_url via presigned PUT

# Mask PNG: Grayscale, 8-bit
mask_gray = (alpha * 255).astype(np.uint8)
# → PUT to mask_put_url via presigned PUT
```

---

## 10. Recommended Test Image Set

| Category | Count | Expected Pass Rate |
|---|---|---|
| Solo portrait (clear bg) | 20 | ≥ 90% HIGH confidence |
| Solo portrait (complex bg) | 20 | ≥ 70% HIGH confidence |
| Two-person scene | 20 | ≥ 30% HIGH; ≤ 50% MEDIUM |
| Product / object | 20 | ≥ 75% HIGH confidence |
| Animal portrait | 20 | ≥ 65% HIGH confidence |
| Vehicle | 15 | ≥ 50% HIGH confidence |
| Hair / long hair | 15 | ≥ 60% HIGH confidence |
| Transparent object | 10 | ≥ 30% HIGH (known limitation) |
| Low-contrast bg | 10 | ≥ 40% HIGH confidence |
| Group scene (3+) | 10 | ≤ 20% HIGH (intentionally hard; MEDIUM expected) |
| **Total** | **160** | — |

All 160 images must be assessed by a human reviewer for ground-truth mask quality before the benchmark is considered complete.

---

## 11. Threshold Adjustment Policy

Thresholds in this document are initial values. After benchmark analysis:

- If false-positive rate (wrong subject selected and deemed unacceptable) > 5% → raise `iou` or `stability` thresholds
- If `NO_VALID_MASK` rate > 30% on portrait category → lower `pred_iou_thresh` by 0.02 and retest
- If `needs_user_selection` (MEDIUM) rate > 50% on portrait category → lower score gap threshold from 0.10 to 0.08 and retest
- If `NO_VALID_MASK` rate > 50% on all categories → model may not be loaded correctly; check artifact integrity

All threshold changes require Founder sign-off and must be documented in a new revision of this document.
