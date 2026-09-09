# Confirmed Experience Locks Design

**Status:** Proposed for founder review

## Goal

Turn the founder rule into an enforceable delivery rule:

> Once an interaction or visual arrangement is confirmed and accepted, later work may add capability but must not change, restyle, move, remove, or weaken that accepted behavior unless the founder explicitly approves that exact exception.

This policy complements, rather than replaces, `docs/CANVAS_CORE_FREEZE.md` and `docs/LOCKED_STABLE_MODULES.md`.

## Scope of the Locked Experience Baseline

The following accepted canvas surfaces are frozen as a product experience baseline.

### Canvas node and editor relationship

- A selected node and its editor stay visually associated.
- The editor is placed directly beneath the active node rather than as a canvas-wide panel.
- Node and editor retain the accepted proportional relationship: the editor is wider than its node, with its own bounded surface.
- The node-level navigation sits directly above the active node, not as a detached canvas toolbar.

### Prompt editor structure

- The top actions (source, upload, close) stay in one fixed compact row.
- Only the prompt/content field scrolls when content exceeds its available space.
- Model, parameters, account selection, credits, and generate action remain fixed outside that scrolling field.
- Missing BYOK account guidance remains visible in a compact bottom area.
- Existing generation, BYOK, asset upload, script application, and save behavior remains unchanged.

### Direct manipulation

- Dragging a node drags its associated editor with it when the editor is open.
- Nodes and prompt editor content surfaces can be resized from all four edges and corners.
- Resize affordances use cursor feedback, not permanent visible square handles.
- Resizing changes surface dimensions only. Established control and helper-text font sizes do not scale.

### Context menus

- A single right-click on a node opens its node action menu.
- A single right-click on empty canvas opens the compact canvas menu.
- Node menu supports the accepted actions: open task, save to assets, refresh result, copy node, duplicate, and delete when applicable.
- Canvas menu supports the accepted actions: upload asset, paste node, fit canvas, and reset view.
- Menus remain compact, translucent, and visually isolate the canvas through background blur.
- Native browser context menus must not replace these menus within the canvas, including Safari.

## Change Contract

Every change touching `apps/web/src/components/create/**`, canvas styles, or canvas interaction tests must include a short declaration in its task, pull request, or commit description:

```text
Confirmed experience impact: none
```

If a lock is affected, the declaration must instead name the exact lock and link to the founder's new approval:

```text
Confirmed experience exception: prompt editor fixed-footer layout
Founder approval: <approval record or task link>
```

Generic statements such as "UI cleanup", "responsive improvement", or "shared component refactor" are not exceptions. They do not authorize a visual or behavioral change to a locked surface.

## Enforcement Layers

1. **Repository rule:** Add this change contract and the frozen-surface references to `AGENTS.md`.
2. **Machine-readable registry:** Add a small registry that maps each lock to its owning files and required verification tests.
3. **Automated regression checks:** Keep focused browser tests for node/editor relationship, node drag coupling, resizing, and both context menus. Add source-level guard checks only for invariant wiring that is hard to cover through user interaction.
4. **Delivery gate:** A canvas change cannot be described as complete until type-check, production build, and the mapped browser checks pass. Any exception must be called out before testing begins.

## Non-goals

- This does not freeze the product forever. It provides a deliberate approval path for future redesigns.
- This does not prevent additive tools, providers, or generation capabilities when they preserve locked behavior.
- This does not modify unrelated stable modules or production deployment configuration.

## Migration Plan

1. Add the confirmed-experience registry and link it from `AGENTS.md`.
2. Add a verification manifest with the minimum checks required by each lock.
3. Add or extend focused tests for all registry entries.
4. Run the verification gate before each canvas delivery.

## Acceptance Criteria

- A future contributor can identify every accepted canvas experience rule without reconstructing chat history.
- A canvas change must state whether it affects a confirmed surface.
- Tests cover the user-visible interaction contracts, including Safari context-menu interception.
- Existing implementation remains untouched while the lock mechanism is introduced.
