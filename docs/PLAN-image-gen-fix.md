# PLAN: Fix /create image generation PROVIDER_AUTH_FAILED

## Goal
Identify and fix why image generation on old /create canvas returns PROVIDER_AUTH_FAILED.

## Audit Findings (2026-05-21)

### Code path confirmed (no routing bug)
```
/create canvas
  → POST /api/generate/image  (Vercel, apps/web/src/app/api/generate/image/route.ts)
  → creates GenerationJob (QUEUED)
  → POST cn-executor /api/jobs/run-image  (Aliyun FC)
  → runImageJob()  (jobRunner.ts)
  → executeImageGeneration()  (generateImage.ts)
  → generateSeedreamImage()  (volcengine.ts)
  → POST https://ark.cn-beijing.volces.com/api/v3/images/generations
```

### cn-executor health (live, 2026-05-21)
- ok=true
- VOLCENGINE_ARK_API_KEY: present (true)
- VOLCENGINE_SEEDREAM_MODEL: present (true)
- missingEnv: []

### Local diagnostic blocked
- CREATOR_EXECUTOR_SHARED_SECRET not set locally
- Cannot call authenticated endpoints (/debug/seedream-config, /debug/seedream-real-probe, /debug/ark-network)

### Critical code finding: `upstreamStatus` not forwarded to browser
File: apps/web/src/app/api/generate/image/route.ts  lines 532-552

When cn-executor returns { status: 'failed', ... }, Vercel forwards:
- ✅ errorCode
- ✅ message
- ✅ upstreamMessage
- ✅ requestId
- ❌ upstreamStatus (missing — canvas can't show HTTP 401/403)
- ❌ providerHttpStatus (missing)
- ❌ providerResponse (missing — raw Volcengine error body hidden)

### What PROVIDER_AUTH_FAILED means in volcengine.ts
```typescript
// volcengine.ts normalizeSeedreamErrorCode()
if (status === 401) return 'provider_auth_failed'
if (status === 403) {
  if (/quota|billing/.test(msg)) return 'provider_quota_or_billing_error'
  if (/permission|forbidden|not.?allow/.test(msg)) return 'provider_invalid_parameter'
  return 'provider_auth_failed'   // generic 403
}
```

PROVIDER_AUTH_FAILED = Volcengine returned HTTP 401 OR 403 (generic).

### Root cause (most likely)
VOLCENGINE_ARK_API_KEY in cn-executor is invalid/expired, OR endpoint
ep-20260517143936-zhwnc is not accessible to this key.
- Presence confirmed (true), but VALUE never verified
- No code change can fix a wrong API key

### watermark fix status
✅ Already fixed in volcengine.ts (line 232 comment: "watermark is intentionally omitted")

## Steps

- [x] Step 1: Run code audit (grep for PROVIDER_AUTH_FAILED, read all relevant files)
- [x] Step 2: Run live health/config diagnostics
- [x] Step 3: Confirm routing path and error propagation
- [x] Step 4: Identify diagnostic gap: upstreamStatus/providerResponse not forwarded
- [ ] Step 5: Fix route.ts — forward upstreamStatus, providerHttpStatus, providerResponse in cn-executor failure path
- [ ] Step 6: Build and deploy web fix
- [ ] Step 7: User retries — reads Network panel response to get actual Volcengine error
- [ ] Step 8: Based on HTTP status:
  - 401 → VOLCENGINE_ARK_API_KEY is invalid/expired. User must rotate key in Volcengine ARK console, update Aliyun FC env var, redeploy cn-executor.
  - 403 (generic) → Key valid but endpoint ep-20260517143936-zhwnc lacks permission. Check endpoint status in ARK console.
  - 403 (quota) → Account billing issue. Check ARK console balance.
  - 400 → Parameter error (not auth). Check model/size mapping.
  - 404 → Endpoint deleted. Create new endpoint in ARK console, update VOLCENGINE_SEEDREAM_MODEL.

## Definition of done
- User can trigger image generation on /create
- A real image URL (OSS link) is returned
- CanvasNode shows the image
- No PROVIDER_AUTH_FAILED error

## Risks
- API key rotation requires updating Aliyun FC env var AND redeploying cn-executor ZIP
- If endpoint ID changed, VOLCENGINE_SEEDREAM_MODEL must be updated in Aliyun FC env
- Cannot test from local machine without CREATOR_EXECUTOR_SHARED_SECRET
