# Canvas Tool Plugin Registry Phase 3A Design

## Goal

Bring the existing Prompt Booster into the typed Canvas tool-plugin state
registry. This makes a node's selected enhancement suggestion recoverable,
isolated from other nodes, and traceable through the existing derived-node
workflow.

## Scope

- Add a typed `prompt-booster` state plugin beside `camera-control` and
  `scene-lighting`.
- Persist only the selected suggestion identity and title for one
  `projectId + nodeId` identity.
- Restore that selection when the Prompt Booster reopens for the same node.
- Preserve the existing `derivedFromTool: 'prompt-booster'` and derived-edge
  behavior when the user explicitly creates an enhanced version.
- Keep the source node immutable during a derived-node handoff.

## Non-Goals

- Do not change Prompt Booster analysis rules, scoring, suggestions, or panel
  visual design.
- Do not append a suggestion to a generation prompt automatically.
- Do not change generation routes, Provider or BYOK behavior, billing,
  payments, schema, migrations, environment variables, or Production DB.
- Do not migrate Storyboard Director in this phase. It is the follow-up once
  this smaller third-plugin contract is validated.

## State Contract

`RegisteredToolStatePluginId` gains `prompt-booster`. Its state is either
`null` or a frozen selection record containing a suggestion ID and title. The
state is stored locally using a node-scoped identity and has an empty default.
Missing or malformed historical values are treated as no selection.

The registry owns reads, writes, and source-to-derived copies. The panel does
not construct storage keys or directly access localStorage.

## UI and Data Flow

1. Opening Prompt Booster resolves the target node's registered state.
2. Selecting a visible suggestion updates local panel state and persists its
   minimal identity through the registry.
3. Switching the target node loads only that node's state.
4. Creating an enhanced derived node retains the existing explicit prompt
   append and lineage metadata. The source selection is never mutated by the
   copy operation.
5. Reopening after a refresh restores a selection only when the current
   analysis still exposes its stable suggestion ID; otherwise the panel shows
   no selection.

## Failure and Compatibility

- Missing `projectId` or `nodeId` is a no-op with a default empty state.
- Legacy projects without Prompt Booster state keep current behavior.
- A stale or unavailable suggestion is ignored rather than appended.
- Derived-copy reads are non-migrating so a legacy source cannot be changed as
  a side effect of creating a derived node.

## Validation

Focused tests prove default state, node isolation, reload reads, stale
selection rejection, non-mutating source copies, and legacy compatibility.
Existing Prompt Booster interaction tests verify the restored selected state
only enables the existing explicit "create enhanced version" action. Full
type-check, lint, build, agent check, diff check, Preview browser QA, and a
forbidden-zone diff audit are required before implementation completion.
