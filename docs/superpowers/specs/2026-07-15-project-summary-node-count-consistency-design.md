# Project Summary Node Count Consistency Design

## Goal

Make the owned-project list used by `/projects` and `/dashboard` report the same saved Canvas node count as the project overview, without changing Canvas persistence, schema, ownership, or generation behavior.

## Root Cause

`GET /api/projects?scope=owned` intentionally uses a reduced project query so the project list can still load when optional summary relations fail. That branch currently hardcodes `nodeCount: 0`. The project overview uses `/api/projects/[projectId]/summary`, which counts persisted `CanvasNode` rows and therefore reports the correct value.

## Design

Keep the existing reduced owned-project query unchanged. After it succeeds:

1. Collect all selected `CanvasWorkflow.id` values across the returned projects.
2. Run one batched `CanvasWorkflow.findMany` query for those IDs, selecting only `id` and `_count.nodes`.
3. Build a workflow-to-node-count map.
4. Sum the mapped counts for each project's workflows when serializing `nodeCount`.

The project list remains a maximum of 50 projects and the count query remains one database round trip, so this introduces no N+1 behavior.

## Failure Handling

The node-count query is isolated in its own `try/catch`. If it fails:

- return the owned-project list normally;
- use `nodeCount: 0` only as a degraded fallback;
- append a `node_count_query` warning to the existing warnings array;
- do not convert a summary-count failure into a page-level 500/503.

The existing owned-project query failure behavior remains unchanged.

## Test Design

Add a small pure project-summary helper and unit tests covering:

- one workflow with one node;
- multiple workflows summed for one project;
- workflows with zero nodes;
- an empty workflow list;
- missing count rows treated as zero.

Add a static route assertion that the `scope=owned` branch no longer hardcodes its normal-path node count and performs one batched count lookup. Production Chrome QA will verify that `/projects`, `/dashboard`, and project overview all show `1` for the existing QA project after refresh.

## Scope Boundaries

- No Prisma schema or migration changes.
- No Canvas GET/PUT or autosave changes.
- No project ownership or membership changes.
- No asset-count change in this task.
- No payment, credits, wallet, billing, Provider, generation, cn-executor, package, lockfile, or environment changes.
- No Production database mutation beyond the existing read-only page requests used for QA.
