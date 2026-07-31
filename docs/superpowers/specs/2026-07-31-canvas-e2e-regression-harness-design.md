# Canvas E2E Regression Harness Design

## Goal

Create a repeatable Canvas release-regression harness that verifies safe
authentication boundaries, Canvas loading, node/tool interaction, save/reload,
and console/network boundaries without treating a Founder project, production
credentials, a Provider call, or a payment flow as a test fixture.

## Audit Findings

- `@playwright/test` is already installed in `apps/web`; no dependency change is
  required.
- There is no dedicated Playwright configuration or web test command.
- Running Playwright's default discovery scans `src/**/*.test.ts` Node test files
  as though they were browser tests, which is not a valid E2E entry point.
- The only existing browser spec uses optional email/password environment
  variables, opens the default production Canvas, can click asset recovery, and
  drags a real media node. It is unsuitable as a default commercial regression
  test because it can mutate a non-isolated project.

## Options Considered

### Option A: Dedicated Two-Tier Playwright Harness (Chosen)

Add a dedicated Canvas Playwright config with a test directory that cannot
discover Node unit tests. Provide two tiers:

1. **Default read-only preflight:** validates public auth boundaries and does
   not need credentials, a project, or database writes.
2. **Opt-in authenticated Preview suite:** requires an externally supplied
   browser storage-state file, an explicit isolated Preview project ID, and a
   safety acknowledgement. It may perform the minimum save/reload checks only
   on that declared fixture and records console/network evidence.

The authenticated suite skips, rather than guesses or logs in, when any required
fixture is absent. It has no Provider, generation, billing, credits, wallet, or
payment action.

### Option B: Put Credentials in Repository Test Configuration

Rejected. Credentials and cookies must not be stored in the repository or
automatically supplied to browser tests.

### Option C: Run Existing Production Drag Test as the Release Gate

Rejected. It can mutate an unspecified user project and has no isolation or
network/console contract.

## Design

### Test Isolation

Create a dedicated `apps/web/tests/e2e/` test tree and a dedicated config that
uses only that tree. Keep its output under an external temporary directory so
test artifacts cannot dirty the repository.

The config defaults to a local base URL because the repository has no stable
Preview URL. Production is never the implicit target. An explicit runtime value
is required to use any remote Preview URL.

### Authentication and Fixture Contract

The authenticated suite requires all three values from the external test runner:

- `PLAYWRIGHT_STORAGE_STATE`: path to a browser storage-state file outside Git;
- `PLAYWRIGHT_SAFE_PROJECT_ID`: ID of a dedicated disposable Preview project;
- `PLAYWRIGHT_ALLOW_SAFE_WRITES=1`: an explicit acknowledgement that the test
  may issue one Canvas save within that isolated fixture.

No email, password, cookie, token, API key, database URL, or secret is read from
repository files or printed by the test.

The suite must fail closed by skipping before navigation when this contract is
not fully present. It must reject a production base URL for the write-enabled
suite.

### Coverage

The default preflight covers:

- protected Canvas route redirects to login when unauthenticated;
- no request to a generation, Provider, billing, credits, wallet, payment, or
  recharge mutation endpoint is initiated by that page load;
- no uncaught browser error occurs during the auth-boundary navigation.

The opt-in Preview suite covers:

- authenticated Canvas load for the explicit project;
- node selection and NodeToolCenter/AssetAgentToolbar opening without a Provider
  or generation action;
- a single explicit cloud-save/reload check in the isolated fixture;
- page-console errors and network requests classified into product failures or
  harness/environment limitations;
- no automatic generation, Provider, billing, credits, wallet, payment, or
  recharge mutation request.

No E2E test uploads files, creates assets, invokes a tool that writes assets,
uses a Provider, purchases credits, or creates a payment.

### Network and Console Evidence

The harness records only endpoint paths, HTTP methods, response status, and
sanitized error categories. It never records request bodies, authorization
headers, cookies, response payloads, email addresses, project IDs, tokens, or
secrets.

Forbidden endpoints are checked by normalized path prefix. A browser failure is
reported as a harness or environment limitation unless the page shows a product
error, 5xx response, or contract violation.

### Backward Compatibility

The legacy `p0-create-media-and-drag.spec.ts` is moved out of the default
release command and marked as a manual, non-gate experiment until it can be
reworked around an isolated fixture. It is not deleted by this task.

## File Scope

- Create `apps/web/playwright.canvas.config.ts`.
- Create shared safe-harness helpers below `apps/web/tests/e2e/support/`.
- Create default and authenticated E2E specs below `apps/web/tests/e2e/`.
- Modify `apps/web/tests/p0-create-media-and-drag.spec.ts` only to make its
  manual/non-gate status explicit if required by the dedicated config.
- Add static safety tests under `scripts/` to ensure the config stays isolated
  and the authenticated suite continues to reject production writes.

## Out of Scope

- No `package.json` or lockfile changes.
- No production, Preview, or local environment configuration changes.
- No account creation, credential handling, cookie inspection, Provider,
  generation, payment, billing, credit, wallet, asset upload, or database work.
- No Canvas product behavior, schema, API, Provider/BYOK, cn-executor, or
  production deployment changes.

## Acceptance Criteria

- A dedicated Playwright command discovers only E2E specs, never Node unit
  tests.
- Default preflight runs without credentials and performs no write action.
- Authenticated write-capable coverage cannot start without every explicit
  Preview-only fixture condition and rejects production URLs.
- Network and console assertions detect forbidden automatic activity while
  keeping secrets out of output.
- Existing unit-test execution remains unchanged.
