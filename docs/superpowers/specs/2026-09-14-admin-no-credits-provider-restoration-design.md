# Administrator Creation Without Credits and Provider Restoration

Date: 2026-09-14
Status: Approved by user; implementation and local verification in progress.

## Product Decision

The founder explicitly requested retirement of City credits, including future monetization dependence on credits. Before public launch, generation is for administrators. Restore previously integrated models by reusing existing authorized provider configurations. Do not introduce a replacement charging system.

This supersedes the proposed OpenAI-only administrator text-ping change. GPT images means generating scene reference images for later whitebox testing, not automatic image understanding.

## Approach

Retire active credit consumption and sales while preserving historical records. Replace credit eligibility with authenticated administrator generation authorization. This is preferable to granting unlimited credits (keeps the rejected product rule) or deleting wallet/ledger tables (unnecessary data loss and migration risk).

Confirmed experience impact: none for the seven registered geometry, resize, drag and context-menu locks. The founder explicitly authorized removing credit amounts, credit purchase controls and credit-dependent generation controls. Do not redesign the remaining canvas or director tools.

## Work Package 1: Retire Credits

- Administrator requests must generate with a zero City balance. No balance lookup, reserve, freeze, deduction or refund for new generation requests.
- Use the existing authenticated server-side identity. Anonymous, non-admin and inactive users must not access platform-funded generation. Do not promote users, change passwords, recreate accounts or weaken login protections.
- Guard all active platform-funded generation entry points, including legacy aliases, assistants, specialized generation and retry routes; do not assume every route calls setupBilling. Internal executor callbacks retain service authentication rather than browser-session requirements.
- Keep provider credentials server-side. Preserve existing BYOK account ownership validation; no credential copying into user accounts.
- Keep job creation and asynchronous job IDs independent of credit reservation so status polling, cancellation, output persistence and asset ownership continue to work.
- Remove credit balances, price badges, recharge links and credit mode labels from the creation flow and account navigation. Name the server-managed source as a platform API configuration, not platform credits. Keep BYOK as an optional credential source where already supported.
- Default the administrator creation flow to existing server-managed model configurations; do not require reentering keys.
- Retire new credit purchase/order/grant/freeze operations at the server, not just their UI. Retain administrator read-only historical access. Preserve unrelated membership, marketplace and real-money payment features.
- Inspect outstanding credit-backed jobs and payment orders before deployment. Preserve reconciliation for pre-existing obligations; do not automatically delete, refund, charge or reset historical balances.
- Keep usage records, provider-paid-by attribution, actual available provider usage and cost evidence. Do not write fictitious charged credits or label estimated costs as actual invoices.
- Legacy stored billing identifiers may remain for backward compatibility but must not activate credit behavior. Prefer no database migration and no table deletion.
- Distinguish access denied, missing configuration, provider authentication, provider balance/quota, rate limits, network errors and storage failures. Do not present a City failure as an OpenAI balance failure or recommend a text-only model for image generation.
- Preserve timeouts, cancellation and duplicate-submit protection. Retiring credits does not authorize unlimited automatic retries or bulk paid generation.

## Work Package 2: Restore Existing Providers

The previously inspected Preview management UI has configured entries for:

| Integration | Evidence before this change | Required check |
| --- | --- | --- |
| OpenAI Text | Key/network probe passed; canvas blocked on City balance | Actual short text result, using configured model |
| OpenAI Image | Canvas blocked on City balance before provider dispatch | One requested scene reference image, persistent asset and reopen |
| DeepSeek text | Lightweight response OK | Actual canvas text result |
| DeepSeek reasoning | Configuration present | Short bounded result; reasoning alone is not final output |
| Kimi text | Lightweight test returned fetch failed | Diagnose effective endpoint and runtime network, then retest |
| Kimi multimodal | Configuration present | Configuration and short text smoke check, not a vision claim |
| Seedance video | Configuration present | Preserve regional executor routing and inspect readiness; paid clip only within explicit test authorization |
| Seedream image | Configuration present | Preserve regional executor routing; bounded image check |

Configured is not the same as verified usable. Read model IDs and endpoints from current server configuration without exposing keys. Do not upgrade model versions or switch providers silently. Other catalog entries lacking configuration (for example Kling, Jimeng, fal, Replicate or OpenRouter in the inspected Preview) are not evidence of a previously working integration. Compare available deployment/account metadata; explicitly report missing credentials instead of inventing or replacing them.

Vercel application keys and Aliyun executor keys are separate execution contexts. Diagnose failures in the context that actually dispatched the request. No cross-account migration and no unrelated storage configuration changes.

## Verification

1. Red-green tests: zero-balance ADMIN succeeds without wallet/ledger mutation; unauthorized/non-admin requests cause zero model calls; public legacy aliases cannot bypass the guard.
2. Route integration tests: new jobs, polling, cancellation, retry and result persistence remain functional without a billing job; provider errors remain accurately attributed.
3. Credit retirement tests: new issuance/purchase/reserve endpoints cannot mutate balances; historical read access and existing obligation handling are preserved.
4. Provider tests: correct configured endpoint/model, no secret leakage, bounded timeout and no automatic billable retry.
5. Canvas tests: no visible credit amounts, no recharge prerequisite, usable model picker and credential selection; existing locked interactions remain unchanged.
6. Run focused regression suites, experience checks, TypeScript and production build. Scope any discovered pre-existing failures explicitly.
7. After authorized Preview deployment, exercise the actual canvas, inspect generated outputs, verify asset persistence after reopening and record each model as passed, failed or blocked. Do not use mocks or a separate ChatGPT image tool as evidence that City generation works.

## Delivery and Boundaries

- Preserve existing uncommitted spatial reconstruction work and all historical customer assets.
- No production deployment, model-account purchase, top-up or new credential creation without explicit authorization.
- Do not bundle unrelated local changes into a provider restoration deployment.
- New public access rules and future non-credit monetization are separate launch decisions.
- Final acceptance must separate locally verified behavior, deployed behavior and provider-dependent blockers. Cancellation of City credits does not remove OpenAI or other provider API charges.
