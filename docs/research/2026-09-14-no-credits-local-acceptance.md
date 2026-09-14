# No-Credits Creation: Local Acceptance

Date: 2026-09-14
Branch: codex/seedance-spatial-previs-p0
Status: Release-only source verified; Preview deployment authorized. Live provider acceptance remains pending.

## Implemented

- Active ADMIN generation uses fresh session authority, not cached UI identity. Login/session caching itself is unchanged. Session outages block paid dispatch without clearing accounts or assets.
- New generation no longer reads/reserves/deducts City credits. Credit recharge, issuance and freeze operations are retired server-side, including legacy Nest endpoints. Historical records and reconciliation remain intact.
- Ordinary service-order payment retains its former opt-in policy. Marketplace, membership and their historical obligations were not redesigned.
- Creation defaults to the existing platform API source; BYOK remains optional and ownership checked. Credit badges, recharge prerequisites and purchase controls are removed. Account history stays read-only.
- Image/video/audio/music job ownership and tracking are independent of billing. Verified terminal polling persists completion conditionally; polling transport failures cannot refund arbitrary caller-supplied jobs.
- GPT Image dimensions match its model family; response-body timeouts remain bounded. OpenAI quota and rate limiting stay distinct. Kimi text/multimodal routes use configured models and sanitized transport diagnostics. Disabled providers stay disabled.
- Uploaded image URLs survive asset-link failures; retry/readiness states agree across responses, metadata and stored output. No automatic paid redispatch was added.

## Verification

All following checks were executed locally, not inferred from configuration:

| Check | Result |
| --- | --- |
| Core credit/access/image/text/provider tests | 109 passed |
| Expanded paid-dispatch and access inventory | 33 passed; overlaps access cases in the core group |
| Independent generation ownership | 19 passed |
| Owned polling and historical association | 25 passed |
| Legacy Nest credit retirement | 1 passed |
| Credit-retirement UI suite | 22 passed, including 11 Chromium-rendered scenarios |
| Existing canvas/dialog/resize/menu regressions | 36 passed |
| Existing OpenAI/Volcengine/provider-key regressions | 37 passed |
| Experience lock verifier tests | 14 passed |
| Confirmed experience registry | 7 locks passed |
| Web and server TypeScript | Passed without diagnostics |
| Production build | Passed in an isolated source copy; existing lint warnings remain |

Fresh TDD failures were reproduced before fixes for zero-balance access, credit mutations, specialized public dispatch, provider configuration and dimensions, image persistence, and job tracking. These use real handlers with mocked identity/database/provider boundaries; they are not live PostgreSQL concurrency or live provider-cost proofs.

The bracketed polling test path must run directly because this Node/tsx test glob discovery otherwise skips it:

    cd apps/web
    node_modules/.bin/tsx 'src/app/api/generate/jobs/[id]/route.test.ts'
    node_modules/.bin/tsx --test src/lib/generation/owned-generation.test.ts

## Browser Evidence

- Actual built login page rendered without browser exceptions. Five unauthenticated generation/assistant HTTP calls returned 401 before dispatch.
- Built account-history pages at 390px and 1440px rendered without exceptions, overflow or mutation requests. These used explicitly synthetic account/history responses, not customer data or real credentials.
- Screenshots: .superpowers/qa/no-credits/history-390.png and history-1440.png; reproducible UI script and JSON results are in the same directory.
- An existing development instance sharing .next with a build returned cache/runtime errors. Isolated production builds and their login/history checks succeeded without editing authentication pages. Build tests did not use remote database credentials.
- The existing development instance was subsequently reloaded through its config watcher without changing file contents or credentials. Its login page returned HTTP 200 with no browser errors, and both responsive history checks passed again at http://localhost:65490. Final application source matches the isolated build copy; environment examples were intentionally excluded.

## Still Required Before Final Acceptance

1. Complete the authorized Preview-only release containing only this scope; exclude existing unrelated spatial reconstruction edits.
2. Preserve pre-existing credit-backed jobs/orders and reconciliation; do not reset balances. The existing live administrator page showed zero pending manual recharge requests before release. This is not an exhaustive database audit of all historical jobs/payment orders.
3. Reuse current Vercel and Aliyun configurations without copying keys into chat or browser code. Test short DeepSeek/Kimi/OpenAI text outputs on the real canvas, then the requested single GPT scene-reference image and asset reopen.
4. Diagnose any remaining Kimi connection failure from the newly surfaced transport code in the actual runtime. A mocked pass does not establish live connectivity.
5. Verify Seedance/Seedream executor readiness in their configured runtime; do not silently enable disabled models or remove existing video feature flags. Paid video requires its separate approved test scope.

The earlier GPT image rejection was a local City credit prerequisite. This implementation removes it; it does not establish that OpenAI API quota is available. ChatGPT subscription billing and provider API billing remain separate. No top-up or paid sample was performed by these tests.

## Release-Only Recheck

- Created an isolated copy from the Git index, excluding every uncommitted spatial reconstruction/lighting change and local environment files.
- Production build passed on that exact release source.
- Core release tests: 136 passed; owned polling tests: 25 passed; confirmed experience locks: 7 passed.
- Git remote branch was verified at 258c6413531f8d2548e8709bb82f9d7196849045 before push.
- Vercel connector and existing CLI token returned 403; the existing browser dashboard and platform administrator session remained accessible. No authentication settings were changed.
