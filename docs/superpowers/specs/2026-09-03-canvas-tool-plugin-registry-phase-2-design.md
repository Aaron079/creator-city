# Canvas Tool Plugin Registry Phase 2 Design

## Goal

Move the existing node-scoped Camera Control and Lighting & Atmosphere setting
access behind a shared plugin-state adapter, while preserving current UI,
storage keys, prompt output, derived-node behavior, and generation behavior.

## Scope

This phase covers only Camera Control and Lighting & Atmosphere. It changes the
client-side path that loads and saves their node-scoped settings, prepares their
prompt contribution input, and copies a selected setting set to a derived node.

It does not introduce a new tool, alter either panel's visual design, or move
settings into the Canvas database payload.

## Non-Goals

- No changes to Canvas save/load protocol, node/edge graph state, or local-draft recovery.
- No API, generation route, Provider/BYOK, billing, credit, payment, schema,
  environment, package, cn-executor, or Production database change.
- No Character, Scene, or Style Bible migration.
- No React-hook rewrite of the two panel components.
- No removal of legacy project-level localStorage keys; they remain read-only
  migration sources for a safe rollback path.

## Current State

`nodeDirectorContextStorage.ts` already stores Camera and Lighting values under
project-and-node-specific localStorage keys. It lazily reads a legacy
project-level key on first access and copies that value to the node key without
deleting the legacy record.

`VisualCanvasWorkspace.tsx` still imports the two storage functions directly in
four distinct flows:

1. selected-node and editing-node changes load panel/chip values;
2. panel `onChange` handlers save values for the locked target node;
3. both generation entry points load values before Phase 1 prompt composition;
4. Camera and Lighting derived-node actions copy the selected values to the new
   child node.

That direct knowledge keeps tool-specific storage concerns inside the Canvas
core even though Phase 1 already centralized prompt contribution ordering.

## Selected Architecture

Add a pure `tool-plugin-state` adapter adjacent to the existing plugin registry.
It owns an ordered map of the two registered state plugins and exposes only
generic operations used by the workspace:

```ts
type RegisteredToolStatePlugin<TValue> = {
  id: 'camera-control' | 'scene-lighting'
  getDefault(): TValue
  load(projectId: string, nodeId: string): TValue
  save(projectId: string, nodeId: string, value: TValue): void
}

loadRegisteredToolState(projectId, nodeId)
saveRegisteredToolState(projectId, nodeId, state)
copyRegisteredToolState(projectId, sourceNodeId, targetNodeId)
```

The returned state has explicit `camera` and `lighting` properties to retain
type safety at current call sites. The adapter delegates to the existing
`nodeDirectorContextStorage` implementation rather than reimplementing key
construction, parsing, defaults, or lazy migration.

Phase 1's `composeRegisteredToolPrompt` remains the only Camera/Lighting prompt
composition entry point. Phase 2 supplies its context using a single adapter
load, preventing divergent Camera and Lighting reads in the workspace.

## Data Flow

1. A node becomes selected or enters the generation dialog.
2. The workspace asks `loadRegisteredToolState(projectId, nodeId)` for both
   values and gives those values to the existing panel/chip state.
3. A panel edits Camera or Lighting. The workspace updates its existing UI
   state, then calls `saveRegisteredToolState` for only that plugin value and
   the locked node identity.
4. A generation path loads the same registered state once and passes it to
   `composeRegisteredToolPrompt`.
5. A derived Camera or Lighting draft uses `copyRegisteredToolState` to copy
   only the originating tool's value to the child node.

The adapter never invokes Canvas graph mutation, cloud save, local draft save,
or generation dispatch. Those remain owned by the frozen workspace core.

## Compatibility and Failure Handling

- Existing per-node keys and legacy project-level migration behavior stay
  unchanged because existing storage functions remain the implementation.
- Missing project/node identity returns the plugin defaults and performs no
  write.
- Malformed or unavailable localStorage is handled by the current safe-default
  behavior; the adapter must not throw into Canvas rendering.
- Camera remains ordered before Lighting in prompt contribution composition.
- Image and Video retain existing contribution behavior; Text remains a
  no-contribution target.
- A derived Camera action copies only Camera settings; a derived Lighting action
  copies only Lighting settings. Neither action changes its source node.

## File Impact

Expected files:

- `apps/web/src/lib/canvas/tool-plugin-state.ts` - typed state adapter and state
  plugin definitions.
- `apps/web/src/lib/canvas/tool-plugin-state.test.ts` - pure state adapter
  contracts using a localStorage test double.
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx` - replace direct
  Camera/Lighting storage calls with the adapter only.
- `apps/web/src/components/create/canvas/toolPluginRegistryBoundary.test.ts` -
  extend static boundary coverage for the adapter migration.
- `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` - closeout only after all
  validation and Production QA complete.

No other source files are planned.

## Test Plan

TDD starts with failing pure tests for:

1. defaults when project/node identity is unavailable;
2. Camera and Lighting values loading independently for the same node;
3. one tool's save never overwriting the other tool's node key;
4. legacy key fallback remains delegated to the existing storage layer;
5. Camera-only and Lighting-only derived copy preserves the source value on the
   target without changing the source;
6. malformed storage reads fall back to defaults without throwing.

Static integration coverage must prove:

1. the workspace has no direct imports of `load*SettingsForNode` or
   `save*SettingsForNode`;
2. both prompt-generation paths still call `composeRegisteredToolPrompt`;
3. both panel `onChange` paths and both derived actions route through the
   adapter;
4. no frozen Canvas save, graph, or generation function changes occur.

Required validation after implementation:

```bash
cd /Users/aaron/creator-city/apps/web
node_modules/.bin/tsx --test \
  src/lib/canvas/tool-plugin-state.test.ts \
  src/lib/canvas/tool-plugin-registry.test.ts \
  src/components/create/canvas/toolPluginRegistryBoundary.test.ts \
  src/lib/canvas/canvasIncrementalSave.test.ts \
  src/lib/canvas/canvasDraftRecovery.test.ts \
  src/components/create/canvas/canvasSaveScheduling.test.ts

cd /Users/aaron/creator-city
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check
git diff --check
```

Browser QA uses an authenticated isolated Canvas project, restores a protected
local draft only after explicit confirmation, modifies and reopens one Image
and one Video node when available, manually saves, reloads, and verifies values
remain node-isolated. It does not click Generate or trigger Provider, payment,
or billing activity. A missing safe Video fixture is reported as a QA harness
limitation, never as a pass.

## Acceptance Criteria

- Camera and Lighting state access in the workspace flows through the adapter.
- Existing localStorage keys, lazy migration, panel UI, prompt output, and
  derived-node drafts remain backward compatible.
- The workspace no longer imports the Camera/Lighting per-node storage helpers.
- Pure and static regression tests pass before implementation is committed.
- Full type-check, lint, build, agent check, and diff check pass.
- No prohibited boundary changes appear in the final diff.
