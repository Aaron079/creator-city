# Creator City Agent Boundaries

## Always Read First

Every Agent session MUST read in order:
1. `docs/CURRENT_STATUS.md`
2. `docs/PROJECT_MEMORY.md`
3. `docs/BOUNDARIES.md` (this file)
4. `docs/NEXT_TASKS.md`
5. `docs/AGENT_LOOP.md`
6. `docs/QA_RUNBOOK.md`

Do not proceed with any implementation, QA, or docs work until all six files are read.

## Source of Truth

`docs/CURRENT_STATUS.md` is the current project source of truth.
Do not expand old history unless explicitly requested.
Do not guess task status — read the file.

## Hard No Without Explicit User Approval

Do NOT touch the following without explicit user authorization in the current session:

**Schema & Data**
- Prisma schema (`apps/server/prisma/schema.prisma`)
- Migration files (`apps/server/prisma/migrations/`)
- `instrumentation.ts` DDL blocks (existing blocks)
- Any direct DB mutation in production

**Payment & Billing**
- Payment / billing logic (`lib/billing/`, `/api/credits/`, `/api/payment/`)
- Wallet / ledger logic (`UserCreditWallet`, `CreditLedger`)
- Marketplace settlement / refund execution (`lib/marketplace/settle.ts`, `lib/marketplace/refund.ts`)
- Membership payment semantics (`lib/membership/server.ts` — existing function logic)

**AI Generation Chain**
- Generate routes (`/api/generate/image/`, `/api/generate/video/`, `/api/generate/text/`)
- Provider adapter real call logic (`lib/provider/`, provider-accounts service call path)
- `apps/cn-executor/` (any file)

**Infrastructure**
- Env files (`.env`, `.env.local`, `.env.production`, `vercel.json` env)
- Package dependencies (`package.json` — adding new deps)
- Deployment pipeline (`scripts/deploy-cn-executor.sh`, Vercel config)

**Production Operations**
- Git push / deploy (without explicit user request)
- Production data mutation (DB writes against production)
- Sending emails / notifications to real users
- Real payment / refund execution

## First Launch Disabled Areas

The following must NOT be enabled for ordinary users without explicit product decision:
- Marketplace credit payment (`MARKETPLACE_CREDITS_PAYMENT_ENABLED`)
- Buyer refund request (`MARKETPLACE_REFUND_REQUEST_ENABLED`)
- Platform-paid AI generation (platform covers API cost)
- Fiat automatic payment (Alipay / WeChat / Stripe webhook)
- Withdrawal / payout
- NFT / on-chain / wallet
- Platform settlement for marketplace transactions

Do not write code that enables these paths without user authorization.

## Safe Defaults

- Read-only first — audit before implementation
- Feature flag before irreversible change
- Admin-only for dangerous operations
- No production data mutation during QA unless explicitly authorized
- No high-value transaction tests
- Use 1-unit (1 credit / ¥0.01) test values if transaction test is explicitly authorized
- Prefer `process.exitCode = 1` over throwing for check scripts

## Required End-of-Task Report

Every task report MUST include (use `docs/AGENT_REPORT_TEMPLATE.md`):
- Files changed (name + purpose)
- Commands run (actual commands + summarized output)
- type-check / lint / build results
- Boundary confirmation (schema/payment/wallet/generate/env — each Yes/No)
- Commit hash if committed
- Push status
- Known risks
- Next recommended task

## Stop Conditions

Stop work and wait for user when ANY of the following is true:
- Task requires schema or migration changes
- Task touches payment / wallet / ledger logic
- Task touches production data mutation
- Credentials or env secrets are missing
- Test or build fails (do not push broken build)
- QA requires a second account that cannot be created safely
- Business decision is ambiguous (e.g., what membership gates)
- Commit / push / deploy confirmation is required
- Risk of real money, real credits, real refund, or real data change exists
- Task scope is unclear

## Never Do

- Infinite loop or background daemon process
- Autonomous deploy (push without user request)
- Autonomous production mutation
- Silent schema changes
- Hidden env variable additions
- Fake QA pass (never mark PASS without real evidence)
- Commit changes outside stated scope
- Modify files not listed in the task scope
- Remove existing feature-flag-disabled code paths (do not delete settlement/refund)
- Expand scope without asking user first
