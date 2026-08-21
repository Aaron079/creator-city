# Prisma Fresh Database Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `prisma migrate deploy` alone bring a blank PostgreSQL database to the current Creator City schema without hand-running legacy Canvas or delivery SQL.

**Architecture:** Preserve the existing migration history byte-for-byte. Add one forward-only, idempotent normalization migration after that history for the objects created only by legacy SQL Editor scripts. A disposable Docker PostgreSQL integration harness proves the full chain from an empty database, and a static guard keeps this migration additive.

**Tech Stack:** PostgreSQL 16, Prisma 5 CLI, Node.js test runner, Docker CLI, existing `pnpm` workspace.

---

## File Map

- Create: `apps/server/prisma/migrations/20260821000000_normalize_fresh_database_bootstrap/migration.sql` - forward normalization of omitted Canvas, delivery, Provider-account, and compatibility objects.
- Create: `scripts/prisma-fresh-database-bootstrap-static.test.mjs` - read-only migration safety/coverage guard.
- Create: `scripts/prisma-fresh-database-bootstrap.integration.mjs` - disposable local PostgreSQL regression running the real migration chain twice.
- Modify after green verification only: `docs/CURRENT_STATUS.md`, `docs/NEXT_TASKS.md`.

No schema model, application route, runtime bootstrap, environment file, package manifest, Provider, BYOK, payment, credit, wallet, billing, executor, Production database, or Production Vercel variable is in scope.

### Task 1: Write the Failing Static Migration Contract

**Files:**
- Create: `scripts/prisma-fresh-database-bootstrap-static.test.mjs`

- [ ] **Step 1: Add the red test**

```js
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = new URL(
  '../apps/server/prisma/migrations/20260821000000_normalize_fresh_database_bootstrap/migration.sql',
  import.meta.url,
)

test('forward normalization migration is present and additive', () => {
  assert.equal(existsSync(migrationPath), true)
  const sql = readFileSync(migrationPath, 'utf8')
  for (const name of ['CanvasWorkflow', 'CanvasNode', 'CanvasEdge', 'CanvasComment', 'DeliveryShare', 'DeliveryItem', 'DeliveryComment', 'ProviderAccount', 'ProviderPricingRule']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS "${name}"`))
  }
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|TYPE|INDEX|SCHEMA|DATABASE)\b/i)
  assert.doesNotMatch(sql, /\b(TRUNCATE|DELETE\s+FROM|INSERT\s+INTO)\b/i)
  assert.doesNotMatch(sql, /project-canvas-setup\.sql|canvas-comments-setup\.sql/)
})
```

- [ ] **Step 2: Verify red**

Run `node --test scripts/prisma-fresh-database-bootstrap-static.test.mjs`.

Expected: FAIL because the normalization migration does not yet exist.

- [ ] **Step 3: Commit the red test**

```bash
git add scripts/prisma-fresh-database-bootstrap-static.test.mjs
git commit -m "test: cover fresh database bootstrap contract"
```

### Task 2: Reproduce Drift on a Disposable Empty Database

**Files:**
- Create: `scripts/prisma-fresh-database-bootstrap.integration.mjs`

- [ ] **Step 1: Add a real PostgreSQL harness**

The script creates a Docker container with a unique name and a random localhost port, waits with `pg_isready`, and always removes it in `finally`. It derives the current model and enum names from `apps/server/prisma/schema.prisma`, not from a copied list. It passes the disposable `DATABASE_URL` only to child Prisma processes and never prints either URL or password.

```js
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const schema = readFileSync(`${root}/apps/server/prisma/schema.prisma`, 'utf8')
const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((match) => match[1])
const enums = [...schema.matchAll(/^enum\s+(\w+)/gm)].map((match) => match[1])
const containerName = `creator-city-prisma-bootstrap-${process.pid}`
const databaseName = 'creator_city_bootstrap'
const postgresPassword = 'creator_city_disposable_test'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout
}

function values(names) {
  return names.map((name) => `('${name.replaceAll("'", "''")}')`).join(', ')
}

function queryPostgres(sql) {
  return run('docker', ['exec', '-e', `PGPASSWORD=${postgresPassword}`, containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-At', '-c', sql]).trim()
}

try {
  run('docker', ['run', '-d', '--rm', '--name', containerName, '-e', `POSTGRES_PASSWORD=${postgresPassword}`, '-e', `POSTGRES_DB=${databaseName}`, '-p', '127.0.0.1::5432', 'postgres:16-alpine'])
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnSync('docker', ['exec', containerName, 'pg_isready', '-U', 'postgres', '-d', databaseName]).status === 0) break
    if (attempt === 59) throw new Error('disposable PostgreSQL did not become ready')
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }
  const port = run('docker', ['port', containerName, '5432/tcp']).trim().match(/:(\d+)$/)?.[1]
  assert.ok(port, 'Docker must publish a localhost PostgreSQL port')
  const env = { ...process.env, DATABASE_URL: `postgresql://postgres:${postgresPassword}@127.0.0.1:${port}/${databaseName}?schema=public` }
  run('pnpm', ['--filter', 'server', 'exec', 'prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'], { env })
  run('pnpm', ['--filter', 'server', 'exec', 'prisma', 'migrate', 'status', '--schema=prisma/schema.prisma'], { env })
  assert.equal(queryPostgres(`WITH expected(name) AS (VALUES ${values(models)}) SELECT string_agg(expected.name, ',') FROM expected LEFT JOIN information_schema.tables actual ON actual.table_schema = 'public' AND actual.table_name = expected.name WHERE actual.table_name IS NULL`), '')
  assert.equal(queryPostgres(`WITH expected(name) AS (VALUES ${values(enums)}) SELECT string_agg(expected.name, ',') FROM expected LEFT JOIN pg_type actual ON actual.typname = expected.name LEFT JOIN pg_namespace namespace ON namespace.oid = actual.typnamespace AND namespace.nspname = 'public' WHERE namespace.oid IS NULL`), '')
  assert.match(run('pnpm', ['--filter', 'server', 'exec', 'prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma'], { env }), /No pending migrations/i)
} finally {
  spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' })
}
```

The harness must run, in this order:

```bash
pnpm --filter server exec prisma migrate deploy --schema=prisma/schema.prisma
pnpm --filter server exec prisma migrate status --schema=prisma/schema.prisma
pnpm --filter server exec prisma migrate deploy --schema=prisma/schema.prisma
```

The first deploy is followed by SQL assertions that no parsed model table or enum typname is missing. The second deploy must report no pending migrations.

- [ ] **Step 2: Verify red against current history**

Run `node scripts/prisma-fresh-database-bootstrap.integration.mjs`.

Expected: schema assertion fails on the manual-SQL objects, typically `CanvasWorkflow` or `CanvasComment`; the temporary container is still absent after exit.

- [ ] **Step 3: Commit the red harness**

```bash
git add scripts/prisma-fresh-database-bootstrap.integration.mjs
git commit -m "test: reproduce blank database schema drift"
```

### Task 3: Add the Forward Normalization Migration

**Files:**
- Create: `apps/server/prisma/migrations/20260821000000_normalize_fresh_database_bootstrap/migration.sql`

- [ ] **Step 1: Add only the missing-object normalization**

Use the unmerged `2bbda8c` migration as the exact audited source text for the normalization migration after reviewing it against the current schema. The new migration is ordered after `20260623000000_add_webauthn_credentials`; no old migration is edited or renamed.

```bash
git show 2bbda8c:apps/server/prisma/migrations/20260712000000_normalize_fresh_database_bootstrap/migration.sql
```

Copy the reviewed 634-line SQL body into `20260821000000_normalize_fresh_database_bootstrap/migration.sql` through `apply_patch`, retaining its guarded table, index, foreign-key, trigger, and pg_catalog compatibility assertions. The only permitted textual changes are the two descriptive header lines. Guards must fail on incompatible existing constraints/triggers instead of replacing them. `ALTER COLUMN DROP DEFAULT` is allowed only where the current schema requires no database default. Do not use `DROP TABLE`, `DROP TYPE`, `DELETE`, `TRUNCATE`, `INSERT`, `UPDATE`, or data rewrites.

- [ ] **Step 2: Verify green at the static boundary**

Run `node --test scripts/prisma-fresh-database-bootstrap-static.test.mjs`.

Expected: PASS. The new migration exists, is additive, and contains no legacy manual-bootstrap dependency.

- [ ] **Step 3: Verify green against a real empty PostgreSQL database**

Run `node scripts/prisma-fresh-database-bootstrap.integration.mjs`.

Expected: PASS. First deploy applies the chain, status is up to date, every current Prisma model table and enum exists, second deploy is a no-op, and the container is removed.

- [ ] **Step 4: Commit the green migration and tests**

```bash
git add apps/server/prisma/migrations/20260821000000_normalize_fresh_database_bootstrap/migration.sql \
  scripts/prisma-fresh-database-bootstrap-static.test.mjs \
  scripts/prisma-fresh-database-bootstrap.integration.mjs
git commit -m "fix: normalize fresh database bootstrap"
```

### Task 4: Repository and Boundary Verification

**Files:**
- Verify only: `apps/server/prisma/schema.prisma`
- Verify only: `apps/web/src/app/api/projects/ensure/route.ts`
- Verify only: `apps/web/src/lib/projects/api-errors.ts`

- [ ] **Step 1: Regenerate Prisma Client without changing the schema**

Run `pnpm --filter server prisma:generate`.

Expected: success and no diff in `apps/server/prisma/schema.prisma`.

- [ ] **Step 2: Run the full local gate**

```bash
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check
git diff --check
git diff --name-only
```

Expected: type-check/build pass, no new lint warnings/errors, and the diff is limited to the planned migration, test scripts, and documentation. Any change in payment, Provider, BYOK, generate routes, executor, schema, package, or env stops the task for scope review.

- [ ] **Step 3: Do not push or deploy in this task**

Keep the implementation commit local until the local Docker regression and the scope diff are reviewed.

### Task 5: Separate Preview Verification and Closeout

**Files:**
- Modify after approval: `docs/CURRENT_STATUS.md`
- Modify after approval: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Obtain explicit approval before any Preview configuration, push, or deployment**

Use only the isolated continuity Preview environment. Never change Production, WRXZ, UCAD, historical data, payment, or real Provider configuration.

- [ ] **Step 2: Run the bounded Preview path**

Use a disposable Preview-only account:

```text
register -> sign in -> create project -> create Text node -> manual cloud save
-> refresh -> reopen the same project and node
```

Expected: no `DB_SCHEMA_MISSING`; project and node persist after reload. Capture redacted console/network evidence with zero `/api/generate/*`, Provider, payment, billing, credit, wallet, recharge, or checkout mutations.

- [ ] **Step 3: Record only verified results and commit docs**

```bash
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git diff --cached --check
git commit -m "docs: close fresh database bootstrap"
```

## Final Verification Matrix

```text
static migration guard                         PASS
empty PostgreSQL migrate deploy                PASS
empty PostgreSQL migrate status                PASS
second migrate deploy is a no-op               PASS
all current Prisma model tables/enums present  PASS
type-check / lint / build / agent-check        PASS
diff-check and forbidden-zone audit            PASS
Preview project/save/reload                    PASS or explicit limitation
Production / Provider / payment mutation       0
```
