# Confirmed Experience Locks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the founder-approved canvas experience baseline so future additions cannot silently alter accepted design or interaction behavior.

**Architecture:** A declarative JSON registry records every frozen canvas surface, its owner files, and required checks. A read-only Node verifier validates registry shape, source wiring, and test-file existence; `AGENTS.md` requires a recorded impact declaration and the verifier makes the registry discoverable from the normal agent check. Existing focused browser and component tests remain the behavioral proof layer, with no production canvas logic changed by this feature.

**Tech Stack:** Node.js ESM, JSON, Node test runner, Playwright, TypeScript, Next.js.

---

## File Structure

- Create: `docs/CONFIRMED_EXPERIENCE_LOCKS.json` - canonical machine-readable list of founder-approved canvas locks, owner files, and tests.
- Create: `scripts/verify-confirmed-experience-locks.mjs` - read-only validation command for the registry and its required source/test anchors.
- Create: `scripts/verify-confirmed-experience-locks.test.mjs` - isolated test coverage for the verifier against valid and invalid temporary fixtures.
- Modify: `AGENTS.md` - require contributors to read the registry and declare frozen-surface impact before touching canvas code.
- Modify: `package.json` - expose `pnpm experience:check` and include it in `pnpm agent:check`.
- Modify: `scripts/agent-loop-check.mjs` - make the confirmed-experience registry a required project artifact.
- Modify: `apps/web/tests/e2e/canvas-context-menus.spec.ts` - retain the approved node and blank-canvas context-menu contract in browser acceptance coverage.

### Task 1: Define the frozen-experience registry

**Files:**
- Create: `docs/CONFIRMED_EXPERIENCE_LOCKS.json`
- Test: `scripts/verify-confirmed-experience-locks.test.mjs`

- [ ] **Step 1: Write the failing registry verification fixture**

Add a test that writes the following invalid registry into a temporary directory and asserts the verifier exits with code `1` and reports the missing `id` field:

```js
const invalidRegistry = {
  version: 1,
  locks: [{ title: 'Missing identifier', owners: [], checks: [] }],
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/verify-confirmed-experience-locks.test.mjs`

Expected: FAIL because `scripts/verify-confirmed-experience-locks.mjs` does not exist.

- [ ] **Step 3: Add the canonical registry**

Create `docs/CONFIRMED_EXPERIENCE_LOCKS.json` with this complete top-level structure and seven locks:

```json
{
  "version": 1,
  "policy": "Founder-approved canvas experience is additive-only unless a documented exception is approved.",
  "declaration": {
    "unaffected": "Confirmed experience impact: none",
    "exception": "Confirmed experience exception: <lock id>\nFounder approval: <approval record or task link>"
  },
  "locks": [
    {
      "id": "node-editor-anchor",
      "title": "Active node and editor relationship",
      "owners": [
        "apps/web/src/components/create/VisualCanvasWorkspace.tsx",
        "apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts"
      ],
      "checks": [
        "apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx"
      ]
    }
  ]
}
```

Append these exact remaining lock records to `locks`:

```json
[
  {
    "id": "prompt-editor-fixed-regions",
    "title": "Prompt editor fixed controls and scrolling content",
    "owners": [
      "apps/web/src/components/create/CanvasPromptBox.tsx",
      "apps/web/src/components/create/canvas.module.css"
    ],
    "checks": [
      "apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx"
    ]
  },
  {
    "id": "node-editor-coupled-drag",
    "title": "Dragging a node moves its open editor",
    "owners": [
      "apps/web/src/components/create/VisualCanvasWorkspace.tsx",
      "apps/web/src/components/create/canvas/canvasWorkspaceLayout.ts"
    ],
    "checks": [
      "apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx"
    ]
  },
  {
    "id": "four-edge-resize-without-handles",
    "title": "Node and editor resize from edges and corners without visible handles",
    "owners": [
      "apps/web/src/components/create/CanvasNodeCard.tsx",
      "apps/web/src/components/create/CanvasPromptBox.tsx",
      "apps/web/src/components/create/VisualCanvasWorkspace.tsx",
      "apps/web/src/components/create/canvas/canvasResizeGeometry.ts",
      "apps/web/src/components/create/canvas.module.css"
    ],
    "checks": [
      "apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx",
      "apps/web/src/components/create/canvas/secondaryClickSequence.test.ts"
    ]
  },
  {
    "id": "node-context-menu-actions",
    "title": "Node context menu actions",
    "owners": [
      "apps/web/src/components/create/VisualCanvasWorkspace.tsx",
      "apps/web/src/components/create/CanvasNodeCard.tsx"
    ],
    "checks": [
      "apps/web/src/components/create/canvas/secondaryClickSequence.test.ts",
      "apps/web/tests/e2e/canvas-context-menus.spec.ts"
    ]
  },
  {
    "id": "canvas-context-menu-actions",
    "title": "Blank canvas context menu actions",
    "owners": [
      "apps/web/src/components/create/VisualCanvasWorkspace.tsx"
    ],
    "checks": [
      "apps/web/src/components/create/canvas/secondaryClickSequence.test.ts",
      "apps/web/tests/e2e/canvas-context-menus.spec.ts"
    ]
  },
  {
    "id": "safari-canvas-context-menu-capture",
    "title": "Safari native context-menu interception within canvas",
    "owners": [
      "apps/web/src/components/create/VisualCanvasWorkspace.tsx",
      "apps/web/src/components/create/CanvasNodeCard.tsx"
    ],
    "checks": [
      "apps/web/src/components/create/canvas/secondaryClickSequence.test.ts",
      "apps/web/tests/e2e/canvas-context-menus.spec.ts"
    ]
  }
]
```

- [ ] **Step 4: Add registry validation to the verifier**

Implement the following validation contract in `scripts/verify-confirmed-experience-locks.mjs`:

```js
function validateRegistry(registry) {
  if (registry?.version !== 1) return ['Registry version must equal 1.']
  if (!Array.isArray(registry.locks) || registry.locks.length === 0) {
    return ['Registry must include at least one lock.']
  }

  const ids = new Set()
  const errors = []
  for (const lock of registry.locks) {
    if (typeof lock.id !== 'string' || lock.id.length === 0) errors.push('Lock is missing id.')
    if (ids.has(lock.id)) errors.push(`Duplicate lock id: ${lock.id}`)
    ids.add(lock.id)
    if (!Array.isArray(lock.owners) || lock.owners.length === 0) errors.push(`${lock.id}: owners required.`)
    if (!Array.isArray(lock.checks) || lock.checks.length === 0) errors.push(`${lock.id}: checks required.`)
  }
  return errors
}
```

The verifier must export `validateRegistry` and `verifyRegistry`. Its command-line contract is:

```bash
node scripts/verify-confirmed-experience-locks.mjs \
  --root /absolute/path/to/repository \
  --registry docs/CONFIRMED_EXPERIENCE_LOCKS.json
```

With no arguments it uses the repository root and `docs/CONFIRMED_EXPERIENCE_LOCKS.json`. On success it prints `[OK] Confirmed experience locks: <count>` and exits `0`; on failure it prints every error prefixed by `[ERROR]` and exits `1`.

- [ ] **Step 5: Run the unit test to verify the registry contract passes**

Run: `node --test scripts/verify-confirmed-experience-locks.test.mjs`

Expected: PASS, including the invalid-fixture failure assertion and the canonical registry assertion.

- [ ] **Step 6: Commit the registry and its contract**

```bash
git add docs/CONFIRMED_EXPERIENCE_LOCKS.json scripts/verify-confirmed-experience-locks.mjs scripts/verify-confirmed-experience-locks.test.mjs
git commit -m "feat: register confirmed canvas experience locks"
```

### Task 2: Enforce owner and acceptance-test references

**Files:**
- Modify: `scripts/verify-confirmed-experience-locks.mjs`
- Modify: `scripts/verify-confirmed-experience-locks.test.mjs`
- Test: `apps/web/src/components/create/canvas/secondaryClickSequence.test.ts`
- Test: `apps/web/tests/e2e/canvas-context-menus.spec.ts`

- [ ] **Step 1: Write failing checks for missing owner and test files**

Extend the temporary-fixture tests to use this valid-shaped but unresolved lock:

```js
const unresolvedRegistry = {
  version: 1,
  locks: [{
    id: 'missing-file',
    title: 'Missing file',
    owners: ['apps/web/src/missing.tsx'],
    checks: ['apps/web/tests/missing.spec.ts'],
  }],
}
```

Assert that the verifier exits `1` and includes both missing paths.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/verify-confirmed-experience-locks.test.mjs`

Expected: FAIL until owner/check existence validation exists.

- [ ] **Step 3: Implement read-only path validation**

For each `owners` and `checks` entry, resolve it against the repository root and append this exact error when absent:

```js
errors.push(`${lock.id}: missing ${kind} file: ${relativePath}`)
```

The verifier must only read files and exit with `0` when all checks pass; it must never mutate the registry, source files, or environment.

- [ ] **Step 4: Extend context-menu acceptance assertions**

In `apps/web/tests/e2e/canvas-context-menus.spec.ts`, retain assertions that node right-click reveals `打开任务` and `复制节点`, and blank-canvas right-click reveals usable `上传素材` and enabled `粘贴节点`. Add assertions that both menus remain scoped to `.canvas-viewport` after opening.

```ts
await expect(nodeMenu).toBeVisible()
await expect(nodeMenu).toHaveCount(1)
await expect(canvasMenu).toBeVisible()
await expect(canvasMenu).toHaveCount(1)
```

- [ ] **Step 5: Run focused checks**

Run:

```bash
node --test scripts/verify-confirmed-experience-locks.test.mjs
pnpm --filter web exec tsx --test src/components/create/canvas/secondaryClickSequence.test.ts
```

Expected: both commands PASS.

- [ ] **Step 6: Commit the verifier enforcement**

```bash
git add scripts/verify-confirmed-experience-locks.mjs scripts/verify-confirmed-experience-locks.test.mjs apps/web/tests/e2e/canvas-context-menus.spec.ts
git commit -m "test: enforce confirmed canvas experience references"
```

### Task 3: Make the policy mandatory for future canvas changes

**Files:**
- Modify: `AGENTS.md`
- Modify: `package.json`
- Modify: `scripts/agent-loop-check.mjs`
- Test: `scripts/verify-confirmed-experience-locks.test.mjs`

- [ ] **Step 1: Write failing agent-loop coverage**

Add a test that reads `scripts/agent-loop-check.mjs` and asserts its `REQUIRED_FILES` array contains:

```js
{ key: 'CONFIRMED_EXPERIENCE_LOCKS', path: 'docs/CONFIRMED_EXPERIENCE_LOCKS.json' }
```

Also assert root `package.json` contains an `experience:check` script that invokes `node scripts/verify-confirmed-experience-locks.mjs`.

Use the Node standard library so this test has no browser or network dependency:

```js
const agentLoop = readFileSync(resolve(repositoryRoot, 'scripts/agent-loop-check.mjs'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'))
assert.match(agentLoop, /CONFIRMED_EXPERIENCE_LOCKS/)
assert.equal(packageJson.scripts['experience:check'], 'node scripts/verify-confirmed-experience-locks.mjs')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/verify-confirmed-experience-locks.test.mjs`

Expected: FAIL because the registry is not yet part of the project gate.

- [ ] **Step 3: Update contributor rules**

Add this section to `AGENTS.md` after the existing mandatory-read list:

```markdown
## Confirmed Experience Locks

Before changing canvas code, read `docs/CONFIRMED_EXPERIENCE_LOCKS.json`.

- Existing approved canvas experience is additive-only.
- Do not move, restyle, remove, or weaken a registered lock without a founder-approved exception.
- Every canvas task and delivery must state either `Confirmed experience impact: none` or name the exact lock plus the founder approval record.
- Run `pnpm experience:check` with the lock's listed focused checks before describing a canvas change as complete.
```

- [ ] **Step 4: Register the verification command**

In root `package.json`, add:

```json
"experience:check": "node scripts/verify-confirmed-experience-locks.mjs"
```

In `scripts/agent-loop-check.mjs`, add the registry to `REQUIRED_FILES` and append `experience:check` to the hard-boundary reminder output.

- [ ] **Step 5: Run the delivery gate**

Run:

```bash
pnpm experience:check
pnpm agent:check
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

Expected: all commands PASS. Existing unrelated lint warnings may remain visible but must not cause the build command to fail.

- [ ] **Step 6: Commit the mandatory gate**

```bash
git add AGENTS.md package.json scripts/agent-loop-check.mjs scripts/verify-confirmed-experience-locks.test.mjs
git commit -m "docs: require confirmed experience checks"
```

### Task 4: Perform the final frozen-surface verification

**Files:**
- Verify: `docs/CONFIRMED_EXPERIENCE_LOCKS.json`
- Verify: `apps/web/src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx`
- Verify: `apps/web/src/components/create/canvas/secondaryClickSequence.test.ts`
- Verify: `apps/web/tests/e2e/canvas-context-menus.spec.ts`

- [ ] **Step 1: Run the registry gate and focused static checks**

Run:

```bash
pnpm experience:check
pnpm --filter web exec tsx --test src/components/create/canvas/secondaryClickSequence.test.ts
pnpm --filter web exec tsx --test src/components/create/canvas/canvasTaskDialog.rendered-layout.test.tsx
```

Expected: all tests PASS and every registered owner/check path resolves.

- [ ] **Step 2: Run Preview browser acceptance when preview configuration is available**

Run:

```bash
pnpm --filter web exec playwright test tests/e2e/canvas-context-menus.spec.ts
```

Expected: both node and blank-canvas context-menu flows PASS. If Preview fixture configuration is intentionally absent, the test reports SKIP with its explicit environment reason; record that limitation rather than claiming live-browser completion.

- [ ] **Step 3: Verify the working tree only includes this lock mechanism**

Run:

```bash
git diff --check
git status --short
git log -3 --oneline
```

Expected: no whitespace errors; no canvas production behavior changed; unrelated pre-existing untracked files remain untouched.

- [ ] **Step 4: Commit final verification documentation only if needed**

If Task 4 revealed a registry or test documentation change, commit only that corrective change:

```bash
git add docs/CONFIRMED_EXPERIENCE_LOCKS.json apps/web/tests/e2e/canvas-context-menus.spec.ts
git commit -m "test: verify confirmed canvas experience locks"
```

If no corrective change is required, do not create an empty commit.
