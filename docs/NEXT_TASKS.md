# Creator City — Next Tasks

This file is the authoritative task queue. Read it at the start of every Agent session.
Update status here after each task completes.

## Task Queue

| ID | Title | Status | Priority | Mode | Scope | Blocked By | Validation | Notes |
|---|---|---|---|---|---|---|---|---|
| P1-4B-QA | Membership production QA | TODO | P0 | QA_ONLY | /pricing, /account/membership, /admin/membership, /api/auth/me, /api/me/membership, /api/me/membership/orders, /api/admin/membership/orders | Vercel deploy ready (commit 59b92cd) | Codex QA report: all criteria PASS | Verify no PaymentOrder/CreditLedger/wallet changes; test idempotency; test approve/reject |
| P1-4B-4 | Membership basic gating | TODO | P0 | AUDIT_ONLY first | Decide what features require membership; marketplace contact info, canvas access, selected platform features | P1-4B QA PASS | Audit report + task proposal with specific gates | Do NOT implement until user approves list of gates |
| P1-4C | BYOK-first generation UX polish | TODO | P1 | AUDIT_ONLY first | /account/providers, canvas provider selector, generate error messages, no-key states | P1-4B membership QA | Audit report | Improve BYOK prompts and no-credits/no-key error UI |
| P1-4D | Marketplace inquiry/contact mode | TODO | P1 | AUDIT_ONLY first | /marketplace, /assets/[id], creator contact flow, listing copy | Membership gating decision (P1-4B-4) | Audit report | Convert paid listing path into inquiry/contact; free license grant still works |
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
