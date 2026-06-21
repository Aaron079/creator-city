# Asset Remix — License & Dependency Audit Matrix
## Creator City — Open Source Tool License Review

> **Status**: CORRECTED 2026-06-21 — Per-artifact review; prior per-checkpoint weight assertions replaced with CHECKPOINT_LICENSE_UNVERIFIED status
>
> **Scope**: Code license, model/checkpoint license, weight restrictions, commercial usage, integration path, risks
>
> **CRITICAL**: Code license ≠ model checkpoint license. Each artifact (code repo + each weight file) must be audited separately.
>
> **IMPORTANT**: Verify all licenses at production deployment time. Licenses and model releases change between versions.

---

## Summary: Integration Decision Matrix

| Tool | Code License | Model/Weight License | Commercial OK? | Integration Path | Decision |
|---|---|---|---|---|---|
| ComfyUI | GPL-3.0 | N/A (UI only) | Service isolation only | Isolated HTTP service only | **Allowed as external executor only — no source copy** |
| InvokeAI | Apache-2.0 | N/A (UI only) | Reference only | UX pattern reference only | **Reference only** |
| SAM 2 | Apache-2.0 | Apache-2.0 | Yes | Isolated GPU service | **Approved for executor integration** |
| rembg | MIT | CHECKPOINT_LICENSE_UNVERIFIED per model | Must verify per checkpoint | Isolated GPU service | **Code approved; each checkpoint requires separate sign-off** |
| GroundingDINO | Apache-2.0 | Apache-2.0 | Yes | Isolated GPU service | **Approved for executor integration** |
| Real-ESRGAN | BSD-3-Clause | CHECKPOINT_LICENSE_UNVERIFIED | Must verify per checkpoint | Isolated GPU service | **Code approved; BLOCKED_UNTIL_WEIGHT_LICENSE_VERIFIED per checkpoint** |
| IOPaint | Apache-2.0 | Varies by backend model | Depends on backend | Isolated GPU service | **Code approved; LaMa backend only pending model audit** |
| ControlNet | Apache-2.0 | Apache-2.0 | Yes | Isolated GPU service | **Approved for executor integration** |
| IP-Adapter | Apache-2.0 | Apache-2.0 | Yes | Isolated GPU service | **Approved for executor integration** |
| InstantID | Apache-2.0 | BLOCKED_PENDING_COMMERCIAL_LICENSE_AND_FACE_COMPLIANCE_REVIEW | **NO** | **BLOCKED** | **BLOCKED — face model requires commercial license + jurisdiction review** |

---

## Artifact Registry Requirement

Before any model is deployed to production, the following must be documented for each artifact:

| Field | Description |
|---|---|
| `artifact_name` | Filename (e.g., `u2net.pth`) |
| `artifact_url` | Download source URL |
| `sha256` | Checksum of downloaded file |
| `code_license` | License of the code/library |
| `model_license` | License stated in model card or release notes for THIS weight file |
| `weight_license` | Separate license file in the release, if any |
| `source_model` | Upstream model the weights are based on (if fine-tuned) |
| `permitted_use` | Commercial / non-commercial / research-only |
| `approval_date` | Date of legal/founder sign-off |
| `approved_by` | Who approved it |

**No model runs in production until this record is complete and signed off.**

---

## Detailed Audit

### ComfyUI
- **Code license**: GPL-3.0
- **Model license**: N/A — ComfyUI is a UI framework; models are loaded separately
- **Commercial usage**: GPL-3.0 source cannot be copied, modified, or linked into Creator City at build time. ComfyUI can be used as a completely isolated external service called via HTTP.
- **Integration path**: External HTTP service only. Creator City calls `COMFYUI_BASE_URL/api/...`. No ComfyUI Python or TypeScript source is imported.
- **Risk**: LOW when isolated. **CRITICAL if any GPL code is copied.** Never import ComfyUI source.
- **GPL/AGPL Policy**: Isolated HTTP call does not trigger GPL obligations. Any alternative that copies or links GPL code into CC source requires separate legal review.
- **Note**: "Isolated HTTP executor" is a viable approach under GPL, but the specific legal analysis for your jurisdiction should be confirmed by counsel. The current registry entry `risk: 'service_isolation_required'` is correct.

### InvokeAI
- **Code license**: Apache-2.0
- **Model license**: N/A — UI/orchestration framework
- **Commercial usage**: Yes (Apache-2.0 code)
- **Integration path**: Reference only. InvokeAI's inpainting/canvas/layer UX patterns inform Creator City product design. Do NOT embed InvokeAI's code.
- **Status**: Reference only.

### SAM 2 (Segment Anything Model 2)
- **Code license**: Apache-2.0
- **Model license (weights)**: Apache-2.0
  - The `sam2` checkpoints published alongside the code are under Apache-2.0, the same license as the code.
  - Correction from prior audit: there is no separate "Meta Research License" on the SAM2 weights as of 2026-06-21. The checkpoints are Apache-2.0.
  - **Action**: Verify the specific checkpoint file you download includes the Apache-2.0 LICENSE file in its release. Add to artifact registry.
- **Commercial usage**: YES (Apache-2.0)
- **Weight usage restrictions**: Attribution required (Apache-2.0). Cannot be used to create a competing foundation model (reasonable inference from model card; verify at download time).
- **Integration path**: Isolated GPU service. API: image + optional point prompt → segmentation mask.
- **Risk**: LOW.
- **Production recommendation**: **APPROVED** pending artifact registry entry.
- **Re-verify**: Check the specific release's LICENSE file before production deployment.

### rembg
- **Code license**: MIT (danielgatis/rembg)
- **Model/weight license**: **CHECKPOINT_LICENSE_UNVERIFIED — must audit each model artifact separately**
  - rembg downloads model weights automatically at first run. The weights are NOT covered by rembg's MIT license.
  - `u2net.pth`: Originally from xuebinqin/U-2-Net. The U-2-Net paper repo uses MIT. Verify the specific artifact URL and its license file.
  - `isnet.pth` (IS-Net): Check IS-Net release license. Prior audits noted MIT but this must be confirmed against the actual release artifact.
  - `birefnet.pth`: Check BiRefNet release license.
  - `u2netp.pth`: Smaller u2net variant. Same source repo — verify.
- **Commercial usage**: Depends on each checkpoint. Code is MIT. Weights require per-artifact confirmation.
- **Production recommendation**: **Code approved for executor integration.** Each weight file must be in the artifact registry with verified license before production use. Do not allow rembg to auto-download weights in production — pin specific verified artifacts.
- **Caution**: Auto-download in rembg pulls from HuggingFace or GitHub releases. Pin the exact version and checksum.

### GroundingDINO
- **Code license**: Apache-2.0 (IDEA-Research)
- **Model license**: Apache-2.0
- **Commercial usage**: YES
- **Integration path**: Isolated GPU service. Used for text-prompted object detection → feeds SAM2 segmentation.
- **Risk**: LOW.
- **Production recommendation**: **APPROVED** pending artifact registry entry.

### Real-ESRGAN
- **Code license**: BSD-3-Clause (xinntao/Real-ESRGAN)
- **Model/weight license**: **CHECKPOINT_LICENSE_UNVERIFIED — critically model-dependent**
  - The code repository (BSD-3-Clause) and the weight files use DIFFERENT licenses.
  - The following were noted in a prior audit but must be re-verified against actual release artifacts before production:
    - `RealESRGAN_x4plus.pth` — claimed CC BY-NC-SA 4.0; **if confirmed, this is non-commercial only**
    - `RealESRGAN_x4plus_anime_6B.pth` — claimed CC0; **if confirmed, commercial use allowed**
    - `RealESRNet_x4plus.pth` — claimed Apache-2.0; **if confirmed, commercial use allowed**
    - `ESRGAN_x4.pth` (original ESRGAN) — claimed academic/research non-commercial
  - **These claims are from prior analysis and have NOT been verified against the actual release artifacts for this audit.**
- **Commercial usage**: **PRODUCTION_BLOCKED_UNTIL_WEIGHT_LICENSE_VERIFIED**
  - Do NOT deploy any Real-ESRGAN checkpoint without a completed artifact registry entry with verified license.
  - If `x4plus.pth` is confirmed non-commercial, it must never be deployed.
  - Candidate commercial-safe checkpoints (pending verification): `anime_6B` and `RealESRNet_x4plus`.
- **Integration path**: Isolated GPU service.
- **Risk**: **HIGH if unverified checkpoint deployed. LOW once correct artifact verified.**
- **Production recommendation**: **BLOCKED_UNTIL_WEIGHT_LICENSE_VERIFIED**. Before any deployment:
  1. Download the target checkpoint
  2. Locate its LICENSE or model card
  3. Confirm commercial use is permitted
  4. Add to artifact registry with SHA-256, source URL, and approval sign-off
  5. Do not expose internal model names to users; surface only as "高清重建"

### IOPaint (formerly LaMa)
- **Code license**: Apache-2.0 (Sanster/IOPaint)
- **Model license**: Varies by backend:
  - LaMa: Apache-2.0 ✓ — preferred backend for Creator City
  - MAT: Academic/research non-commercial ❌
  - Other backends (MIGAN, ZITS, FcF): Check individually
- **Commercial usage**: Apache-2.0 for code. LaMa backend: YES. Others: verify.
- **Integration path**: Isolated GPU service.
- **Risk**: MEDIUM — backend selection is critical.
- **Production recommendation**: **Code approved. LaMa backend only pending artifact registry entry.** Do not switch backend without separate audit.

### ControlNet
- **Code license**: Apache-2.0 (lllyasviel/ControlNet)
- **Model license**: Apache-2.0
- **Commercial usage**: YES
- **Integration path**: Isolated GPU service. Used for depth/canny/pose extraction.
- **Risk**: LOW.
- **Production recommendation**: **APPROVED** pending artifact registry entry.

### IP-Adapter
- **Code license**: Apache-2.0 (tencent-ailab/IP-Adapter)
- **Model license**: Apache-2.0
- **Commercial usage**: YES
- **Integration path**: Isolated GPU service. Used for style-consistent variation.
- **Risk**: LOW.
- **Production recommendation**: **APPROVED** pending artifact registry entry.

### InstantID
- **Code license**: Apache-2.0 (InstantX-Team/InstantID)
- **Model license**: **BLOCKED_PENDING_COMMERCIAL_LICENSE_AND_FACE_COMPLIANCE_REVIEW**
  - InstantID depends on InsightFace models (`buffalo_l`, `antelopev2`), which are licensed under non-commercial use only per InsightFace's published license terms.
  - The code being Apache-2.0 does NOT override the non-commercial restriction on the face recognition weights it depends on.
  - This is not a permanent block — it requires: (1) commercial license from InsightFace, OR (2) replacement with a commercially-licensed face model, AND (3) jurisdiction-specific face regulation review.
- **Face regulation risk**: Additional regulatory exposure in:
  - Illinois (BIPA — biometric information)
  - EU (GDPR Article 9 — biometric data)
  - China (PIPL — personal information)
  - California (CCPA biometric data provisions)
- **Integration path**: **BLOCKED for production**
- **Risk**: HIGH — dual exposure: commercial license violation + biometric regulation
- **Production recommendation**: **DO NOT INTEGRATE until ALL of the following are complete:**
  1. Commercial license obtained from InsightFace OR commercially-licensed face model identified, AND
  2. Jurisdiction-specific legal review of face synthesis regulations completed, AND
  3. User consent mechanism for biometric data processing implemented and reviewed, AND
  4. Artifact registry entry completed with all approvals

---

## GPL / AGPL Policy

GPL and AGPL licensed code cannot be:
- Copied into Creator City source
- Statically linked at build time
- Dynamically linked as a library imported at runtime

These tools can ONLY be used as:
1. Completely independent processes called via HTTP API
2. Deployed on separate infrastructure
3. Creator City never imports their source modules

Current GPL/AGPL tools: ComfyUI (GPL-3.0) — already isolated via HTTP in registry.

**If any GPL tool introduces a new integration mode** (e.g., Python subprocess, shared memory, etc.), a fresh legal analysis is required before deployment.

---

## Commercial Risk Summary

| Risk Level | Tools | Required Action |
|---|---|---|
| **BLOCKED** | InstantID | Do not integrate until face license + compliance review complete |
| **PRODUCTION_BLOCKED_UNTIL_WEIGHT_LICENSE_VERIFIED** | Real-ESRGAN | Verify each checkpoint artifact before deployment |
| **CHECKPOINT_LICENSE_UNVERIFIED** | rembg | Pin specific weights; add each to artifact registry |
| **CAUTION — backend-dependent** | IOPaint | LaMa backend only; no backend switches without audit |
| **LOW / APPROVED (pending artifact registry)** | SAM2, GroundingDINO, ControlNet, IP-Adapter, ComfyUI (as service) | Complete artifact registry entry before production |
| **Reference only** | InvokeAI | No production integration |

---

## Re-Audit Triggers

Re-run this audit when:
1. Any listed tool releases a new major version with new checkpoints
2. Any model weight file is updated on the GPU executor
3. A new jurisdiction's regulations become relevant to Creator City's deployment
4. InstantID or any face-related tool is reconsidered
5. Any checkpoint is replaced or re-licensed by the upstream maintainer
