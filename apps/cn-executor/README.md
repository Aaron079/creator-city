# cn-executor

Creator City China region executor. Runs as a plain Node.js HTTP service on Aliyun Function Compute (FC) Web Function with an HTTP trigger.

## Status

Scaffold only. `/health` is live. `/api/generate/image` and `/api/generate/video` return `not_implemented` placeholders until generation logic is wired in.

## Endpoints

| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /health | No | Env presence check |
| POST | /api/generate/image | Yes | Placeholder — not yet implemented |
| POST | /api/generate/video | Yes | Placeholder — not yet implemented |

## Auth

Protected routes require the header:

```
X-Creator-Executor-Secret: <value of CREATOR_EXECUTOR_SHARED_SECRET>
```

## Local dev

```bash
pnpm install
pnpm dev        # tsx watch — hot reload
pnpm build      # tsc → dist/
pnpm start      # node dist/server.js
```

Default port: `9000`. Override with `PORT` env var.

## Deployment

See [docs/ALIYUN-FC-CN-EXECUTOR-SETUP.md](../../docs/ALIYUN-FC-CN-EXECUTOR-SETUP.md).
