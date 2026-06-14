# Creator City QA Runbook

## General QA Rules

- Do NOT mutate production data unless the test scope explicitly allows it
- Use low-risk test data (fake email, voucherNote clearly marked as test)
- Do NOT perform high-value payment / refund operations
- Do NOT modify code during QA — mode is `QA_ONLY`
- Record URL, HTTP status, response body summary, and side-effect checks for every criterion
- Mark each criterion PASS / FAIL / SKIP with evidence
- A SKIP must be explained (e.g., requires second account, requires admin credentials)
- Never mark PASS without real observed evidence

## Production Base URL

```
https://creator-city-vert.vercel.app
```

---

## P1-4A — Launch Mode Feature Flags QA

**Goal:** Verify credit payment, refund, and recharge are disabled for ordinary users.

| # | Criterion | API / URL | Expected |
|---|---|---|---|
| 1 | Paid Marketplace order POST returns gate error | `POST /api/marketplace/listings/[id]/orders` (priceCredits>0) | HTTP 503, errorCode FEATURE_DISABLED |
| 2 | action=pay returns gate error | `PATCH /api/me/marketplace-orders/[id]` `{action:"pay"}` | HTTP 503, errorCode FEATURE_DISABLED |
| 3 | Buyer refund request POST returns gate error | `POST /api/me/marketplace-orders/[id]/refund-request` | HTTP 503, errorCode FEATURE_DISABLED |
| 4 | Paid listing UI says authorization cooperation / inquiry | `/marketplace` | No purchase button; shows 授权合作 / 申请 copy |
| 5 | No payment button in QUOTED state | `/assets/[id]` buyer QUOTED | 去支付 button absent |
| 6 | /account/credits hides recharge CTA | `/account/credits` | No 支付宝充值 / 申请充值 form visible |
| 7 | /account/providers BYOK entry visible | `/account/providers` | Providers page loads |
| 8 | Admin marketplace accessible | `/admin/marketplace` | Admin can see orders and refund requests |

---

## P1-4B — Membership QA

**Goal:** Verify full membership lifecycle: submit → admin approve → active → no wallet side effects.

### Setup

Test user: `codex-qa-membership-20260614@example.com` (password: `QAtest1234!`)
Test voucherNote: `"Codex QA membership test — no real money transferred"`
Admin account: `duongong429@gmail.com` (admin approves via browser at `/admin/membership`)

### Buyer Flow

| # | Criterion | Method | Expected |
|---|---|---|---|
| 1 | /pricing loads with required content | `GET /pricing` | HTTP 200; ¥100/月; BYOK disclaimer; CTA to /account/membership and /account/providers |
| 2 | /account/membership loads (redirects to login if not auth'd) | `GET /account/membership` | HTTP 200 after login |
| 3 | Initial membership state is INACTIVE | `GET /api/auth/me` | `membershipActive:false`, `membershipStatus:"INACTIVE"` |
| 4 | /api/me/membership returns correct plan info | `GET /api/me/membership` | `plan.amountCny:10000`, `plan.periodMonths:1`, `daysRemaining:0` |
| 5 | User can submit membership order | `POST /api/me/membership/orders` `{voucherNote:"..."}` | HTTP 200, `status:"PENDING"`, `amountCny:10000` |
| 6 | Duplicate submit returns same order (idempotent) | `POST /api/me/membership/orders` again | HTTP 200, same order ID as #5 |
| 7 | User can update voucherNote for PENDING order | `PATCH /api/me/membership/orders/[id]` `{voucherNote:"updated"}` | HTTP 200, voucherNote updated |
| 8 | Orders list shows PENDING order | `GET /api/me/membership/orders` | Array with 1 order, status PENDING |
| 9 | Admin endpoint blocked for non-admin | `GET /api/admin/membership/orders` (non-admin session) | HTTP 403, ADMIN_REQUIRED |

### Admin Flow

| # | Criterion | Method | Expected |
|---|---|---|---|
| 10 | /admin/membership loads (admin only) | Browser: `/admin/membership` as admin | PENDING order visible with user email and voucherNote |
| 11 | Admin can approve order (requires adminNote + window.confirm) | Browser: click 审批通过, confirm dialog | Order disappears from PENDING list |
| 12 | Admin approve endpoint (API) | `POST /api/admin/membership/orders/[id]/approve` `{adminNote:"QA test"}` | HTTP 200, order.status APPROVED, membership.status ACTIVE |

### Post-Approval

| # | Criterion | Method | Expected |
|---|---|---|---|
| 13 | /api/auth/me shows membershipActive=true | `GET /api/auth/me` | `membershipActive:true`, `membershipStatus:"ACTIVE"`, `membershipExpiresAt` set |
| 14 | /api/me/membership shows ACTIVE | `GET /api/me/membership` | `membershipActive:true`, `daysRemaining > 0` |
| 15 | Approve is idempotent | `POST /api/admin/membership/orders/[id]/approve` again | HTTP 200, no double-stacking of expiry |

### Side-Effect Checks

| # | Criterion | Method | Expected |
|---|---|---|---|
| 16 | No PaymentOrder created | Check DB or admin billing | No new PaymentOrder for this user |
| 17 | No CreditLedger entry written | Check /account/credits ledger | No new ledger entries from membership approval |
| 18 | Wallet balance unchanged | `GET /api/credits/balance` | Same balance before and after approval |
| 19 | No automatic fiat payment attempted | No payment gateway log | No outbound payment call |

### Reject Flow

| # | Criterion | Method | Expected |
|---|---|---|---|
| 20 | Reject requires adminNote | `POST /api/admin/membership/orders/[id]/reject` `{}` | HTTP 400 or validation error |
| 21 | Reject does not change UserMembership | `POST /api/admin/membership/orders/[id]/reject` `{adminNote:"QA reject test"}` | HTTP 200, order REJECTED, membershipActive still false |

---

## BYOK QA

**Goal:** Verify BYOK provider setup and generation works without platform credit deduction.

| # | Criterion | Method | Expected |
|---|---|---|---|
| 1 | /account/providers loads | `GET /account/providers` | Providers page, no 404 |
| 2 | User can add a provider account | Browser: add provider | Provider appears in list |
| 3 | API Key field copy says vendor console key | UI copy check | "复制 API Key 粘贴到这里" or similar, not login password |
| 4 | Text generation works with valid BYOK key | Canvas: add text node, generate | Response received, no INSUFFICIENT_CREDITS error |
| 5 | BYOK path does not charge platform credits | Check /account/credits ledger | No deduction for BYOK generation |
| 6 | Missing key errors guide to /account/providers | Canvas: generate with no key | Error message links to /account/providers |
| 7 | API key is never logged | Check server logs | No API key value in logs |

---

## Marketplace Inquiry QA

**Goal:** Verify marketplace is showcase + authorization cooperation, no payment path.

| # | Criterion | Method | Expected |
|---|---|---|---|
| 1 | /marketplace shows listings | `GET /marketplace` | Listings visible |
| 2 | Paid listing does not show purchase/payment button | Paid listing UI | No 立即支付 / 支付 button |
| 3 | Buyer sees cooperation/inquiry copy | Paid listing UI | 申请授权合作 or similar |
| 4 | Free license grant still works | `POST /api/marketplace/listings/[id]/grant` (free) | HTTP 200, LicenseGrant created |
| 5 | Admin marketplace remains admin-only | `/admin/marketplace` non-admin | HTTP 403 or redirect |

---

## Unified Launch QA (P1-4E)

Run after P1-4B + P1-4C + P1-4D are all done.

1. Register or login as new user
2. Submit membership order
3. Admin approve membership
4. Confirm `membershipActive:true` via `/api/auth/me`
5. Add BYOK provider (DeepSeek or Volcengine)
6. Run BYOK text generation — confirm no credit deduction
7. Visit `/marketplace` — confirm showcase + inquiry mode
8. Submit or view cooperation intent on a listing
9. Confirm no credit payment path is accessible
10. Confirm `/admin/membership`, `/admin/marketplace`, `/admin/payments/china` all accessible to admin
11. Confirm `/account/credits` hides recharge CTA
12. Confirm `/account/providers` BYOK entry is visible

---

## QA Report Format

For each run, output a table:

```
| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | ... | PASS | HTTP 200, body: {...} |
| 2 | ... | FAIL | HTTP 500, body: {...} |
| 3 | ... | SKIP | Requires admin credentials |
```

Followed by:
- **Overall**: PASS / FAIL / PARTIAL
- **Blocking issues**: list FAIL items
- **Skipped**: list SKIP items with reason
- **Side effects confirmed safe**: Yes / No with evidence
- **Next recommended task**: state explicitly
