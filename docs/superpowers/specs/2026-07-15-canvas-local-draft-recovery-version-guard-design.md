# Canvas Local Draft Recovery Version Guard Design

## Problem

Production QA proved that a project with two server nodes could reopen as a stale one-node local draft. The client currently treats a local timestamp that appears newer as permission to render the local snapshot immediately. That turns an ambiguous recovery candidate into the active canvas and exposes a newer server canvas to accidental overwrite.

Local snapshot normalization also accepts a stored `projectId` that differs from the requested project key. Successful cloud saves write synchronized timestamps, but the load path still relies on timestamp ordering alone and can present a clean reload as locally dirty.

## Decision

Use a server-first, explicit-recovery policy.

1. A successful authorized server response is always rendered first.
2. A local record is considered only when its `projectId` matches the requested project and its `workflowId` matches the loaded workflow.
3. A local record is recoverable only when its `updatedAt` is more than 500 ms newer than its own last synchronized/server marker and the current server marker.
4. A recoverable local draft never silently replaces a server canvas, including an empty server canvas. The UI presents an explicit recovery choice.
5. A synchronized local snapshot is an acceleration cache only. It must not create a recovery prompt or dirty save state.
6. Choosing the server keeps the rendered server state and writes only the synchronized cache marker. Choosing recovery applies the local draft and uses the existing guarded cloud-save acknowledgement path.

## Alternatives Rejected

### Always discard local state

This would eliminate stale overwrite risk but lose legitimate offline or failed-save work.

### Automatically merge server and local nodes

Node identity, deletion intent, edge changes, and metadata conflicts make an automatic merge unsafe for this focused fix. It would also expand the task beyond the current recovery protocol.

## Components

### Pure recovery decision helper

Add `apps/web/src/lib/canvas/canvasDraftRecovery.ts`. It receives the requested project/workflow identity, server timestamp, and local version markers, then returns either `server` or `prompt-local-recovery` plus a stable reason. It does not access React, browser storage, or canvas node shapes.

### Local candidate normalization

`VisualCanvasWorkspace` rejects a parsed local record when its stored project ID differs from the storage key being read. The pure decision helper separately rejects workflow mismatches after the authorized server workflow is known.

### Load integration

After an authorized canvas GET succeeds, `VisualCanvasWorkspace` renders server nodes, edges, and viewport. If the helper reports a recoverable draft, the existing local-draft prompt is populated while the server remains visible. Otherwise the client records a synchronized cache and reports `saved`.

The obsolete server-version prompt is not used by this path because it assumes the local version has already replaced the server version. The explicit local recovery prompt becomes the only decision point.

### Recovery dismissal

The secondary prompt action means "keep server version" for both empty and non-empty canvases. It closes the prompt, keeps the server canvas visible, and preserves a synchronized cache marker without issuing a cloud write.

## Error Handling

- Unauthorized or forbidden server responses continue to suppress local rendering.
- Remote load failure keeps the existing local fallback behavior because no authoritative server response is available.
- Invalid dates, missing synchronization markers, project mismatches, and workflow mismatches default to the server.
- Recovery save failures keep the recovered canvas as a local draft and never claim cloud success.

## Tests

Pure tests cover:

- synchronized local state selects the server;
- stale local state selects the server;
- a provably newer unsynced local draft requests explicit recovery;
- newer local state still does not auto-render;
- project and workflow mismatches select the server;
- invalid or missing timestamps select the server;
- an empty server canvas still requires explicit recovery.

A static integration test proves that the workspace calls the helper, renders server data before prompting, rejects mismatched project IDs during normalization, and does not retain the old automatic-local-restore branch.

## Scope Boundary

No schema, migration, API route, generation route, Provider adapter, BYOK behavior, billing, credits, wallet, payment, environment, package, lockfile, `next.config.js`, or `cn-executor` change is allowed.
