# No-Credits Administrator Creation Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent UI work and local execution for authorization and persistence. Preserve unrelated working changes; no commit or deployment without authorization.

**Goal:** Remove City credit prerequisites and restore server-configured creation for administrators without opening paid generation to the public.

**Architecture:** Keep existing provider adapters and asynchronous jobs. Replace new-request billing eligibility with administrator authorization; old job reconciliation stays separate. Keep historical tables. Reuse the existing UI and remove only credit-specific controls.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Node test runner, React, existing provider adapters.

## Tasks

- [x] 1. Authorization and billing compatibility. Test `setupBilling` with authenticated active ADMIN, missing user, inactive admin, non-admin and unavailable identity. Assert no wallet/reserve/settle calls for new requests. Return existing context shape with `billingJobId: null, estimatedCredits: 0`; finalization must preserve old explicit job IDs. Add a reusable generation guard and cover old unguarded generation entry points before provider dispatch. Preserve executor service authentication.
- [x] 2. Retirement of new credit operations. Disable new recharge/orders/grants/freezes at their authoritative mutation functions/endpoints; preserve old callbacks and explicit old-job reconciliation. Add tests for zero mutations on disabled entry points. Keep unrelated real-money membership/marketplace operations.
- [x] 3. UI retirement. Remove balance/recharge navigation, credit price badges and credit prerequisite text; default administrator creation to server-managed provider configuration. Preserve BYOK ownership and input, node geometry, menus and director layout. Test rendering and source boundaries and rerun experience checks.
- [x] 4. Usage integrity. New model calls record zero charged credits and preserve provider cost estimates and actual response usage where available. Tests must distinguish provider quota errors from local access errors. New asynchronous jobs must still exist without reserved credits; verify polling/persistence code paths.
- [ ] 5. Provider restoration. Audit effective configuration, Kimi transport failures, OpenAI image adapter compatibility and supported selectors. Use configured model names, no silent replacement. Mock network tests prove request shape only; record deployed live tests separately. Do not buy credits or expose secrets.
- [x] 6. Local verification. Run focused Node tests with `apps/web/node_modules/.bin/tsx --test`, `pnpm experience:check`, `pnpm test:experience-locks`, `pnpm --filter web type-check`, and `pnpm --filter web build`. Verify local UI with Playwright, and retain an evidence report identifying live provider/deployment blockers. Review both spec compliance and code quality before delivery.

## Test Pattern

Use the repo's `Module._load` stubbing pattern only for identity/database/network boundaries and execute real route/helper code. Example invariant:

```ts
const result = await setupBilling(null, 'openai-image', 'image', 'test')
assert.equal(result.ok, true)
if (result.ok) assert.deepEqual(result.ctx, { userId: 'admin', billingJobId: null, estimatedCredits: 0 })
assert.equal(walletCalls, 0)
assert.equal(providerCalls, 0)
```

Run the new test before editing production code and retain the failing result. Repeat for route-level access and credit retirement tests. Do not change tests merely to accept unexpected behavior.

## Release Boundary

The approved spec is `docs/superpowers/specs/2026-09-14-admin-no-credits-provider-restoration-design.md`. Its review was approved by the user's latest confirmation. Existing spatial work is not part of a provider-only release. Real provider samples require deployed/local server credentials and are never inferred from mocked tests or env presence. Retiring City credits does not remove third-party API charges.

## Current Acceptance Boundary

Local implementation, focused tests, responsive UI fixtures and isolated production builds have passed. Task 5 remains open for live configured-provider validation after an authorized Preview deployment. No keys were copied, no paid provider requests made, no historical balances or assets reset, and no commits or deployments made during this implementation. See docs/research/2026-09-14-no-credits-local-acceptance.md for evidence and remaining release checks.
