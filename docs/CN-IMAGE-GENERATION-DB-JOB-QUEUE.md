# CN Image Generation — DB Job Queue

## Overview

CN image generation uses a **database job queue** pattern to decouple Vercel from
cn-executor execution time. Vercel creates a job and returns immediately; cn-executor
reads the job from the database, executes Seedream, writes the result back, and the
frontend polls the Vercel status endpoint until the job is complete.

---

## Flow

```
Frontend
  │
  ├─ POST /api/generate/image
  │    │
  │    ├─ Create GenerationJob (QUEUED) in DB
  │    ├─ Fire-and-forget POST /api/jobs/run-image → cn-executor
  │    └─ Return { status: "queued", generationJobId } immediately
  │
  ├─ poll GET /api/generate/image/status?generationJobId=<id>
  │    │
  │    └─ Read GenerationJob from DB
  │         ├─ QUEUED / PROCESSING → { status: "running" }
  │         ├─ SUCCEEDED → { status: "succeeded", resultImageUrl, assetId }
  │         └─ FAILED → { status: "failed", errorCode, message }
  │
  └─ show image when status = "succeeded"

cn-executor
  │
  └─ POST /api/jobs/run-image  (from Vercel fire-and-forget)
       │
       ├─ Respond 200 immediately
       └─ setImmediate → runImageJob(generationJobId)
            │
            ├─ SELECT GenerationJob FROM DB (pg)
            ├─ UPDATE GenerationJob → PROCESSING
            ├─ executeImageGeneration() → Volcengine Seedream → Aliyun OSS
            ├─ INSERT Asset INTO DB
            ├─ UPDATE GenerationJob → SUCCEEDED + outputAssetId + output JSON
            └─ UPDATE CanvasNode → resultImageUrl + metadataJson
```

---

## Why This Architecture

| Problem | Solution |
|---|---|
| Vercel 90s max timeout can't cover Seedream (~55s) + OSS upload | Return in <1s; cn-executor runs independently |
| Aliyun FC is multi-instance — no shared in-memory Map | All state in PostgreSQL DB |
| Frontend reload loses in-flight task | Job persists in DB; any poll reads correct state |
| Status route shouldn't depend on cn-executor availability | Status route only queries DB |

---

## Key Files

| File | Role |
|---|---|
| `apps/web/src/app/api/generate/image/route.ts` | Creates QUEUED job, fires to cn-executor |
| `apps/web/src/app/api/generate/image/status/route.ts` | DB-only status polling |
| `apps/cn-executor/src/handlers/jobRunner.ts` | DB executor: reads job, generates, writes result |
| `apps/cn-executor/src/db.ts` | pg Pool + query helper |

---

## GenerationJob Lifecycle

| Status | Set by | When |
|---|---|---|
| `QUEUED` | Vercel `image/route.ts` | Job created, fire-and-forget sent |
| `PROCESSING` | cn-executor `jobRunner.ts` | Job received from DB, generation started |
| `SUCCEEDED` | cn-executor `jobRunner.ts` | Image generated + OSS upload + Asset created |
| `FAILED` | cn-executor `jobRunner.ts` | Any error during generation or upload |

---

## cn-executor DB Access

cn-executor connects to the production PostgreSQL database using `DATABASE_URL`
(must be set as an Aliyun FC environment variable).

Uses raw `pg` queries (no Prisma) with quoted table names to match Prisma's
PascalCase model naming: `"GenerationJob"`, `"Asset"`, `"CanvasNode"`.

Connection pool: max 3 connections, 30s idle timeout, 10s connect timeout, SSL enabled.

---

## Error Output Schema (GenerationJob.output on FAILED)

```json
{
  "errorCode": "provider_model_invalid",
  "message": "Volcengine returned 404: endpoint not found",
  "providerRegion": "cn",
  "executionRegion": "cn",
  "storageRegion": "cn",
  "executorKind": "aliyun_fc",
  "upstreamMessage": "...",
  "upstreamStatus": 404,
  "providerEndpoint": "https://ark.cn-beijing.volces.com/...",
  "providerHttpStatus": 404,
  "requestId": "...",
  "submittedInput": { ... },
  "providerResponse": { ... }
}
```

---

## Environment Variables Required on cn-executor

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for production DB |
| `VOLCENGINE_ARK_API_KEY` | Volcengine Ark API key |
| `VOLCENGINE_SEEDREAM_MODEL` | Seedream model / endpoint ID |
| `ALIYUN_OSS_ACCESS_KEY_ID` | OSS upload credentials |
| `ALIYUN_OSS_ACCESS_KEY_SECRET` | OSS upload credentials |
| `ALIYUN_OSS_BUCKET` | Target OSS bucket |
| `ALIYUN_OSS_REGION` | OSS region (e.g. `oss-cn-beijing`) |
| `ALIYUN_OSS_ENDPOINT` | OSS endpoint URL |
| `ALIYUN_OSS_PUBLIC_BASE_URL` | Public CDN base URL for OSS assets |
| `CREATOR_EXECUTOR_SHARED_SECRET` | Shared secret for Vercel→cn-executor auth |

---

## v2 Roadmap

- Credit settlement: cn-executor calls Vercel `/api/internal/settle-credits` after SUCCEEDED
- Timeout watchdog: cron job marks jobs FAILED if stuck in PROCESSING > 5 minutes
- Video job queue: same pattern for `volcengine-seedance-video`
