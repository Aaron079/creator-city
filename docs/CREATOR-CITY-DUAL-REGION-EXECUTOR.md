# Creator City Dual Region Executor Gateway

Status: architecture foundation. No data migration. No existing generation route changes. No UI changes.

## 1. Why Dual Region Execution

Creator City currently runs everything on Vercel and calls China providers (Volcengine Ark) and China object storage (Aliyun OSS) from Vercel's global serverless environment. This creates unstable behavior:

- Vercel → Volcengine Ark: high latency, intermittent provider fetch failures.
- Vercel → Aliyun OSS: signed URL generation and media download both fail under load.
- Provider-generated media URLs expire before Vercel can persist them to OSS.
- Media proxy returns 403 or timeouts because the download window has closed.

The fix is not to tweak timeouts — it is to stop running China workloads on Vercel.

## 2. China Projects Must Use a China Executor

China projects generate media with Volcengine Seedream (image) and Volcengine Seedance (video), then persist to Aliyun OSS. All three operations need stable access to China infrastructure.

A China executor is a backend process running inside mainland China or a China-adjacent region (Hong Kong, Singapore) that has low-latency access to Volcengine API endpoints and Aliyun OSS. When a generation request is routed to the China executor, the executor:

1. Calls Volcengine Ark directly with sub-100 ms API latency.
2. Downloads the generated media while the provider URL is still valid.
3. Uploads to Aliyun OSS in the same network segment.
4. Returns a stable OSS URL to Vercel.

Vercel's role becomes: receive user request → validate auth → forward to China executor → store result in DB → return to client. Vercel never touches the provider or OSS directly.

## 3. Global Projects Will Use a Global Executor

Global projects (OpenAI, Runway, Replicate, Fal) are registered as `future` availability. When activated:

- A global executor runs on infrastructure with stable access to non-China providers.
- Aliyun OSS is replaced with S3, Cloudflare R2, or Vercel Blob for global storage.
- The same region gateway routes `providerRegion === 'global'` to `CREATOR_GLOBAL_API_BASE_URL`.

No global executor logic is live today. The registry and gateway are scaffolded so the routing decision exists in code before the executor is deployed.

## 4. Vercel No Longer Bears the China Execution Layer

After deploying the China executor and setting `CREATOR_CN_API_BASE_URL`:

- `/api/generate/image` and `/api/generate/video` on Vercel become thin forwarders for China requests.
- The executor gateway (`executor-gateway.ts`) checks `providerRegion`, reads the env var, and forwards the minimal required payload.
- No user cookies are forwarded to the executor — only the structured job payload.
- If the executor is unreachable, the gateway returns `errorCode: "cn_executor_not_configured"` or `errorCode: "executor_fetch_failed"` as JSON — never HTML.

Vercel continues to serve the frontend, handle auth, write to the database, and expose the admin panel.

## 5. How to Deploy the China Executor

The China executor is a separate Next.js (or Express/Fastify) process deployed on a China-accessible host. It exposes the same two routes:

```
POST /api/generate/image
POST /api/generate/video
```

It receives a simplified JSON payload (no session cookies) and returns the same response shape as the current Vercel routes. Required environment variables on the executor:

```
VOLCENGINE_ARK_API_KEY=...
VOLCENGINE_SEEDREAM_MODEL=...
VOLCENGINE_SEEDANCE_MODEL=...
ALIYUN_OSS_ACCESS_KEY_ID=...
ALIYUN_OSS_ACCESS_KEY_SECRET=...
ALIYUN_OSS_BUCKET=...
ALIYUN_OSS_REGION=...
ALIYUN_OSS_ENDPOINT=...
DATABASE_URL=...   # same DB as Vercel, or a replica
```

Once deployed, set on Vercel:

```
CREATOR_CN_API_BASE_URL=https://your-cn-executor.example.com
```

The gateway will immediately start routing China provider requests to the executor. No code change is required.

## 6. Environment Variables

| Variable | Side | Purpose |
|---|---|---|
| `CREATOR_CN_API_BASE_URL` | Vercel | Base URL of the China executor. If absent, China generation returns `cn_executor_not_configured`. |
| `CREATOR_GLOBAL_API_BASE_URL` | Vercel | Base URL of the Global executor. If absent, global generation returns `global_executor_not_configured`. |

Both variables are optional today. When absent, existing Vercel-direct generation continues to work as before (the gateway is not yet wired into the live generate routes — it is scaffolded for the next step).

## 7. Health Endpoint

`GET /api/generation/health` now returns executor status:

```json
{
  "executors": {
    "cn": {
      "configured": false,
      "baseUrlConfigured": false
    },
    "global": {
      "configured": false,
      "baseUrlConfigured": false
    }
  }
}
```

`configured: true` means `CREATOR_CN_API_BASE_URL` or `CREATOR_GLOBAL_API_BASE_URL` is set and non-empty. This lets the admin panel surface executor readiness without a separate endpoint.

## 8. Provider and Storage Region Registry

| Provider | Region | Availability |
|---|---|---|
| volcengine_seedream | cn | active |
| volcengine_seedance | cn | active |
| openai | global | future |
| runway | global | future |
| replicate | global | future |
| fal | global | future |

| Storage | Region | Availability |
|---|---|---|
| aliyun_oss | cn | active |
| s3 | global | future |
| cloudflare_r2 | global | future |
| vercel_blob | global | future |

## 9. What This Step Does NOT Do

- Does not wire the executor gateway into existing `/api/generate/image` or `/api/generate/video` routes. Current generation behavior is unchanged.
- Does not migrate any data.
- Does not change `/create` page behavior.
- Does not call any global provider APIs.
- Does not change OSS persistence logic.
- Does not remove any existing environment variables.

The gateway is ready to be wired in as the next discrete step once a China executor is running and `CREATOR_CN_API_BASE_URL` is confirmed.
