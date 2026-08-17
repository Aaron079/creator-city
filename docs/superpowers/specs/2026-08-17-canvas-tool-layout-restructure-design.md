# Canvas Tool Layout Restructure

**Status:** Approved design

## Goal

Evolve Creator City Canvas into a dense professional workbench without replacing the current node-centered workflow. The work clarifies tool ownership and presentation before extracting tool state from `VisualCanvasWorkspace`.

## Scope

This design covers layout, interaction, migration, and verification contracts for the Canvas tool surfaces. It does not change tool semantics, persisted Canvas data, APIs, Provider/BYOK behavior, generation routes, billing, credits, schema, environment, or executor behavior.

## Four-Zone Layout

### Top Command Bar

Owns project-level commands only: project identity, save state, undo/redo, search, share, and account controls. It must not expose single-node tools.

### Left Project Rail

Owns project and multi-node views only: node navigation, assets, Director, and project views. It must not contain Camera, Lighting, Prompt, Asset, or other single-node tools.

### Center Canvas and Node Toolbar

The Canvas remains the primary work surface. A selected node retains its existing `Task`, `Tools`, and `Asset` entry points as compact contextual controls. Quick actions remain adjacent to their source node.

### Right Inspector

The inspector is bound to the single selected-node context owner. It presents node identity and source state, task inputs, camera and lighting controls, prompt context, local advisory findings, and asset lineage. It never edits a different node than the displayed context.

### Conditional Generation Dock

The dock is visible only for an explicitly selected generation-capable node. It contains input mode, provider status, and the explicit generate action. Opening the dock does not generate, save, or make a Provider call.

## Interaction Contract

- Selecting a node updates exactly one shared selected-node context owner.
- Opening a task or tool panel locks the source identity until the panel closes.
- Source assets remain immutable; derived work remains linked to the source identity.
- Escape and backdrop close only non-processing panels. Explicit save and cancel controls remain available.
- Existing node cards preserve their readable default at 100% Canvas zoom.
- On wide viewports, the inspector is 320–420px wide and collapsible.
- Every dialog is bounded by a 16px viewport margin and uses internal scrolling for overflow.
- On narrow viewports, the project rail collapses and the inspector becomes a viewport-bounded sheet with a fixed close/save footer.
- Video previews remain click-to-load.

## Migration Strategy

1. Introduce the layout shell and one selected-node context boundary without moving behavior.
2. Migrate one existing tool family at a time: Camera, Lighting, Prompt, Storyboard, Reference Extractor, Keyframe Extractor, then Annotation.
3. Remove the corresponding obsolete entry point in the same migration that adds the new one. A single-node tool has one discoverable primary entry point.
4. Preserve each tool's existing identity guard, explicit-save behavior, and Canvas persistence path.
5. Defer plugin-registry extraction until the layout contract is proven by targeted browser and component tests.

## Error and Safety Boundaries

- A closed, cancelled, or opened tool panel must not issue a Canvas PUT, generation request, Provider request, or financial mutation.
- A stale or missing selected node disables editing with a clear local state; it must not retarget a different node.
- Panels processing an explicit local operation retain their source lock and expose a cancel or honest blocked state.
- This task does not enable hidden features or introduce automatic generation.

## Verification Gate

Each migration batch must pass:

1. Node A/B context isolation for Camera, Lighting, Prompt, and migrated tools.
2. Dialog and inspector bounds at 1280×720 and 390×844.
3. Open, cancel, and close paths with zero Canvas PUT requests.
4. Manual save with at most one Canvas PUT request.
5. Zero generation, Provider, payment, billing, credit, wallet, recharge, and checkout mutations.
6. 20/50/100-node render and scheduling checks with no update-depth error, request storm, or automatic video load.
7. Preview safe-write regression before Production read-only smoke. Authenticated Production QA resumes only after the historical Supabase recovery is resolved.

## Non-Goals

- No redesign of the Creator City visual language.
- No changes to generation, Provider, BYOK, billing, credits, database schema, environment, or cn-executor.
- No direct Production database operation.
- No migration of all tools in a single change.
