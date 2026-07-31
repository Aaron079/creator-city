# Project Summary Asset Count Consistency Design

## Goal

Make project cards in `/projects` and `/dashboard` report the same asset count as
the Asset Library for the current user, without changing asset persistence,
project membership, Canvas behavior, generation, or billing.

## Root Cause

`GET /api/projects?scope=owned` uses a reduced project query for resilience and
currently serializes `assetCount: 0`. This makes owned project cards disagree
with the Asset Library even when the project has saved assets.

The other project-list paths add `Project.generatedAssets` and `Project.assets`
counts together. `generatedAssets` is the direct `Asset.projectId` relation,
while `assets` is the `ProjectAsset` association relation. One asset may exist in
both relations, so summing them can double-count and still diverges from the
Asset Library.

## Canonical Definition

A project's displayed asset count is the number of direct `Asset` rows where:

- `ownerId` is the current user; and
- `projectId` is the displayed project ID.

This is the same ownership and project association used by `/api/assets`.
`ProjectAsset` rows remain useful curated associations, but do not contribute to
this summary count because they are not the Asset Library's canonical ownership
definition and can overlap direct asset records.

## Design

1. Add a small pure helper that converts the direct-asset grouped-count rows to
   a project-ID-to-count map. Rows without a project ID are ignored.
2. For each `/api/projects` response path, collect the returned project IDs and
   run one batched `db.asset.groupBy` query constrained to the current user and
   those IDs.
3. Use the map value, falling back to zero only when no matching direct Asset
   exists, when serializing `assetCount`.
4. Apply the same definition to the recent-project fast path, the owned-project
   path, and the mixed owned/member project path.
5. Remove asset relation counts from the project selection when they are no
   longer used for project summary serialization.

The response shape stays unchanged. Queries stay batched, avoiding an N+1
asset-count query per project.

## Failure Handling

The grouped asset-count lookup is isolated from the project-list lookup. If it
cannot complete:

- return the project list normally;
- use zero only as the degraded fallback for unavailable counts;
- append an `asset_count_query` warning alongside the existing route warnings;
- do not transform a summary-count failure into a page-level 500 or 503.

The direct Asset lookup does not mutate data and excludes unbound assets.

## Test Design

Add pure helper tests covering:

- one project with direct assets;
- distinct counts for multiple projects;
- a missing project count falling back to zero;
- an unbound (`null`) project ID being ignored.

Add a static route contract test proving that all three listing paths use the
batched direct Asset count and the owned-project path no longer hardcodes its
normal `assetCount` to zero.

Browser QA will read the existing authenticated project, dashboard, and Asset
Library pages only, and compare their visible counts without uploading,
deleting, generating, or editing any asset.

## Scope Boundaries

- No Prisma schema, migration, or database data changes.
- No asset upload, delete, transform, or reassignment behavior changes.
- No Canvas GET/PUT, autosave, project ownership, or membership changes.
- No payment, credits, wallet, billing, Provider, generation, BYOK,
  cn-executor, package, lockfile, or environment changes.
- No Production database mutation beyond authenticated read-only page requests
  used for browser QA.

## Acceptance Criteria

- `/projects`, `/dashboard`, and `/assets` use the same direct-Asset count
  meaning for the current user and selected project.
- A `ProjectAsset` association cannot double-count an Asset in project cards.
- The owned-project list no longer reports zero for a project that has matching
  direct assets.
- A grouped count failure leaves the project list available with a warning.
- Targeted tests, type-check, lint, build, and diff checks pass.
