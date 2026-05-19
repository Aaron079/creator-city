# Aliyun Function Compute — CN Executor Setup

## 1. Why Aliyun Function Compute for the China Executor

Creator City currently runs on Vercel. Vercel routes to China providers (Volcengine Ark) and Aliyun OSS from a global serverless environment. This causes:

- High latency on Vercel → Volcengine API calls.
- Provider-generated media URLs expire before Vercel can persist them to OSS.
- OSS signing and download paths behave differently when accessed from overseas.
- Media proxy returns 403 or timeouts because the download window closes before Vercel finishes.

The fix is to run China generation and storage work inside a China-adjacent runtime. Aliyun Function Compute (FC) is the natural target because:

- It runs in the same Aliyun network as OSS.
- It has low-latency access to Volcengine Ark from a China-region IP.
- It scales to zero when idle and bills per invocation.
- No separate server provisioning — just deploy a Node.js function and attach an HTTP trigger.

## 2. Architecture After Setup

```
Browser → Vercel (auth + DB) → executor-gateway.ts
                                    ↓
                         CREATOR_CN_API_BASE_URL
                                    ↓
                     Aliyun FC Web Function (this service)
                         ↓                    ↓
               Volcengine Ark API         Aliyun OSS
```

Vercel never touches Volcengine or OSS directly for China projects. It forwards the structured job payload, and the FC executor returns a stable OSS URL.

## 3. Create an Aliyun Function Compute Web Function

1. Log into the [Aliyun Function Compute console](https://fc.console.aliyun.com).
2. Select a China region (recommended: `cn-hangzhou` or `cn-shanghai` for Aliyun OSS proximity; `cn-beijing` for Volcengine proximity).
3. Click **Create Service** → name it `creator-city`.
4. Inside the service, click **Create Function**.
   Current production function name: `reator-city-cn-executor`.
5. Choose **Web Function** (HTTP function mode).
6. Runtime: **Node.js 20**.
7. Entry point: leave as default (Function Compute will call `server.js` or use the `npm start` script via a custom bootstrap).
8. Memory: 512 MB minimum (1024 MB recommended for video processing).
9. Timeout: 300 seconds (generation can take 30–120 s).

## 4. Configure the HTTP Trigger

1. In the function settings, go to **Triggers** → **Create Trigger**.
2. Trigger type: **HTTP Trigger**.
3. Request method: allow **GET** and **POST**.
4. Auth type: **Anonymous** (the executor uses its own `X-Creator-Executor-Secret` header for auth — do not use FC's built-in token auth, which would require extra signing on the Vercel side).
5. After saving, FC gives you a public HTTP endpoint like:

   ```
   https://<account-id>.<region>.fc.aliyuncs.com/2016-08-15/proxy/creator-city/<function-name>/
   ```

   Or, if you enable a **custom domain**, it will be:

   ```
   https://cn-executor.yourdomain.com/
   ```

## 5. Runtime — Node.js

The executor is a plain Node `http.createServer` app compiled with `tsc`. No Next.js, no NestJS.

Build and package steps:

```bash
cd apps/cn-executor
pnpm install
pnpm build          # tsc → dist/
```

Upload the `dist/` folder plus `node_modules/` and a `bootstrap` script to FC, or use the Aliyun CLI:

```bash
# zip the deployment package
zip -r cn-executor.zip dist/ node_modules/ package.json

# deploy via Aliyun CLI (fun / s / fc-api)
fun deploy
```

Or use the FC console to upload the zip directly.

For the current production function, package and deploy with:

```bash
FC_FUNCTION_NAME=reator-city-cn-executor bash scripts/deploy-cn-executor.sh
```

The deploy script validates the function first:

```bash
/tmp/aliyun fc GET "/2023-03-30/functions/reator-city-cn-executor"
```

## 6. Listening Port

Aliyun Function Compute Web Functions expect the HTTP server to listen on `process.env.PORT`. The executor defaults to `9000` if `PORT` is not set. FC injects the correct `PORT` at runtime — no code change required.

```
PORT=<injected by FC, usually 9000>
```

## 7. Required Environment Variables

Set these in **Function Compute → Function Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `VOLCENGINE_ARK_API_KEY` | Volcengine Ark API key for Seedream and Seedance |
| `VOLCENGINE_SEEDREAM_MODEL` | Seedream model endpoint ID (e.g. `ep-xxxxx`) |
| `VOLCENGINE_SEEDANCE_MODEL` | Seedance model endpoint ID |
| `ALIYUN_OSS_ACCESS_KEY_ID` | Aliyun RAM access key ID with OSS write permission |
| `ALIYUN_OSS_ACCESS_KEY_SECRET` | Corresponding access key secret |
| `ALIYUN_OSS_BUCKET` | OSS bucket name |
| `ALIYUN_OSS_REGION` | OSS region (e.g. `oss-cn-hangzhou`) |
| `ALIYUN_OSS_ENDPOINT` | OSS endpoint (e.g. `https://oss-cn-hangzhou.aliyuncs.com`) |
| `ALIYUN_OSS_PUBLIC_BASE_URL` | Optional public CDN base URL for served assets |
| `CREATOR_EXECUTOR_SHARED_SECRET` | Random secret shared with Vercel for request auth |
| `DEEPSEEK_API_KEY` | DeepSeek API key for text generation (e.g. script writing, prompt expansion) |
| `DEEPSEEK_BASE_URL` | DeepSeek API base URL — default: `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | DeepSeek model name — default: `deepseek-v4-flash` |

Generate a strong shared secret:

```bash
openssl rand -hex 32
```

Set the same value on Vercel as `CREATOR_EXECUTOR_SHARED_SECRET` is not needed on Vercel — Vercel uses it as the outbound secret via executor-gateway.ts. Add it to the Vercel env under the same name so the gateway can read it when forwarding requests.

Wait — Vercel needs to send the secret to FC. Set on Vercel:

```
CREATOR_EXECUTOR_SHARED_SECRET=<same value>
```

The executor gateway reads this and sets the `X-Creator-Executor-Secret` header when forwarding to FC. (This wiring is added in the next step when generation logic is connected.)

## 8. Verify the Health Endpoint

After deployment, check health:

```bash
curl https://<your-fc-endpoint>/health
```

Expected response when all env vars are set:

```json
{
  "ok": true,
  "service": "reator-city-cn-executor",
  "region": "cn",
  "runtime": "node",
  "env": {
    "VOLCENGINE_ARK_API_KEY": true,
    "VOLCENGINE_SEEDREAM_MODEL": true,
    "VOLCENGINE_SEEDANCE_MODEL": true,
    "ALIYUN_OSS_ACCESS_KEY_ID": true,
    "ALIYUN_OSS_ACCESS_KEY_SECRET": true,
    "ALIYUN_OSS_BUCKET": true,
    "ALIYUN_OSS_REGION": true,
    "ALIYUN_OSS_ENDPOINT": true,
    "CREATOR_EXECUTOR_SHARED_SECRET": true
  },
  "missingEnv": []
}
```

If `ok` is `false`, the `missingEnv` array lists which variables are missing.

## 9. Connect to Vercel

Once FC is running and `/health` returns `ok: true`, set on Vercel:

```
CREATOR_CN_API_BASE_URL=https://<your-fc-endpoint>
```

The executor gateway in `apps/web/src/lib/executors/executor-gateway.ts` reads this variable. When set, it forwards China-region generation requests to the FC executor instead of calling providers directly from Vercel.

Verify the Vercel health endpoint reflects the new executor:

```bash
curl https://creator-city-vert.vercel.app/api/generation/health
```

`executors.cn.configured` should become `true`.

## 10. Next Step — Wire Generation Logic

The current executor scaffold returns placeholder errors for `/api/generate/image` and `/api/generate/video`. The next step is to implement the actual generation handlers inside `apps/cn-executor/src/handlers/`:

1. `generateImage.ts` — calls Volcengine Seedream, downloads the result, uploads to OSS, returns stable URL.
2. `generateVideo.ts` — calls Volcengine Seedance, polls the task, downloads, uploads to OSS.

No Vercel routes change. Vercel stays as the control plane. The FC executor becomes the only process that touches Volcengine and OSS.
