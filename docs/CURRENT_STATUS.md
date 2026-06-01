# Creator City — Current Status

Last updated: 2026-06-01
Last valid commit: `3ec63b5`

---

## P0 DB Pool Timeout — CLOSED (verified)

**Verification date:** 2026-06-01
**Commit:** `3ec63b5` — "reduce canvas save retries during db unavailable"

### Acceptance results

| Check | Result |
|---|---|
| Node card no longer shows raw JSON error | ✅ |
| OpenAI quota exhaustion shows friendly message + DeepSeek hint | ✅ |
| Console / Network no longer shows dense consecutive canvas PUT 503s | ✅ |
| Canvas save 503 backoff (10s) is active and working | ✅ |
| `/api/generate/text` server logs now include `stage` field | ✅ |
| `/api/projects/<projectId>/canvas` PUT logs now include `stage` field | ✅ |

DB pool timeout is no longer the primary issue. Cascade 503 (generation fail → immediate canvas PUT into exhausted pool) is resolved by pre-arming `saveBackoffUntilRef` in the generation failure path.

---

## Current Remaining Issues

### OpenAI quota / balance exhausted
- OpenAI provider fails with quota / rate-limit errors when account balance is depleted.
- Frontend now shows a short friendly message recommending DeepSeek as an alternative.
- **DeepSeek is confirmed available** and working for text generation.

### No other active P0 issues at this time.

---

## Next Phase Tasks (priority order)

1. **Provider status & DeepSeek fallback — full UX**
   - Confirm DeepSeek as the recommended fallback provider for CN users
   - Improve provider status indicator in canvas toolbar
   - Ensure fallback suggestion is visible and actionable in node error state

2. **China-region default provider strategy**
   - Define which provider is shown first / pre-selected for CN users
   - Validate DeepSeek text, image, video generation end-to-end in CN region

3. **Asset library recovery (lower priority, after above)**
   - Re-examine asset persistence after generation
   - Asset recovery / history lookup UI (was removed in simplification pass)

---

## Forbidden Areas (do not touch)

- `apps/cn-executor` — China executor, separate deploy
- `/api/generate/image`, `/api/generate/video` — generation routes
- `apps/web/src/lib/billing/` — billing, reserve, settle logic
- `apps/web/src/lib/credits/` — credit deduction
- Payment / Stripe / Alipay / WeChat
- Prisma schema / migrations
- `package.json` / `pnpm-lock.yaml`
- `.env` files
- Provider adapter real call logic
- Adding new providers
- Changing `providerId` / `modelId` / credit amounts

---

## Stable Baseline (do not regress)

Modules confirmed working as of `3ec63b5`:

- Canvas node CRUD (add / edit / delete / drag / connect)
- Image generation chain (prompt → POST → poll → display)
- Video generation chain (prompt → POST → poll → display)
- Text generation chain (DeepSeek, Kimi)
- Canvas save / load (PUT/GET with localStorage draft fallback)
- Media proxy (`/api/media/proxy`) for cross-region OSS display
- Session auth (Supabase + Prisma, with pgBouncer pool guard)
- Provider status display in canvas
- Error code / stage trace in node card
- `saveBackoffUntilRef` canvas save storm protection
