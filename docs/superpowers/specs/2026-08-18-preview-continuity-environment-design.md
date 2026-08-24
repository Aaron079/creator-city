# Preview Continuity Environment Design

**Status:** Foundation provisioned; scoped storage credentials and application binding pending

## Objective

Create a fully isolated, disposable Creator City Preview continuity environment after the
historical Supabase tenant became unavailable. This environment must let the team resume
safe application development and authenticated Canvas QA without changing or depending on
Production, the inaccessible WRXZ project, or the empty UCAD project.

## Selected Architecture

Use three separately controlled services:

1. **Neon PostgreSQL**: a newly created database project for Preview only.
2. **Aliyun OSS**: a new private bucket for Preview-only Canvas assets.
3. **Vercel Preview**: the existing Creator City project, configured only in the Preview
   environment with the new database and storage credentials.

The separation is deliberate. A failure, access issue, or lifecycle event in any one
provider must not erase the other two copies of application state.

## Non-Goals and Hard Boundaries

- Do not change Vercel Production variables, deployment aliases, or domains.
- Do not change, delete, migrate, reset, or write to WRXZ, UCAD, or any historical
  Supabase project.
- Do not import, rewrite, merge, or infer historical user data.
- Do not run `prisma db push`, destructive SQL, or `accept-data-loss`.
- Do not enable payment, real Provider generation, or a Production cutover.
- Do not expose database URLs, access keys, tokens, passwords, or object URLs containing
  credentials in code, logs, commits, documentation, or chat.

## Application Changes Required Before Preview Binding

The existing Prisma schema and custom email/password session model are compatible with a
blank PostgreSQL database. No auth-provider migration or Prisma schema change is required.

The asset data model already records `storageProvider`, `bucket`, and `storageKey`. The
existing server-only Aliyun OSS adapter supports upload, read, head, and signed download URLs,
so no new storage transport or package dependency is required. Preview binding must preserve
immutable asset keys and the current `Asset` metadata contract while leaving Supabase, Tencent
COS, and local-development behavior untouched.

## Resource Creation and Configuration Sequence

1. Create a new Neon project named for Creator City Preview continuity, with no import and
   no Production connection.
2. Create a new Aliyun OSS bucket named for Creator City Preview continuity, private by
   default, with Block Public Access enabled.
3. Record owner, project identifier, region, retention policy, and creation time in the
   private operations inventory. Do not record secrets there.
4. Create a RAM user with a narrowly scoped policy limited to that bucket and the required
   object operations. Never use a root-account AccessKey.
5. Bootstrap the blank Neon database only with reviewed, forward-only Prisma migrations.
   First validate the migration chain against a disposable local PostgreSQL instance. Do not
   use `db push`.
6. Add only Preview-scoped Vercel variables for the Neon connection and OSS credentials. Do
   not expose values in client variables. Do not edit Production or Development values.
7. Trigger one Preview deployment, register a disposable Preview-only account, and run a
   bounded Canvas path: sign in, create a project, import a test image, save, reload, and
   delete the disposable test project only if its deletion behavior is separately reviewed.
8. Capture a redacted verification record: database connectivity, schema migration result,
   private object round trip, asset persistence, reload behavior, request counts, and console
   errors.

## Rollback

Rollback is configuration-only: remove the Preview-scoped variables or stop using the
Preview branch. Do not alter Production. The new Neon project and Aliyun OSS bucket remain
isolated until the Founder explicitly approves their deletion.

## Recovery and Backup Policy

- Preserve the unreachable Supabase projects as forensic evidence; support escalation stays
  active and separate from this Preview environment.
- Before any future Production decision, require an owner-controlled export procedure:
  encrypted PostgreSQL backup, OSS object inventory, retention confirmation, and restore
  rehearsal to a non-Production database.
- A successful Preview environment does not recover historical accounts, projects, assets,
  sessions, or payment state. It provides a clean, safe path for new Preview QA only.

## Provisioning Record (2026-08-18)

- Created a new empty Neon PostgreSQL Preview project, `creator-city-continuity-preview`,
  in AWS Asia Pacific 1 (Singapore). Neon Auth is disabled. No connection string was copied,
  no schema was bootstrapped, and no Vercel environment was changed.
- Created a new Aliyun OSS Preview bucket, `creator-city-preview-continuity-20260818`, in
  China North 2 (Beijing). It uses Standard storage with local redundancy, private ACL, and
  Block Public Access enabled. No objects were uploaded and no public domain was configured.
- The authenticated Aliyun RAM console accepted a submission for a dedicated
  `creator-city-preview-oss` user with console login disabled and a permanent AccessKey
  requested. The secret was not displayed, copied, logged, or stored. However, the RAM Users
  and Policies pages later returned a persistent loading state, and the OSS bucket's RAM-user
  directory did not list the new identity after a delayed refresh. The submission outcome and
  any resulting key must be reconciled in RAM before a retry; do not create another key or use
  a root-account AccessKey as a workaround.
- No bucket policy, custom RAM policy, Vercel variable, database schema, deployment, or
  Production setting was changed. The Preview bucket remains private and unmodified.

## Acceptance Criteria

- Production settings, Production deployment, WRXZ, and UCAD show no changes.
- New Neon database and Aliyun OSS bucket exist and are isolated to Preview use.
- No secret is committed or emitted.
- Prisma migration chain succeeds on a disposable local PostgreSQL database before it is
  used on Neon.
- A Preview-only user can register, sign in, create a Canvas project, upload a test image,
  save, refresh, and recover the image node.
- Captured traffic has zero payment, credit, billing, wallet, checkout, Provider generation,
  or Production database requests.
- Rollback can disable the Preview environment without touching Production.
