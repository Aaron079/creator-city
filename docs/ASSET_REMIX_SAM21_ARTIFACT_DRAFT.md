# Asset Remix — SAM 2.1 Artifact Registry (Draft)

**Status:** CANDIDATE / SHA256_PENDING / NOT_APPROVED
**Date:** 2026-06-21
**Document:** Draft for Founder review — no artifact may be used in production until marked APPROVED.

**CRITICAL:** No weights are downloaded. No SHA-256 values are verified. This document defines the verification process, not the outcome.

---

## 1. Artifact Entry (YAML form)

```yaml
artifactId:       sam2.1-hiera-base-plus
displayName:      SAM 2.1 Hierarchical Hiera-B+ (Base Plus)
transformKind:    remove-background
approvalStatus:   CANDIDATE

# Source
officialRepo:     https://github.com/facebookresearch/sam2
officialTag:      v1.0          # Pin to a specific tag, never float to 'main'
officialRelease:  https://github.com/facebookresearch/sam2/releases/tag/v1.0

# Checkpoint
checkpointName:   sam2.1_hiera_base_plus.pt
officialDownloadUrl: https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt
officialConfigFile:  sam2/configs/sam2.1/sam2.1_hiera_b+.yaml

# Sizes (from official release notes — must be re-verified at download time)
estimatedSizeMB:  308
estimatedSizeBytes: 322961408   # 308 MB approx; verify with actual download

# Integrity (PENDING — must be computed before APPROVED)
sha256:           SHA256_PENDING
sha256VerifiedAt: null
sha256VerifiedBy: null

# Config file hash (computed from repo at pinned tag)
configSha256:     SHA256_PENDING

# Licenses
codeLicense:      Apache-2.0
codeLicenseUrl:   https://github.com/facebookresearch/sam2/blob/main/LICENSE
checkpointLicense: Apache-2.0
checkpointLicenseUrl: https://github.com/facebookresearch/sam2/blob/main/LICENSE
licenseVerifiedAt: null
licenseVerifiedBy: null

# Permitted use
commercialUsePermitted: true
attributionRequired:    false
modificationPermitted:  true
redistributionPermitted: true
nonCommercialOnlyClause: false

# Upstream reference
upstreamCommit:   SHA_PENDING
upstreamTagVerified: false

# Registry timestamps
addedAt:          2026-06-21
downloadedAt:     null
verifiedAt:       null
approvedAt:       null
approvedBy:       null
```

---

## 2. Artifact Entry (JSON form — used in artifact_manifest.json)

This is the machine-readable format used by `artifact_registry.py` in the `creator-city-remix-executor` repo.

```json
{
  "artifacts": {
    "sam2.1-hiera-base-plus": {
      "artifactId": "sam2.1-hiera-base-plus",
      "displayName": "SAM 2.1 Hierarchical Hiera-B+ (Base Plus)",
      "upstreamRepository": "https://github.com/facebookresearch/sam2",
      "upstreamReleaseOrCommit": "v1.0",
      "artifactUrl": "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt",
      "fileName": "sam2.1_hiera_base_plus.pt",
      "fileSize": 322961408,
      "sha256": "SHA256_PENDING",
      "codeLicense": "Apache-2.0",
      "checkpointLicense": "Apache-2.0",
      "permittedUse": {
        "commercial": true,
        "modification": true,
        "redistribution": true,
        "nonCommercialOnly": false
      },
      "approvalStatus": "CANDIDATE",
      "downloadedAt": null,
      "verifiedBy": null,
      "approvalDate": null
    }
  }
}
```

`artifact_registry.py` reads this file at worker startup. If `approvalStatus !== "APPROVED"` and `DEV_MODE !== "1"`, the worker refuses to start and logs:
```json
{"event": "artifact_not_approved", "artifactId": "sam2.1-hiera-base-plus", "approvalStatus": "CANDIDATE"}
```

---

## 3. Checkpoint License Analysis

### Code (facebook/sam2 repository)
- License: **Apache-2.0**
- Commercial use permitted, modification permitted, redistribution permitted with notice
- No "non-commercial only" clause
- No "research only" clause
- No face-recognition / biometric clause

### Checkpoint file (sam2.1_hiera_base_plus.pt)
- Distributed under **Apache-2.0** — same as the code
- Meta AI has not placed additional restrictions on the weights for this model family
- **Materially different from LLaMA models** which carry additional commercial licenses
- **Verification required:** Re-read the LICENSE file at the pinned commit; confirm no separate NOTICE file restricts checkpoint use

### Training data
- SAM 2 trained on SA-1B (Segment Anything 1B) + video data
- SA-1B images are CC BY 4.0 — does not restrict downstream model use
- No known training data restriction passes to checkpoint users

---

## 4. SHA-256 Verification Procedure

This procedure MUST be followed before `approvalStatus` changes from `CANDIDATE` to `APPROVED`.

### Step 1: Set up isolated environment
```bash
uname -a
python3 --version
curl --version
```
Record OS, Python version, curl version.

### Step 2: Download checkpoint from official URL only
```bash
# Do NOT use PyPI auto-download, HuggingFace Hub, or 'from_pretrained'
mkdir -p /verification/sam2.1
cd /verification/sam2.1
curl -L --fail --retry 3 --retry-delay 5 \
  -o sam2.1_hiera_base_plus.pt \
  "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt"
```

### Step 3: Compute SHA-256
```bash
sha256sum sam2.1_hiera_base_plus.pt
# macOS:
shasum -a 256 sam2.1_hiera_base_plus.pt
```

### Step 4: Verify via second download
```bash
curl -L --fail -o sam2.1_hiera_base_plus_verify.pt \
  "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt"
sha256sum sam2.1_hiera_base_plus_verify.pt

diff <(sha256sum sam2.1_hiera_base_plus.pt | cut -d' ' -f1) \
     <(sha256sum sam2.1_hiera_base_plus_verify.pt | cut -d' ' -f1) \
  && echo "MATCH" || echo "MISMATCH — DO NOT APPROVE"
```

### Step 5: License verification at pinned commit
```bash
git clone https://github.com/facebookresearch/sam2
cd sam2
git checkout v1.0
git log -1 --format="%H" > upstream_commit_hash.txt
cat LICENSE | head -20   # Confirm Apache-2.0
cat NOTICE 2>/dev/null || echo "No NOTICE file"
sha256sum sam2/configs/sam2.1/sam2.1_hiera_b+.yaml > config_sha256.txt
```

### Step 6: Update this document and artifact_manifest.json

Fill in:
- `sha256:` (verified hex string)
- `sha256VerifiedAt:` (ISO8601)
- `sha256VerifiedBy:` (name of verifier)
- `upstreamCommit:` (from `upstream_commit_hash.txt`)
- `configSha256:` (from `config_sha256.txt`)
- `licenseVerifiedAt:`, `licenseVerifiedBy:`
- `downloadedAt:`, `fileSize:` (actual bytes, `ls -la` output)

Update `artifact_manifest.json` `sha256` and `approvalStatus: "APPROVED"` only after Founder sign-off.

---

## 5. Preventing Auto-Download of Unverified Versions

### Problem
Libraries like `segment_anything_2` and `transformers` auto-download models at runtime. This bypasses SHA-256 verification.

### Required mitigations (all required before production)

**M1: Pin model into Docker image at build time**
```dockerfile
COPY --chown=worker:worker sam2.1_hiera_base_plus.pt /models/sam2.1/
COPY --chown=worker:worker sam2.1_hiera_b+.yaml /models/sam2.1/
ENV HUGGINGFACE_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
ENV SAM2_MODEL_PATH=/models/sam2.1/sam2.1_hiera_base_plus.pt
ENV SAM2_CONFIG_PATH=/models/sam2.1/sam2.1_hiera_b+.yaml
```

**M2: Verify hash at worker startup (artifact_registry.py)**
```python
import hashlib, os, sys, json

def verify_model_integrity():
    manifest = json.load(open("/app/artifact_manifest.json"))
    entry = manifest["artifacts"]["sam2.1-hiera-base-plus"]
    expected = entry["sha256"]
    if expected == "SHA256_PENDING":
        if os.environ.get("DEV_MODE") != "1":
            print('{"event":"artifact_not_approved","reason":"SHA256_PENDING"}', file=sys.stderr)
            sys.exit(1)
        return
    path = os.environ["SAM2_MODEL_PATH"]
    with open(path, "rb") as f:
        actual = hashlib.sha256(f.read()).hexdigest()
    if actual != expected:
        print(f'{{"event":"artifact_hash_mismatch","expected":"{expected[:16]}...","actual":"{actual[:16]}..."}}',
              file=sys.stderr)
        sys.exit(1)
    print(f'{{"event":"artifact_verified","artifactId":"sam2.1-hiera-base-plus","sha256_prefix":"{actual[:16]}..."}}')
```

**M3: Disable floating `latest` in worker code**
```python
# WRONG — never do this:
model = SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-base-plus")

# CORRECT — always do this:
model = build_sam2(
    config_file=os.environ["SAM2_CONFIG_PATH"],
    ckpt_path=os.environ["SAM2_MODEL_PATH"],
    device=DEVICE
)
```

**M4: Pin pip packages with hashes**
```
# requirements.lock (pip --require-hashes mode)
segment-anything-2==1.0 \
    --hash=sha256:{{to be filled at download time}}
torch==2.4.1+cu121 \
    --hash=sha256:{{to be filled at download time}}
```

---

## 6. Registry Status Table

| Field | Current Value |
|---|---|
| `approvalStatus` | **CANDIDATE** |
| `sha256Status` | **PENDING** |
| `licenseStatus` | **PENDING** |
| May be used in production | **NO** |
| May be used in Docker image build | **NO** |
| May be used in local smoke test | With explicit Founder sign-off + DEV_MODE=1 only |

**Approval gate:** Until all fields are verified and `approvalStatus = "APPROVED"`, the worker exits at startup. The CC Gateway `isArtifactApproved()` check (once implemented) returns `false`.

---

## 7. Future Artifacts (Separate Documents Required)

| Artifact | Status | Blocker |
|---|---|---|
| `swinir-realworld-x4` | CANDIDATE | LICENSE_AND_SHA256_PENDING |
| `rembg-u2net` | NOT_EVALUATED | License OK (MIT); weights per-artifact; may use as fallback |
| `rembg-isnet` | NOT_EVALUATED | May be better for portraits |
| `Real-ESRGAN x4plus` | PRODUCTION_BLOCKED | Weight license unverified |

Each artifact requires its own document following this template before it can be approved.
