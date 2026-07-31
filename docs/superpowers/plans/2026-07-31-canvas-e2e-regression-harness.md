# Canvas E2E Regression Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated Playwright entry point that safely validates Canvas authentication, Console/network boundaries, and opt-in Preview-only Canvas recovery checks.

**Architecture:** A dedicated Playwright config only discovers `apps/web/tests/e2e/**/*.spec.ts`, so Node unit tests cannot be executed as browser tests. Shared helper functions normalize allowed local/Preview URLs, classify sensitive endpoint activity without request bodies, and require a complete Preview fixture contract before any test can click the cloud-save control.

**Tech Stack:** Playwright, TypeScript, Node built-in test runner, pnpm.

---

## File Structure

- Create: `apps/web/playwright.canvas.config.ts` -- dedicated E2E discovery, local-safe default URL, external temporary output location.
- Create: `apps/web/tests/e2e/support/canvas-e2e-safety.ts` -- base URL, Preview fixture, endpoint, console, and error safety helpers.
- Create: `apps/web/tests/e2e/auth-boundary.spec.ts` -- default credential-free preflight.
- Create: `apps/web/tests/e2e/canvas-safe-preview.spec.ts` -- opt-in authenticated Preview fixture check.
- Create: `apps/web/tests/e2e/support/canvas-e2e-safety.test.ts` -- pure helper tests.
- Create: `scripts/canvas-e2e-harness-static.test.mjs` -- contract checks for discovery and fail-closed write gating.
- Modify: `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` only after local verification and deployment evidence.

### Task 1: Define Fail-Closed E2E Safety Contracts

**Files:**
- Create: `apps/web/tests/e2e/support/canvas-e2e-safety.test.ts`
- Create: `apps/web/tests/e2e/support/canvas-e2e-safety.ts`

- [ ] **Step 1: Write failing pure tests**

Create tests that import `getCanvasE2EBaseUrl`, `getSafePreviewFixture`,
`findForbiddenMutationRequests`, and `isProductionCanvasUrl`. Cover:

```ts
assert.equal(getCanvasE2EBaseUrl({}).origin, 'http://127.0.0.1:3000')
assert.equal(isProductionCanvasUrl('https://creator-city-vert.vercel.app'), true)
assert.equal(getSafePreviewFixture({}).ready, false)
assert.equal(
  getSafePreviewFixture({
    PLAYWRIGHT_BASE_URL: 'https://preview.example.vercel.app',
    PLAYWRIGHT_STORAGE_STATE: '/tmp/state.json',
    PLAYWRIGHT_SAFE_PROJECT_ID: 'safe-project',
    PLAYWRIGHT_ALLOW_SAFE_WRITES: '1',
  }).ready,
  false,
)
assert.deepEqual(
  findForbiddenMutationRequests([
    { method: 'POST', pathname: '/api/generate/image' },
    { method: 'GET', pathname: '/api/generate/image/status' },
  ]),
  [{ method: 'POST', pathname: '/api/generate/image' }],
)
```

The Preview fixture test remains false until
`PLAYWRIGHT_SAFE_ENV: 'preview'` is added. Include a final complete-fixture test
that returns `ready: true`.

- [ ] **Step 2: Run the focused helper test and record RED**

Run:

```bash
pnpm --filter web exec tsx --test tests/e2e/support/canvas-e2e-safety.test.ts
```

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the minimal safety helper**

Create `canvas-e2e-safety.ts` with:

```ts
export const DEFAULT_CANVAS_E2E_BASE_URL = 'http://127.0.0.1:3000'

export type E2EEnvironment = Record<string, string | undefined>
export type RequestEvidence = { method: string; pathname: string }

const forbiddenMutationPrefixes = [
  '/api/generate/',
  '/api/payment/',
  '/api/billing/',
  '/api/credits/',
  '/api/wallet/',
  '/api/recharge/',
  '/api/checkout',
]

export function getCanvasE2EBaseUrl(env: E2EEnvironment): URL {
  return new URL(env.PLAYWRIGHT_BASE_URL ?? DEFAULT_CANVAS_E2E_BASE_URL)
}

export function isProductionCanvasUrl(value: string | URL): boolean {
  return new URL(value).hostname === 'creator-city-vert.vercel.app'
}

export function getSafePreviewFixture(env: E2EEnvironment) {
  const baseUrl = getCanvasE2EBaseUrl(env)
  const missing = [
    env.PLAYWRIGHT_SAFE_ENV !== 'preview' && 'PLAYWRIGHT_SAFE_ENV=preview',
    !env.PLAYWRIGHT_STORAGE_STATE && 'PLAYWRIGHT_STORAGE_STATE',
    !env.PLAYWRIGHT_SAFE_PROJECT_ID && 'PLAYWRIGHT_SAFE_PROJECT_ID',
    env.PLAYWRIGHT_ALLOW_SAFE_WRITES !== '1' && 'PLAYWRIGHT_ALLOW_SAFE_WRITES=1',
    isProductionCanvasUrl(baseUrl) && 'non-production PLAYWRIGHT_BASE_URL',
  ].filter(Boolean) as string[]

  return missing.length
    ? { ready: false as const, reason: `Safe Preview fixture unavailable: ${missing.join(', ')}` }
    : {
        ready: true as const,
        baseUrl,
        projectId: env.PLAYWRIGHT_SAFE_PROJECT_ID!,
        storageState: env.PLAYWRIGHT_STORAGE_STATE!,
      }
}

export function findForbiddenMutationRequests(requests: readonly RequestEvidence[]) {
  return requests.filter(({ method, pathname }) => (
    method !== 'GET'
      && method !== 'HEAD'
      && forbiddenMutationPrefixes.some((prefix) => pathname.startsWith(prefix))
  ))
}
```

Do not log environment values, query strings, headers, bodies, cookies, or fixture
identifiers.

- [ ] **Step 4: Run the helper tests and commit**

Run:

```bash
pnpm --filter web exec tsx --test tests/e2e/support/canvas-e2e-safety.test.ts
git diff --check
git add apps/web/tests/e2e/support/canvas-e2e-safety.ts apps/web/tests/e2e/support/canvas-e2e-safety.test.ts
git commit -m "test: define canvas e2e safety contract"
```

Expected: every helper test passes.

### Task 2: Add Isolated Playwright Discovery and Read-Only Preflight

**Files:**
- Create: `apps/web/playwright.canvas.config.ts`
- Create: `apps/web/tests/e2e/auth-boundary.spec.ts`
- Create: `scripts/canvas-e2e-harness-static.test.mjs`

- [ ] **Step 1: Write failing static harness assertions**

Create a Node test that reads the config and both E2E specs. Assert:

```js
assert.match(config, /testDir: '\\.\\/tests\\/e2e'/)
assert.match(config, /outputDir: '\\/tmp\\/creator-city-canvas-e2e'/)
assert.doesNotMatch(config, /tests\\/p0-create-media-and-drag/)
assert.match(preflight, /findForbiddenMutationRequests/)
```

- [ ] **Step 2: Run the static test and record RED**

Run:

```bash
node --test scripts/canvas-e2e-harness-static.test.mjs
```

Expected: FAIL because config and specs do not exist.

- [ ] **Step 3: Create the dedicated Playwright config**

Create `apps/web/playwright.canvas.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: '/tmp/creator-city-canvas-e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
})
```

- [ ] **Step 4: Create the credential-free auth-boundary preflight**

The test must attach only `{ method, pathname }` request evidence. It navigates
to `/create`, expects the login route, checks no page error, and asserts no
forbidden non-GET/HEAD mutation occurred:

```ts
test('unauthenticated Canvas preflight redirects without forbidden mutations', async ({ page }) => {
  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []

  page.on('request', (request) => {
    requests.push({ method: request.method(), pathname: new URL(request.url()).pathname })
  })
  page.on('pageerror', (error) => pageErrors.push(error.name))

  await page.goto('/create', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\\/auth\\/login/)
  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})
```

Do not fill a login form or inspect any authentication storage.

- [ ] **Step 5: Verify isolated discovery and static contract**

Run:

```bash
pnpm --filter web exec playwright test --config playwright.canvas.config.ts --list
node --test scripts/canvas-e2e-harness-static.test.mjs
```

Expected: only `tests/e2e/*.spec.ts` appears; no `src/**/*.test.ts` file is
executed, and static checks pass.

- [ ] **Step 6: Commit the config and preflight**

```bash
git add apps/web/playwright.canvas.config.ts apps/web/tests/e2e/auth-boundary.spec.ts scripts/canvas-e2e-harness-static.test.mjs
git commit -m "test: isolate canvas e2e preflight"
```

### Task 3: Add Opt-In Authenticated Preview Coverage

**Files:**
- Create: `apps/web/tests/e2e/canvas-safe-preview.spec.ts`
- Modify: `scripts/canvas-e2e-harness-static.test.mjs`

- [ ] **Step 1: Write the fail-closed Preview suite**

Create a suite that obtains the fixture once and skips before navigation unless
`fixture.ready` is true:

```ts
const fixture = getSafePreviewFixture(process.env)

test('isolated Preview canvas loads, selects a node, saves once, and reloads', async ({ page }) => {
  if (!fixture.ready) {
    test.skip(true, fixture.reason)
    return
  }

  const requests: RequestEvidence[] = []
  const pageErrors: string[] = []
  page.on('request', (request) => {
    requests.push({ method: request.method(), pathname: new URL(request.url()).pathname })
  })
  page.on('pageerror', (error) => pageErrors.push(error.name))

  await page.goto(`/create?projectId=${encodeURIComponent(fixture.projectId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.locator('.canvas-viewport')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存到云端' })).toBeVisible()

  const nodes = page.locator('.canvas-node-card')
  await expect(nodes).not.toHaveCount(0)
  await nodes.first().click()

  await page.getByRole('button', { name: '保存到云端' }).click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.canvas-viewport')).toBeVisible()

  expect(findForbiddenMutationRequests(requests)).toEqual([])
  expect(pageErrors).toEqual([])
})
```

The test may save only after all Preview fixture checks pass. It must not upload,
generate, call a Provider, or click a billing, payment, credits, wallet, or
asset-transform control.

- [ ] **Step 2: Extend static assertions for Preview safety**

Assert that the Preview spec contains all of:

```js
assert.match(preview, /PLAYWRIGHT_SAFE_ENV/)
assert.match(preview, /if \(!fixture\.ready\)/)
assert.match(preview, /test\.skip\(true, fixture\.reason\)/)
assert.match(preview, /findForbiddenMutationRequests/)
```

- [ ] **Step 3: Run focused static and helper coverage**

Run:

```bash
pnpm --filter web exec tsx --test tests/e2e/support/canvas-e2e-safety.test.ts
node --test scripts/canvas-e2e-harness-static.test.mjs
pnpm --filter web exec playwright test --config playwright.canvas.config.ts --list
```

Expected: all commands pass without credentials, a remote URL, a test project, or
a browser launch.

- [ ] **Step 4: Verify default preflight only against a local running app**

Start the existing web app separately, then run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \\
pnpm --filter web exec playwright test --config playwright.canvas.config.ts --grep \"unauthenticated Canvas preflight\"
```

Expected: PASS only when the local app is reachable. If local auth/database
startup is unavailable, record `ENV_BLOCKER`; do not point this command at
Production as a substitute.

- [ ] **Step 5: Commit the Preview suite**

```bash
git add apps/web/tests/e2e/canvas-safe-preview.spec.ts scripts/canvas-e2e-harness-static.test.mjs
git commit -m "test: gate canvas preview e2e writes"
```

### Task 4: Full Verification, Deployment, and Documentation

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run the full local quality gate**

Run:

```bash
pnpm --filter web exec tsx --test tests/e2e/support/canvas-e2e-safety.test.ts
node --test scripts/canvas-e2e-harness-static.test.mjs
pnpm --filter web exec playwright test --config playwright.canvas.config.ts --list
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit 0; lint warnings must be recorded only if they are
pre-existing and non-failing.

- [ ] **Step 2: Audit the diff against frozen boundaries**

Run:

```bash
git diff HEAD~3..HEAD --name-only
git status --short
```

Expected: only the dedicated E2E configuration, tests, helpers, static contract,
and task documentation changed. No package, lockfile, schema, API, generation,
Provider/BYOK, payment, billing, env, cn-executor, or production database file
is present.

- [ ] **Step 3: Push and wait for deployment readiness**

```bash
git push origin main
```

Wait for Vercel to show Ready for the implementation SHA. This task adds test
infrastructure only; no production test is run unless a separately configured,
isolated Preview fixture is supplied.

- [ ] **Step 4: Record truthful status in docs and push**

Mark the task `VALIDATED / CLOSED_WITH_PREVIEW_FIXTURE_PENDING` when:

- isolated E2E discovery passes;
- safety/static tests pass;
- full local checks pass;
- Vercel deployment is Ready; and
- no Preview fixture was supplied.

Record `PREVIEW_E2E_PASS` only after the explicitly gated Preview suite runs
against an isolated project. Never call an unavailable fixture a product pass.

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: record canvas e2e harness status"
git push origin main
```

## Self-Review

- Spec coverage: Tasks 1-3 implement isolated discovery, default credential-free
  coverage, explicit Preview fixture gating, sanitized evidence, and no implicit
  production target. Task 4 covers verification, deployment, and truthful status.
- Placeholder scan: no unresolved implementation placeholders or unspecified
  validation steps remain.
- Type consistency: `E2EEnvironment`, `RequestEvidence`,
  `getSafePreviewFixture`, and `findForbiddenMutationRequests` are defined in
  Task 1 and used under the same names throughout Tasks 2-4.
