# Creator City Project Memory

## Vision

Creator City 是 Web3.0 AI 导演工作台、AI 创作画布、创作者资产库、城市化社群和 Marketplace。目标是服务专业导演、创作者和大众创作者，提供导演级工作流、资产管理、协作、社群、授权合作和未来 Web3 身份。

## Long-term Direction

- Web3.0 creator city
- AI director workspace
- Canvas-based multimodal creation (image / video / text nodes)
- Asset library and provenance (sourceAssets, licensing intent)
- Creator passport / creator identity (/me, /me/[username])
- Marketplace for showcase, licensing intent, collaboration
- Future creator settlement and decentralized marketplace
- Future UGC agent marketplace
- Future local deployment and collaboration
- Future Web3 wallet / on-chain identity (not in first launch)

## First Launch Model

- 100 RMB/month membership subscription (manual review, no automatic payment)
- BYOK-first: users bring their own AI provider API keys
- Platform does not pay user AI provider costs in first launch
- Marketplace v1 = showcase + inquiry / authorization collaboration intent
- Ordinary user credit payment is disabled by default (`MARKETPLACE_CREDITS_PAYMENT_ENABLED=false`)
- Ordinary buyer refund request is disabled by default (`MARKETPLACE_REFUND_REQUEST_ENABLED=false`)
- Platform credit recharge CTA is hidden by default (`PLATFORM_CREDITS_RECHARGE_ENABLED=false`)
- Platform credit settlement and refund execution are implemented but `first_launch_disabled` / admin internal only

## Current Commercial Model

- Membership fee: ¥100 RMB/month, manual review by admin
- AI provider cost: paid by user directly through BYOK
- Marketplace transaction: not platform-settled in first launch (showcase + inquiry only)
- Credits system: retained for future / internal admin tools — not on ordinary-user launch path

## Architecture Principles

- `docs/CURRENT_STATUS.md` is the source of truth for current state
- Keep implemented marketplace settlement/refund code, but feature-gate it with env vars
- Do NOT delete P1-0/P1-1/P1-2 settlement/refund/ledger code — needed post-launch
- BYOK bypasses platform credits — no wallet deduction when user provides own API key
- Membership controls platform access/value
- BYOK controls AI API cost
- Admin actions must be explicit and never automatic
- Production data mutation requires explicit user authorization in every session
- Schema/payment/wallet/generate changes require explicit user authorization before proceeding
- Favor small, reversible, feature-flagged changes over large rewrites
- Idempotent DDL via `instrumentation.ts` startup block (not prisma migrate deploy)
- 90-second session cache with single JOIN — membership included in cached user object

## Current Strategic Priorities

1. P1-4B Membership: production QA (`QA_ONLY`)
2. P1-4B-4: Membership basic gating (what requires membership — `AUDIT_ONLY` first)
3. P1-4C: BYOK-first generation UX polish (`AUDIT_ONLY` first)
4. P1-4D: Marketplace inquiry/contact mode (`AUDIT_ONLY` first)
5. P1-4E: Unified launch QA (`QA_ONLY`)
6. P2-ADMIN: Admin operations hardening (post-launch)
7. P2-BILLING: Automatic membership payment (post-launch)
8. P2-WEB3: Web3 identity / on-chain (not first launch)

## Recent Milestones

| Task | Status | Commit |
|---|---|---|
| P1-4A — Launch Mode Feature Flags | VALIDATED / CLOSED | `dbe6906` |
| P1-4B-1 — Membership Schema Foundation | IMPLEMENTED | `d2f7fe8` |
| P1-4B-2 — Membership Service Layer | IMPLEMENTED | `15d0d5e` |
| P1-4B-3 — Membership API + UI | IMPLEMENTED | `59b92cd` |
| Agent Loop Foundation | IMPLEMENTED | see CURRENT_STATUS.md |

## Key Files

| Purpose | Path |
|---|---|
| Source of truth | `docs/CURRENT_STATUS.md` |
| Agent boundaries | `docs/BOUNDARIES.md` |
| Task queue | `docs/NEXT_TASKS.md` |
| Agent loop protocol | `docs/AGENT_LOOP.md` |
| QA runbooks | `docs/QA_RUNBOOK.md` |
| Agent modes | `docs/AGENT_MODES.md` |
| Report template | `docs/AGENT_REPORT_TEMPLATE.md` |
| Loop check script | `scripts/agent-loop-check.mjs` |
| Stable baseline rules | `docs/CREATOR_CITY_STABLE_BASELINE.md` |
| P0 boundary lock | `docs/P0_BOUNDARY_LOCK.md` |
