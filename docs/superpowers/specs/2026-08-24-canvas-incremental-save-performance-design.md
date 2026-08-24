# Canvas Incremental Save Performance Design

## Goal

Reduce cloud-save latency for large Creator City canvases without changing the
canvas UI, Prisma schema, generation routes, Provider/BYOK behavior, billing,
or local-draft recovery.

## Context

The canvas client currently sends the complete node and edge snapshot for every
cloud save. The API reserves the workflow version, then upserts every node in
serial batches of five and upserts every edge. Production QA measured 25.0
seconds for a 100-node first save and 27.8 seconds for an unchanged repeat
save. The repeat result confirms that unchanged rows are rewritten.

Normal editing autosave is local-only. Explicit cloud saves, and the limited
workflow-completion paths that explicitly call `saveCanvas`, use the same cloud
save contract.

## Scope

### Included

- Server-side parameterized PostgreSQL bulk upserts for canvas nodes and edges.
- Client-side tracking of created and modified node and edge identifiers.
- Incremental canvas PUT payloads for normal saves.
- Full-snapshot compatibility for existing browser clients and recovery flows.
- Preservation of optimistic workflow version reservation, partial-save failure
  reporting, deletion acknowledgement, local drafts, and one-pending-save
  coalescing.
- Focused unit/static tests and authenticated browser QA on an isolated QA
  project.

### Excluded

- Prisma schema or migration changes.
- Any payment, credit, wallet, billing, Provider/BYOK, generation route,
  cn-executor, package, environment, or Production database direct change.
- Automatic cloud-save scheduling for ordinary canvas edits.
- Changes to the canvas visual design or node interaction model.

## Architecture

### Request contract

The existing `nodes` and `edges` arrays remain accepted as a full snapshot for
older clients, recovery flows, and explicit full-resync. A new optional
`saveMode` identifies an incremental request:

- `full` (default): `nodes` and `edges` represent the complete canvas and
  retain current semantics.
- `incremental`: `nodes` and `edges` contain only newly created or modified
  entities; `deletedNodeIds` and `deletedEdgeIds` retain their current meaning.

Both request modes include `workflowId`, viewport, and `baseUpdatedAt`. The
server reserves the workflow version before entity writes in either mode.

### Client dirty state

The workspace keeps ref-backed sets for dirty node IDs and dirty edge IDs.
Every local mutation that changes node or edge state marks the affected entity
dirty before local persistence is scheduled. Creation marks the new entity
dirty. Existing deletion queues remain authoritative for removal.

`saveCanvas` constructs an incremental payload from the current snapshot by
selecting only IDs in the dirty sets. It sends `full` only for an initial
unversioned sync, an explicit recovery/full-resync, or when its dirty baseline
is unavailable. A no-op cloud save therefore has empty entity arrays and only
updates the workflow reservation/viewport.

Dirty sets and deletion queues are cleared only after a successful server
acknowledgement. On 409, timeout, 5xx, or malformed acknowledgement, all
pending state remains available for retry and the existing local draft remains
the recovery source.

### Server persistence

The API validates and normalizes the same fields it accepts today. It then
passes normalized node and edge rows to focused data-access helpers that build
parameterized PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE` statements.
The conflict targets remain the existing Prisma unique keys:

- `CanvasNode(workflowId, nodeId)`
- `CanvasEdge(workflowId, edgeId)`

The helpers perform one bulk statement per entity type rather than one Prisma
request per row. Values are parameterized; no user-controlled SQL identifiers
or SQL fragments are constructed. Existing deletion calls remain after entity
writes. An incremental empty entity set skips its bulk statement.

Full and incremental writes retain the current partial-failure policy: if a
write stage fails, the API returns a structured failure and the client does not
consider the save acknowledged. The workflow version reservation is still the
concurrency boundary; no stale write is silently accepted.

## Failure and Recovery Semantics

- **409 conflict:** return `CANVAS_SAVE_CONFLICT`; keep dirty and deleted
  entities locally for the existing user-driven recovery choice.
- **Node, edge, or deletion failure:** return the existing partial-save error
  shape; do not clear client pending state.
- **Database timeout/connection failure:** preserve the local draft and pending
  entity identifiers for retry.
- **Old client/full payload:** process as a full snapshot; no upgrade or data
  migration is required.
- **New client after reload:** use a full snapshot if dirty state cannot be
  trusted; local draft restore remains separate from cloud persistence.

## Test Strategy

1. Unit tests prove payload selection: no-op, one changed node, one changed
   edge, creation, deletion, and a full-resync fallback.
2. Server tests prove that normalized rows use the existing unique identities,
   bulk statements are skipped for empty incremental collections, and full
   payloads remain supported.
3. Existing save-integrity tests continue to prove version reservation,
   acknowledgement-before-clear, partial-failure handling, and coalesced saves.
4. Browser QA on an isolated project covers 20/50/100-node first save, 100-node
   no-op repeat save, one-node edit, deletion, refresh recovery, and a conflict
   recovery path. It must not call a Provider, generation, payment, credit, or
   wallet endpoint.

## Acceptance Criteria

- A normal one-node change does not submit unrelated nodes or edges.
- An unchanged cloud save submits no entity upserts.
- Full snapshot requests remain valid and preserve all entities.
- Deletes are applied only after the workflow reservation succeeds and are not
  cleared locally before a successful acknowledgement.
- A stale `baseUpdatedAt` is rejected with the existing 409 behavior.
- 100-node initial and no-op repeat cloud saves are materially faster than the
  25.0s and 27.8s audited baseline, without a timeout, data loss, or console
  error.
- No forbidden boundary is modified.

## Rollout

Implement and verify locally first, then deploy through the normal main-branch
process only after Founder confirmation. Production browser QA uses an isolated
QA project and does not directly connect to or mutate the database outside the
application API.
