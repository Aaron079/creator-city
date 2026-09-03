# Canvas Tool Plugin Registry Phase 1

**Status:** Approved design

## Goal

Establish a small, local Canvas tool-plugin boundary that lets Creator City add professional creative tools without repeatedly embedding tool-specific state and prompt logic in `VisualCanvasWorkspace`.

Phase 1 migrates only the existing Camera Control and Lighting & Atmosphere tools. It preserves their current panels, per-node settings, prompt output, derived-node behavior, and user-visible workflow.

## Scope

The phase introduces a pure TypeScript tool registry and Camera/Lighting plugin adapters. The Canvas core consumes tool capabilities through a constrained interface instead of owning the tools' prompt-contribution rules.

In scope:

- Camera Control and Lighting & Atmosphere plugin definitions.
- A local registry with stable tool identity, node-kind compatibility, prompt contribution, summary, and panel-entry metadata.
- Replacing the two direct core prompt-context decisions with registry resolution.
- Focused compatibility, boundary, and browser tests.

Out of scope:

- Character, Scene, or Style Bible migration.
- Camera or Lighting UI redesign.
- New creative capabilities, model calls, crawlers, or external APIs.
- Save/load, draft recovery, workflow persistence, generation dispatch, Provider/BYOK, payment, credits, schema, environment, package, or executor changes.

## Design

### Registry Contract

`apps/web/src/lib/canvas/tool-plugin-registry.ts` exports a small static registry. A plugin may describe:

- Stable `id`, Chinese label, icon, and applicable node kinds.
- A pure `contributePromptContext` function that returns the tool's existing prompt section for a resolved node setting.
- A pure `buildSummary` function for the derived-node badge and generation context.
- Panel metadata used by the existing node-context entry point.

The registry does not hold React state, access browser storage, create nodes, save Canvas data, call APIs, or dispatch generation. Those responsibilities remain in their existing owners for this phase.

### Camera and Lighting Adapters

Camera and Lighting each provide a plugin adapter around their existing pure helpers:

- Camera uses `buildCameraPromptContext`, `buildCameraSummaryText`, and its current node-level setting resolver.
- Lighting uses `buildSceneLightingPromptContext`, `buildLightingSummaryText`, and its current node-level setting resolver.

Adapters return empty context when no setting is active. Context ordering remains Camera first, Lighting second, matching the current product behavior.

### Core Integration

`VisualCanvasWorkspace` resolves only the registered Camera and Lighting contributions at the two existing generation prompt-assembly sites. It keeps the current project/node identity, node-level storage lookup, append helpers, and generation handoff unchanged.

The existing panel components remain directly rendered in Phase 1 because they own UI lifecycle and source locking. The registry removes duplicated prompt-domain decisions first; panel rendering and state extraction are a later, separate migration.

### Compatibility

- Existing localStorage keys and legacy project-level fallback remain unchanged.
- Existing derived node metadata, labels, source summaries, and edge channels remain unchanged.
- Empty Camera/Lighting settings produce the same prompt as today.
- Image and video continue to use their existing node-kind behavior.

## Safety and Error Handling

- Registry resolution is deterministic and local-only.
- An unknown plugin ID, unsupported node kind, or invalid contribution is ignored rather than blocking generation.
- Plugin functions are pure and receive only explicit context; they cannot mutate Canvas state.
- No registry action may initiate save, generation, network traffic, Provider work, or financial mutation.

## Verification

1. RED tests prove Camera and Lighting context ordering and empty-setting behavior before integration.
2. Unit tests verify the registry exposes exactly the two Phase 1 plugins and rejects unsupported node kinds without output.
3. Static tests verify `VisualCanvasWorkspace` no longer directly builds the two prompt contexts at generation assembly sites.
4. Existing Camera, Lighting, derived-node, and node-context regressions remain green.
5. Full `pnpm type-check`, `pnpm lint`, `pnpm build`, `pnpm agent:check`, and `git diff --check` pass.
6. Preview safe-write QA verifies Camera and Lighting panels, per-node isolation, derived drafts, explicit save, reload recovery, and zero forbidden mutations.
7. Production browser QA verifies the same UI and source-lock behavior without performing a real generation or payment.

## Rollback

The registry is additive and has no data migration. If a compatibility failure is found before release, the implementation can revert to the existing direct helper calls without touching persisted data, settings, or Canvas records.

## Non-Goals

- This phase does not claim that all tool state has left `VisualCanvasWorkspace`.
- This phase does not reduce the core below a line-count target by itself.
- This phase does not enable hidden tools or alter any external integration.
