# Canvas Anchored Dialog and Tool Output Design

**Status:** Founder-approved design, implementation plan ready

## Goal

Make Creator City Canvas feel orderly and professional when a user works from
an image, video, or text display node. The work keeps the current independent
Canvas surfaces, but gives each one a stable size, position, purpose, and
result contract.

The user must be able to read the interaction spatially:

1. select a display node;
2. open one node-level category bar below it;
3. choose one child function inside the compact contextual dialog;
4. complete that action without leaving the source-node context.

## Scope

This design covers:

- node-adjacent display, navigation, child-function, and dialog geometry;
- their opening, positioning, stacking, and closing behavior;
- removal of duplicate node-level navigation;
- tool labels and CTAs that truthfully describe whether the tool adjusts,
  creates, or analyzes content;
- visual and browser verification for the resulting interaction.

This design does not add a feature, change a generation workflow, create a new
Provider integration, or alter persisted node data.

## Relationship to Existing Layout Specification

This document supersedes the **Four-Zone Layout** presentation rules in
`2026-08-17-canvas-tool-layout-restructure-design.md` where they prescribe a
right inspector or a conditional generation dock as the primary node tool
surface.

The following constraints from that document remain in force:

- a selected node has one shared source context owner;
- source assets remain immutable and derived work retains lineage;
- close and cancel paths do not save, generate, or call a Provider;
- video previews remain click-to-load;
- dialogs remain viewport-bounded and preserve a clear close path.

## Surface Model

The following are separate Canvas surfaces. They must not be merged into one
large workbench or have their state stored as one visual component.

### 1. Display Node

The display node remains the visual anchor. It continues to show image, video,
or text content in the existing node-card style.

- Default design target: approximately `420 x 315` at a 100% Canvas view.
- The size is a design target, not a forced migration of existing persisted
  node dimensions.
- It remains readable at 100% and is not enlarged just because a contextual
  panel opens.
- Its header contains only identity and display actions: title, content type,
  preview controls, menu, and close where already applicable. It contains no
  duplicate `Task`, `Tools`, or `Assets` navigation.

### 2. Node Category Navigation

Selecting a display node opens one compact navigation bar centred below it.

- Default target: approximately `700 x 48`.
- It sits `18px` below the display node.
- It is the only node-level category navigation and contains `Task`, `Tools`,
  and `Assets`.
- It identifies the selected node but does not repeat global project actions.
- Project save, share, and account actions remain in the top command bar.
- Background task progress remains status-only and is not another node-tool
  launcher.

### 3. Contextual Operation Dialog

Choosing a category opens an independent, low-height dialog below the
navigation bar. The dialog contains that category's child-function selector as
part of its compact internal content rather than introducing a fourth floating
frame.

- Default target: approximately `700 x 210`.
- It sits `6px` below the node category navigation.
- It is horizontally centred on the display node rather than aligned to a
  screen edge.
- It uses a rectangular, compact layout: function identity and result type on
  the left, child-function choices and inputs in the centre, and one explicit
  CTA on the right.
- A function with fewer controls may reduce the dialog height; it must not
  leave a tall empty prompt area.
- A function changes only the dialog contents, never the placement or size
  relationship of the surrounding three surfaces.

## Opening and Positioning Behavior

1. Selecting a display node opens its node category navigation underneath it.
2. Selecting `Task`, `Tools`, or `Assets` opens the compact dialog below that
   navigation and renders the category-specific child-function choices and
   controls inside it.
3. Selecting a child function replaces only the dialog's context, inputs,
   result label, and CTA.
4. The preferred arrangement is always top-to-bottom: display node, navigation
   bar, dialog.
5. Only the currently selected display node may have this contextual surface
   group open. Selecting another node closes the previous group before opening
   the next one.
6. Closing the navigation, clicking Canvas background, or changing selected
   node closes the navigation and dialog. It does not close or delete the node.
7. If the group would exceed the visible Canvas viewport below the node, the
   Canvas view pans smoothly upward. The dialog must remain below its source
   node rather than flipping above it.
8. Panning or zooming recomputes the group position from the current display
   node. The panels use stable viewport-oriented dimensions and must not become
   disproportionately large or small with Canvas zoom.
9. Existing node locations, dimensions, edges, metadata, and save behavior are
   not changed by contextual-surface positioning.

## Stacking and Visual Language

- The active contextual group has a single elevation scale: display node,
  navigation bar, then dialog.
- Every surface uses the existing dark Canvas language with consistent border,
  shadow, and corner treatment.
- Gaps are fixed at `18px` from display node to navigation bar and `6px` from
  navigation bar to dialog.
- An active surface is fully readable. A surface temporarily obscured by the
  active group is visually reduced to approximately 65% strength rather than
  competing with it.
- No new decorative background treatment, large marketing card, or unrelated
  visual theme is introduced.

## Navigation Ownership

| Surface | Owns | Must not own |
| --- | --- | --- |
| Top command bar | Project identity, save, share, account | Node task/tool/asset actions |
| Node category navigation | `Task`, `Tools`, `Assets` | Project controls or child tools |
| Operation dialog | Child functions, inputs, state, one result-aware CTA | A second navigation system |
| Display-node header | Node identity and media controls | `Task`, `Tools`, or `Assets` |
| Background status surface | Async progress and status | A separate function launcher |

## Truthful Tool Output Contract

Every child function declares one output contract and the UI reflects that
contract before the user opens the operation dialog.

| Contract | Examples | Dialog CTA | Result |
| --- | --- | --- | --- |
| `configuration` | Camera, lighting, look, prompt enhancement | `Apply to task` | Updates explicit task inputs only |
| `structured-text` | Script segmentation, shot list | `Create shot list` | Creates a text node or structured text result |
| `derived-image` | Reference extraction, annotation, grid split | `Create reference node` | Creates a derived image asset/node without overwriting source |
| `derived-video` | A locally available video transformation | Result-specific action | Creates a derived video asset/node |
| `analysis` | Beat analysis, color or keyframe inspection | `Create report` or `Preview` | Creates a report or clearly marked preview |
| `generation` | Image or video production | Result-specific generate action | Creates an output only through an already available generation task |

Rules:

- Configuration tools never present themselves as image, video, or text
  producers. Their CTA is `Apply to task`.
- A production tool shows a result-specific CTA only when it can create the
  promised output in the current environment.
- Generation remains explicit and belongs to the `Task` category. It does not
  run merely because a tool panel was opened.
- If a Provider, permission, or implementation capability is unavailable, the
  dialog shows the honest blocked state and its reason. It must not silently
  fall back to a generic prompt-only panel.
- Analysis and preview tools identify themselves as such. They must not imply
  that a persistent asset was created when only a preview is available.
- Source nodes remain immutable. Any production action creates a new derived
  node or asset with existing lineage conventions.

## Failure and Safety Behavior

- Opening, changing category, selecting a child function, cancelling, and
  closing are UI-only actions. They issue no Canvas PUT, generation request,
  Provider request, payment, billing, credit, wallet, or checkout mutation.
- A missing, stale, or unavailable selected node produces an explicit local
  unavailable state. It must not retarget the dialog to another node.
- A blocked capability keeps the current source context visible and explains
  the condition without exposing secrets, API keys, or connection strings.
- Existing Provider, BYOK, generation-route, payment, credits, billing, schema,
  environment, and executor behavior are unchanged.

## Verification

### Layout and Interaction

- Screenshot and browser checks at 100% Canvas view for text, image, and video
  nodes.
- Verify display-to-navigation and navigation-to-dialog gaps of `18px` and
  `6px` respectively.
- Verify the contextual group stays within viewport bounds after pan, zoom,
  selection changes, and opening close to the lower Canvas boundary.
- Verify automatic Canvas view adjustment keeps the dialog below the display
  node when space is limited.
- Verify only one contextual surface group can be open at a time.
- Verify selecting another node, background click, and explicit close remove
  the prior group without changing node data.

### Navigation and Semantics

- Verify `Task`, `Tools`, and `Assets` appear once in the selected-node flow.
- Verify display headers and background status surfaces do not duplicate those
  entries.
- Verify each registered child function renders the correct output contract,
  label, CTA, and blocked state.
- Verify configuration tools do not expose a false generate CTA.
- Verify production tools create or promise only their declared result type.

### Network, Console, and Performance

- Open, switch, and close flows produce zero Canvas PUT, generation, Provider,
  payment, billing, credit, wallet, recharge, checkout, or automatic video-load
  requests.
- Manual save retains the existing bounded save behavior.
- There are no React key warnings, hydration errors, stale-target errors,
  unhandled rejections, update-depth errors, or request storms.
- Test representative 20, 50, and 100-node canvases so the contextual group
  introduces no visible jank or unnecessary rerender loop.

## Out of Scope

- No new tool, agent, Provider, generation endpoint, database field, migration,
  payment behavior, billing behavior, or external integration.
- No changes to `/api/generate/image`, `/api/generate/video`, BYOK semantics,
  Provider adapters, cn-executor, package files, environment variables, or
  Production database.
- No conversion to a single composite workbench, right inspector, or new dock.
- No automatic generation or hidden feature activation.

## Implementation Success Criteria

The work is complete when a user can open any supported display node and see a
single, visually consistent independent-surface sequence: display node above,
one category-navigation bar below it, and one compact result-aware dialog
below that. The workflow must be visually calm, source-scoped, truthful about
its output, and free of duplicate navigation.
