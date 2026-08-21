# Prisma Fresh Database Bootstrap Design

**Status:** Design approved; implementation plan pending review

## Objective

Make a blank PostgreSQL database capable of reaching the current Creator City
Prisma schema through the checked-in migration chain alone. A new Preview
environment must not require the legacy Supabase SQL Editor setup files before
project, Canvas, asset, auth, delivery, membership, marketplace, or provider
account features can initialize.

## Root Cause

The first historical Prisma migration establishes the original application
baseline, including `User`, `Project`, and `Asset`. Later Canvas, delivery, and
Provider-account schema additions were partly created through separate SQL
Editor scripts rather than committed Prisma migrations. As a result,
`prisma migrate deploy` can report success while a blank database still lacks
`CanvasWorkflow`, `CanvasNode`, `CanvasEdge`, `CanvasComment`, and other
objects required by the current application.

The legacy `supabase-setup.sql` is also stale relative to the current schema.
It does not cover every current model or enum. The unmerged recovery migration
`2bbda8c` is useful audit evidence, but it covers only a subset of the missing
baseline and cannot be adopted unchanged.

## Selected Design

Add one new, idempotent Prisma normalization migration after the existing
migration history. It establishes the current schema objects that were omitted
from the historical chain, including their indexes, foreign keys, and required
triggers. The original baseline and existing migrations remain unchanged.

The normalization migration has two supported modes:

1. On a blank PostgreSQL database, the original migration chain creates its
   base schema first and the normalization migration then completes the
   historically omitted objects without manual setup SQL.
2. On an existing compatible database, it uses guarded DDL and validation so it
   can be recorded without deleting, replacing, or rewriting existing data.

The legacy setup SQL files remain in the repository only as historical/manual
recovery references. New Preview bootstrap is not allowed to depend on them.

## Boundaries

- No `prisma db push`, `accept-data-loss`, destructive SQL, data reset, or
  migration-history rewrite.
- No Production database, Production Vercel configuration, old Supabase
  project, historical data, payment, credit, wallet, billing, Provider, BYOK,
  generation-route, or executor changes.
- No Prisma schema model changes are needed for this task.
- The existing untracked Preview continuity design document is outside this
  task and remains untouched.

## Implementation Shape

1. Audit the current Prisma schema against the original baseline and every
   committed migration to establish the exact objects omitted from the migration
   chain.
2. Add one checked-in forward normalization migration containing guarded
   PostgreSQL DDL for those omitted objects. It must preserve the current object
   names and relation semantics expected by Prisma Client.
3. Add a static schema-coverage regression that fails when a schema model or
   enum is neither established by the baseline nor introduced by a later
   migration.
4. Add a disposable PostgreSQL bootstrap regression that runs only
   `prisma migrate deploy` against an empty database, reruns it to prove stable
   state, and verifies the expected schema contract.
5. Run a bounded isolated Preview Canvas path only after local migration
   verification: disposable account, project creation, Text node, cloud save,
   refresh, and recovery. Provider generation and all payment-related calls
   remain prohibited.

## Migration Safety Rules

- DDL is additive and guarded. It must not drop, truncate, delete, alter data
  values, or merge records.
- Existing migrations stay byte-for-byte unchanged. The new baseline is the
  only migration added by this task.
- Required constraints and indexes are added only after their referenced tables
  exist. A compatibility check must fail explicitly if a conflicting object is
  present, rather than silently changing it.
- The test database is disposable and must be removed after verification.

## Acceptance Criteria

- A blank disposable PostgreSQL database reaches `prisma migrate status`:
  up-to-date after `prisma migrate deploy`, with no manual SQL setup.
- A second deploy is a no-op and reports no pending migrations.
- The schema contract contains all current Prisma models and enums after the
  migration chain finishes.
- A safe Preview Canvas persistence path works without `DB_SCHEMA_MISSING`.
- Request capture shows zero Provider generation, payment, billing, credit,
  wallet, recharge, checkout, or Production database calls.
- Production remains untouched throughout implementation and verification.

## Rejected Alternatives

- A separate setup script would preserve two competing schema sources and
  permit further drift.
- Rewriting existing migration history would invalidate already-recorded
  checksums and creates unnecessary operational risk.
- Applying only the old Canvas SQL would leave other first-run application
  tables unavailable.
