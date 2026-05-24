# Creator City — Stable Generation Baseline

Last confirmed working: 2026-05-25
Status: **PRODUCTION STABLE**

---

## Image Generation Chain (confirmed end-to-end)

```
User types prompt
  → clicks Generate on image node
  → POST /api/generate/image  (Vercel, maxDuration=60, frontend timeout=70s)
    → creates GenerationJob row (status: QUEUED)
    → await fetch cn-executor /api/jobs/run-image (AbortSignal.timeout=50s)
      → cn-executor: generateSeedreamImage → Volcengine Seedream API
      → cn-executor: downloads image buffer from provider URL
      → cn-executor: uploads buffer to Aliyun OSS bucket "creatorcity"
      → cn-executor: marks GenerationJob SUCCEEDED, writes stableUrl
    → returns { status: "queued", generationJobId }
  → frontend polls /api/generate/image/status?generationJobId=...
      (max 12 polls × 5s = 60s)
    → on success: node shows resultImageUrl / stableUrl
    → canvas save + localStorage draft written
  → refresh: image still visible (loaded from saved canvas)
```

## What Was Fixed to Reach This State

| # | Problem | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | Job stuck QUEUED forever | `fetch().catch()` fire-and-forget dropped by Vercel | Changed to `await fetch()` with AbortSignal.timeout(50s) |
| 2 | False `provider_timeout` error | Frontend 30s timeout < backend 50s trigger | Image POST → 70s, Video POST → 90s |
| 3 | `generation_post_timeout` shown as `provider_timeout` | `normalizeVisibleGenerateErrorCode` regex matched errorCode string | Added explicit pass-through before regex |
| 4 | OSS `AccessDenied` / `oss_upload_error` | RAM user `creator-city-oss` lacked `oss:PutObject` | Granted permission in Aliyun RAM console |
| 5 | DB connection failure in Aliyun FC | Supabase direct IPv6 rejected by FC | Switched to Supabase Session Pooler |
| 6 | Prisma prepared statement error | PgBouncer incompatibility | Added `?pgbouncer=true` to connection URL |
| 7 | Token drain / auto-batch generation | 运行工作流 button triggered all nodes | Button removed |
| 8 | Prompt pollution / generation failure | styleBible/skills/storyboard injected into payload | Removed from handleNodeDialogGenerate dependency array |

## Infrastructure

| Component | Location | Notes |
|-----------|----------|-------|
| Web frontend | Vercel (global) | Next.js 14, App Router |
| Image/Video API | Vercel serverless `/api/generate/*` | maxDuration=60 |
| cn-executor | Aliyun Function Compute (CN region) | Node.js HTTP server, port 9000 |
| Database | Supabase (global, Session Pooler) | GenerationJob table via Prisma |
| OSS | Aliyun OSS, bucket: `creatorcity`, region: `oss-cn-hangzhou` | RAM user: `creator-city-oss` (AK prefix: LTAI5t6M) |
| Image provider | Volcengine Seedream | via Ark API (cn-executor only) |

## Environment Variables Required

### Vercel (web)
- `CN_EXECUTOR_BASE_URL` — cn-executor endpoint URL
- `CN_EXECUTOR_SECRET` — shared bearer token
- `DATABASE_URL` — Supabase Session Pooler URL
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Aliyun FC (cn-executor)
- `ALIYUN_OSS_ACCESS_KEY_ID` / `ALIYUN_OSS_ACCESS_KEY_SECRET` (or `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`)
- `ALIYUN_OSS_BUCKET` = `creatorcity`
- `ALIYUN_OSS_REGION` = `oss-cn-hangzhou`
- `ALIYUN_OSS_PUBLIC_BASE_URL` — CDN base URL for returned image URLs
- `ARK_API_KEY` — Volcengine Ark API key
- `DATABASE_URL` — Supabase Session Pooler URL
- `CN_EXECUTOR_SECRET` — shared bearer token

## Debug Endpoints (cn-executor)

All require `Authorization: Bearer <CN_EXECUTOR_SECRET>`.

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Service health + env presence |
| `GET /debug/oss-config` | Masked OSS config + required RAM permissions |
| `GET /debug/oss-write-probe` | Uploads test file, confirms PutObject works |
| `GET /debug/seedream-config` | Seedream / Ark config |
| `GET /debug/seedream-real-probe` | Live Seedream API call |
| `GET /api/jobs/debug?jobId=...` | GenerationJob state lookup |
