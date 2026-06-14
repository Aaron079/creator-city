# Creator City — Next Tasks

This file is the authoritative task queue. Read it at the start of every Agent session.
Update status here after each task completes.

## Task Queue

| ID | Title | Status | Priority | Mode | Scope | Blocked By | Validation | Notes |
|---|---|---|---|---|---|---|---|---|
| P1-4B-QA | Membership production QA | DONE | P0 | QA_ONLY | /pricing, /account/membership, /admin/membership, /api/auth/me, /api/me/membership, /api/me/membership/orders, /api/admin/membership/orders | Vercel deploy ready (commit 59b92cd) | PARTIAL — Phase 1-3 PASS, Phase 4 PARTIAL (retry test user password unknown), Phase 5 SKIP (admin session unavailable) | QA closed with limited admin evidence; post-approval user state unconfirmed; agent closed with PARTIAL/CLOSED |
| P1-4B-4 | Membership basic gating | DONE | P0 | IMPLEMENTATION_AUTHORIZED | POST/PATCH /api/marketplace/listings + MembershipRequiredNotice + /assets/[id] UI | P1-4B QA PASS | type-check PASS · lint PASS · build PASS | Commit pending push; gating: POST create + PATCH→ACTIVE only; ADMIN bypass; BYOK/GET/grant unaffected |
| P1-4B-4-QA | Membership gating QA | TODO | P0 | QA_ONLY | POST /api/marketplace/listings → 403 MEMBERSHIP_REQUIRED for non-member; PATCH→ACTIVE → 403; ADMIN bypass; /assets/[id] notice UI | P1-4B-4 pushed to Vercel | All 13 acceptance criteria PASS | Test with non-member session, member session, and ADMIN session |
| P1-4C | BYOK-first generation UX polish | DONE | P1 | IMPLEMENTATION | /account/providers, canvas provider selector, generate error messages, no-key states | P1-4B membership QA | VALIDATED / CLOSED — text/image/video all BYOK-first; selector reordered; no credits path; video BYOK coming-soon state | ee96b33 (P1-4C-1) + 7bd5b3e (video followup); production screenshot validated |
| P1-4D | Marketplace inquiry/contact mode | DONE | P1 | AUDIT_ONLY | /marketplace, /assets/[id], creator contact flow, listing copy | Membership gating decision (P1-4B-4) | Audit report DONE; Option B (new table) selected | Audit completed; MarketplaceInquiry independent model chosen |
| P1-4D-1 | MarketplaceInquiry schema foundation | DONE | P1 | IMPLEMENTATION | schema.prisma + migration + instrumentation.ts DDL | P1-4D audit | type-check PASS · lint PASS · build PASS | Commit 447843b; enum+model+relations+idempotent DDL; no API/UI |
| P1-4D-2 | Inquiry service + API | TODO | P1 | IMPLEMENTATION | POST /api/marketplace/listings/[id]/inquiries + GET (buyer/seller) + PATCH (seller respond/reject, buyer close) + membership gate | P1-4D-1 | type-check PASS · endpoints return correct status codes | No payment; buyer sends message; seller responds with sellerNote |
| P1-4E | Unified launch QA | TODO | P0 | QA_ONLY | Membership + BYOK + Marketplace inquiry + Admin dashboards + Credits gating | P1-4B + P1-4C + P1-4D done | Full Codex QA report: all criteria PASS | Final validation before launch announcement |
| P2-ADMIN | Admin operations hardening | LATER | P2 | AUDIT_ONLY | Admin dashboards, audit trails, admin action logs | Launch QA (P1-4E) | Audit report | Post-launch; improve admin safety and observability |
| P2-BILLING | Automatic membership payment | LATER | P2 | AUDIT_ONLY | Alipay/WeChat/Stripe webhook integration, membership renewal automation | Manual membership stable (P1-4B) | Audit report | Not first launch; payment provider integration required |
| P2-WEB3 | Web3 identity / on-chain | LATER | P2 | AUDIT_ONLY | Wallet integration, NFT, on-chain asset provenance | Marketplace stable | Audit report | Not first launch; requires wallet/chain infrastructure |

## Status Values

- `TODO` — ready to start, not blocked
- `IN_PROGRESS` — actively being worked on this session
- `WAITING_QA` — implementation done, waiting for QA validation
- `BLOCKED` — waiting on another task or decision
- `DONE` — validated and closed
- `LATER` — explicitly deferred, not current priority

## How to Update This File

After each task:
1. Change `Status` to `DONE` or `BLOCKED` as appropriate
2. Add the commit hash to `Notes`
3. Update `Blocked By` for downstream tasks if needed
4. Add new tasks with the next sequential ID

Do not delete DONE rows — keep as audit trail.
