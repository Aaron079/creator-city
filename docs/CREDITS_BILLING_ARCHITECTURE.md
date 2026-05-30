# Creator City — Credits & Billing Architecture

## System Overview

Creator City uses a **Platform Credits** model. Users purchase credits; each
generation job reserves, then settles or releases credits atomically.

BYO Key mode does not exist yet (planned Phase 4).

---

## DB Entities

| Table | Role |
|-------|------|
| `UserCreditWallet` | Per-user balance (balance, frozenBalance, totalPurchased, totalConsumed) |
| `CreditLedger` | Immutable ledger — every balance change is a row |
| `PaymentOrder` | Checkout sessions (stripe/alipay/wechat/paddle/manual) |
| `GenerationJob` | One row per AI call; `billingStatus`: PENDING→FROZEN→SETTLED/REFUNDED |
| `ProviderCostLedger` | Platform cost tracking; `marginCredits` = revenue − cost |
| `ProviderAccount` | Per-provider monthly budget caps |
| `ProviderPricingRule` | DB-level pricing per `(providerId, modelId, nodeType)` — **not yet activated** |

---

## Billing Flow

```
User clicks generate
    │
    ▼
setupBilling()              [billing-middleware.ts]
    ├── estimateGenerationCredits()   ← delegates to shared-cost-rules.ts
    ├── wallet.balance < estimated   → 402 INSUFFICIENT_CREDITS
    └── reserveCreditsForJob()       → FROZEN state, balance debited, frozenBalance +N

callProviderAPI()

    ├── success → finalizeBilling('settle')  → SETTLED, frozenBalance -N, totalConsumed +N
    └── failure → finalizeBilling('release') → REFUNDED, balance restored
```

---

## Pricing Rules (Phase 1.5 — current)

Single source of truth: **`apps/web/src/lib/credits/shared-cost-rules.ts`**

| Node type | Provider | Credits |
|-----------|----------|---------|
| text | any | 5 |
| image | any | 20 |
| video std | any (non-HQ) | 120 (5s) / 240 (10s) |
| video HQ | runway, sora, kling-pro, pika-pro, *-pro | 300 (5s) / 600 (10s) |
| audio | any | 20/min |
| audio | elevenlabs | 30 (fixed) |
| music | udio, suno | 40 (fixed) |

`ProviderPricingRule` DB table exists but is empty — activating it (Phase 3A)
will allow live price changes without deploys.

---

## File Map

| File | Role |
|------|------|
| `lib/credits/shared-cost-rules.ts` | Unified pricing logic — single source of truth |
| `lib/billing/estimate.ts` | Server-side estimator — delegates to shared-cost-rules |
| `lib/credits/cost-rules.ts` | Client-side display estimator — delegates to shared-cost-rules |
| `lib/credits/shared-cost-rules.test.ts` | 16 unit tests; verifies server ↔ display consistency |
| `lib/credits/server.ts` | Prisma wallet ops (getOrCreateWallet, getLedger, etc.) |
| `lib/credits/billing-middleware.ts` | setupBilling() / finalizeBilling() wired into generate routes |
| `lib/billing/reserve.ts` | Atomic reserve transaction |
| `lib/billing/settle.ts` | Atomic settle / release transactions |
| `lib/billing/packages.ts` | 5 credit packages ($6.99–$399.99) |
| `lib/billing/payment-router.ts` | Dispatches to alipay/wechat/stripe/paddle/manual |
| `app/api/credits/balance/route.ts` | GET — read-only wallet balance, success envelope |
| `app/api/credits/wallet/route.ts` | GET — full wallet object (pre-existing route) |
| `components/create/CreditBalanceBadge.tsx` | Canvas topbar credit display component |

---

## Execution Log

### Phase 1.5 — Credit Rule Unification (2026-05-30)

**Problem**: Two independent pricing files with inconsistent values:
- `estimate.ts` (server truth): runway = 300 (HQ 5s), video default = 120
- `cost-rules.ts` (display): runway = 150, video default = 100

**Fix**:
1. Created `lib/credits/shared-cost-rules.ts` — canonical rule set based on `estimate.ts` truth
2. Rewrote `estimate.ts` to delegate: `estimateStaticCredits(...).credits`
3. Rewrote `cost-rules.ts` to delegate: same function, same result
4. Added 16 unit tests: 10 functional, 6 consistency checks (server ↔ display)
5. All 16 tests pass

**No price strategy change.** Only alignment to pre-existing server values.

### Phase 2A — Wallet Balance UI (2026-05-30)

**Added**:
- `GET /api/credits/balance` — read-only, `{success, availableCredits, frozenCredits, totalCredits, totalPurchased, totalConsumed}`. Returns 401 if unauthenticated.
- `CreditBalanceBadge.tsx` — client component, fetches on mount, shows `◎ N` in canvas topbar. Loading / error / unauthenticated states handled. No charge, no ledger write.
- Badge placed in `canvas-topbar-actions` before save status pill.
- CSS class `canvas-credit-badge` added to `canvas.module.css`.

**Not done this phase**: payment UI, top-up button, reserve/settle changes, DB schema changes.

### Phase 2B-lite — Insufficient Credits Modal (2026-05-30)

**Context**: generation routes already return `INSUFFICIENT_CREDITS` (HTTP 402) with
`requiredCredits` and `availableCredits` fields. Previously the frontend wrote the node to
`status: 'error'` and showed a toast. The node was left in an error state requiring retry.

**Added**:
- `CreditInsufficientModal.tsx` — dark glass modal (createPortal, z-index 99999).
  Shows `requiredCredits` / `availableCredits` from the API response, or generic text
  if fields are absent. Fetches fresh balance from `/api/credits/balance` on open.
  Shows 3 plan cards (Starter 500 / Creator 1500 / Studio 5500) with "Soon" badges.
  "了解充值方案" button is disabled. "稍后再说" closes. Escape key works.
- Intercepted `INSUFFICIENT_CREDITS` at **both** error paths in `VisualCanvasWorkspace`:
  - Polling path (text/image job poll result)
  - Immediate result path (image/video sync response)
- For `INSUFFICIENT_CREDITS`: node is **not** written to `status: 'error'`. Instead it is
  restored to `nodeSnapshot.status` (the state before clicking Generate), leaving it
  in a retryable state. The modal opens. `setDialogError(null)` clears any dialog error.
- All other error codes (`SEEDANCE_TASK_FAILED`, `content_policy_rejected`,
  `provider_timeout`, `OPENAI_RATE_LIMITED`, `PROVIDER_NOT_CONFIGURED`, etc.) continue
  to use the original error handling path unchanged.

**Not changed**: reserve/settle transactions, image/video generate routes, cn-executor,
DB schema, billing-middleware, env, packages.

### Phase 2B — Stripe Checkout Test Mode (2026-05-30)

**Context**: Purchase flow previously depended on NestJS (`createPaymentOrder` → `api/v1/credits/orders`, `fulfillOrder` → `api/v1/credits/internal/fulfill-order`). Also used Bearer token auth on the checkout route while the billing page sent session cookies — causing 401 for all purchases.

**Fix**:
1. Rewrote `POST /api/billing/checkout`:
   - Auth: `getCurrentUser()` session cookie (was: `extractBearerToken`)
   - Package lookup: server-side `getCreditPackage(packageId)` — user cannot specify credits/price
   - Creates `PaymentOrder` via Prisma directly (was: NestJS call)
   - Calls `createCheckoutSession` (raw fetch to Stripe API, no SDK)
   - Updates `PaymentOrder.stripeSessionId` after session created
   - Returns `{ success: true, checkoutUrl, paymentOrderId }`
   - If Stripe not configured: `{ success: false, errorCode: 'STRIPE_NOT_CONFIGURED' }`
2. Rewrote `POST /api/webhooks/stripe`:
   - Keeps HMAC-SHA256 signature verification (no SDK)
   - Replaces `fulfillOrder` (NestJS) with Prisma direct transaction
   - Idempotency: `updateMany(where: { status: PENDING })` — `count === 0` means already claimed
   - Transaction: PaymentOrder PENDING→PAID + wallet balance++ + `CreditLedger(type=PURCHASE)`
   - No NestJS dependency, no INTERNAL_API_SECRET
3. Added `systemGrantPurchasedCredits` to `lib/credits/server.ts`:
   - `CreditLedgerType.PURCHASE` (not ADMIN_ADJUSTMENT)
   - Atomic Prisma transaction
   - No admin role required (server-only webhook path)
4. Fixed `createCheckoutSession` URL bug: success_url `?` → `&` separator
5. Added `metadata[paymentOrderId]` + `metadata[credits]` to Stripe session

**Env vars required**:
- `STRIPE_ENABLED=true`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `APP_URL=https://creator-city-vert.vercel.app`

**No changes**: generate routes, cn-executor, canvas route, DB schema, package.json.

**Test card**: `4242 4242 4242 4242`, any future date/CVV. Full guide: `docs/STRIPE_CHECKOUT_TEST_MODE.md`.

### Phase 2C-lite — Package Display + Manual Grant Operations (2026-05-30)

**Context**: No real payment gateway yet. This phase builds the operational tooling for
the test period: admins can grant credits directly; users see the package tiers.

**Added**:

`GET /api/credits/packages` — updated to return `success: true` envelope, `label`,
`status: 'soon'`, `priceUsd`, `bonusCredits` per package. First 5 packages returned:
Starter 500 ($6.99) / Creator 1500 ($14.99) / Studio 5500 ($49.99) /
Team 15000 ($129.99) / Enterprise 50000 ($399.99). Static config — no DB read.

`POST /api/admin/credits/grant` — enhanced with:
- **Mode C**: `targetUserEmail + amountCredits` — looks up user by email (DB unique
  index), then calls `adminDirectGrant()`. Returns `{ success, userId, creditsGranted,
  availableCredits }`.
- Stricter response envelope: `success: true/false` + `errorCode` on all paths.
- Range limit narrowed from 1–1,000,000 to 1–100,000 per grant.
- Auth unchanged: `user.role === 'ADMIN'` from session cookie.

`CreditPackagesPanel.tsx` — reusable client component. Fetches `/api/credits/packages`,
renders N cards (default 3). Each card shows name, total credits (base + bonus),
label, price, "Soon" badge. Loading skeleton shown while fetching.

`CreditInsufficientModal.tsx` — updated:
- Uses `CreditPackagesPanel` (was inline static cards).
- Shows credit gap: `requiredCredits − availableCredits` highlighted in red.
- Updated notice: "支付接入即将开放。当前测试期请联系管理员充值 credits."
- Button: "购买积分" (disabled + Soon) + "稍后再说" (close).

**Manual grant ops workflow (test period)**:
```bash
# Admin grants credits to a user by email
curl -X POST https://[domain]/api/admin/credits/grant \
  -H "Content-Type: application/json" \
  -H "Cookie: [admin session cookie]" \
  -d '{"targetUserEmail": "user@example.com", "amountCredits": 500, "note": "test grant"}'
# Response: { "success": true, "userId": "...", "creditsGranted": 500, "availableCredits": 500 }
```

After grant: user refreshes canvas, CreditBalanceBadge shows new balance, can generate.
CreditLedger records `type = ADMIN_ADJUSTMENT`, delta = +500.

**Not changed**: reserve/settle, generate routes, cn-executor, DB schema, env, packages.
**Not wired to user UI**: admin grant is a curl/ops endpoint only.

### Phase 2D — CN Manual Recharge UI (2026-05-30)

**Context**: Test period operational recharge path. Users can submit a transfer request from
the billing page; admins confirm and grant credits via the Admin Grant API.

**Added/Updated**:

`ManualRechargePanel.tsx` — Rewritten with:
- 4-step transfer instructions
- `orderId` confirmation box with one-click copy button (shown after purchase submitted)
- Payment method placeholders (WeChat/Alipay/Bank — no real account info in code)
- Package reference table (5 tiers: Starter/Creator/Studio/Team/Enterprise)
- Admin contact notice

`PaymentMethodSelector.tsx` — Updated for CN region:
- manual label: "转账充值" (was "人工充值"), subtitle: "联系管理员确认到账"
- alipay subtitle when unconfigured: "待商户配置"
- wechat subtitle when unconfigured: "开发中"
- CN region provider order: manual first (default selected)

`billing/page.tsx` — Added URL param reading on mount:
- `?region=CN&method=manual` → pre-selects CN region + manual payment method
- Default CN provider changed from `alipay` to `manual`

`CreditInsufficientModal.tsx` — Updated action buttons:
- "购买积分 Soon" (disabled) → "前往转账充值" (active, navigates to `/billing?region=CN&method=manual`)
- Notice text updated to describe transfer-based recharge

`docs/CN_MANUAL_RECHARGE_OPERATIONS.md` — Created. Full admin ops guide:
- User flow end-to-end
- Admin Grant API curl commands
- Package credit reference with RMB pricing guide
- SQL verification queries
- All UI entry points

**Not changed**: reserve/settle, generate routes, cn-executor, DB schema, env, Stripe, Alipay API.

---

## Phase Roadmap

| Phase | Content | Status |
|-------|---------|--------|
| 1.5 | Unified credit rules (shared-cost-rules.ts) | ✅ Done |
| 2A | Read-only wallet balance API + canvas badge | ✅ Done |
| 2B-lite | Insufficient credits modal (no real payment) | ✅ Done |
| 2C-lite | Package display + manual admin grant (test period ops) | ✅ Done |
| 2B | Stripe Checkout Test Mode (Prisma direct, no NestJS) | ✅ Done |
| 2C | Insufficient credits → auto open top-up modal | ✅ Done (via 2B-lite) |
| 2D | CN Manual Recharge UI (transfer + admin confirm flow) | ✅ Done |
| 2E | Text Agent (/api/agents/text) billing integration (5 cr/call) | Pending |
| 2F | ProviderCostLedger write on settle | Pending |
| 3A | Activate ProviderPricingRule DB (replace hardcoded rules) | Pending |
| 3B | Alipay recharge (CN users) | Pending |
| 3C | Provider budget circuit breaker (ProviderAccount) | Pending |
| 3D | New-user credits grant on registration | Pending |
| 4 | BYO Key mode (AES-GCM key storage, route injection) | Backlog |
| 5 | Monthly subscription (Stripe Subscription) | Backlog |
