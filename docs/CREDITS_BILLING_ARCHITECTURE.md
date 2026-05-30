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

---

## Phase Roadmap

| Phase | Content | Status |
|-------|---------|--------|
| 1.5 | Unified credit rules (shared-cost-rules.ts) | ✅ Done |
| 2A | Read-only wallet balance API + canvas badge | ✅ Done |
| 2B | Stripe Checkout (global) + credit package page | Pending |
| 2C | Insufficient credits → auto open top-up modal | Pending |
| 2D | Text Agent (/api/agents/text) billing integration (5 cr/call) | Pending |
| 2E | ProviderCostLedger write on settle | Pending |
| 3A | Activate ProviderPricingRule DB (replace hardcoded rules) | Pending |
| 3B | Alipay recharge (CN users) | Pending |
| 3C | Provider budget circuit breaker (ProviderAccount) | Pending |
| 3D | New-user credits grant on registration | Pending |
| 4 | BYO Key mode (AES-GCM key storage, route injection) | Backlog |
| 5 | Monthly subscription (Stripe Subscription) | Backlog |
