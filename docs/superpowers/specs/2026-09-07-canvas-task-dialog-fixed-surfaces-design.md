# Canvas Task Dialog Fixed Surfaces Design

**Status:** Founder-approved visual direction, pending specification review

## Goal

Refine the existing selected-node **Task** dialog so it is compact, ordered,
and readable without changing any task, generation, Provider, BYOK, billing,
or persistence semantics.

The dialog must remove the present large empty area. The text content is the
only scrollable region; task controls remain fixed and visible while the user
reviews or edits long content.

## Scope

This is a layout-only refinement of the existing Task dialog for Text, Image,
and Video nodes.

It includes:

- the dialog's three fixed/scrolling internal regions;
- compact spacing and visual hierarchy;
- fixed controls for close, local file input, model, task parameters, credit
  indication, and the existing explicit action;
- a bounded text-content area that scrolls internally for long content.

It does not include:

- new task modes, node categories, tools, generation behaviors, or outputs;
- any API route, Provider/BYOK, billing/payment/credit, schema, environment,
  package, executor, or Canvas-save behavior change;
- changing the selected-node navigation, which remains a separate compact bar
  above the node.

## Surface Relationship

The existing selected-node sequence remains visually explicit:

1. compact `Task / Tools / Assets` navigation directly above the selected node;
2. selected display node as the anchor;
3. Task dialog directly below the selected node after the user selects `Task`.

The Task dialog does not merge with the node or the category navigation.

## Dialog Anatomy

The preferred desktop target is approximately `700px × 282px`, subject to the
existing viewport bounds. It uses three rows:

| Region | Behavior | Contents |
| --- | --- | --- |
| Fixed header, 42px | Never scrolls | task identity/mode, existing text-file upload entry, close control |
| Content region, flexible | Only scrollable region | content label and editable prompt/text content |
| Fixed footer, 56px | Never scrolls | existing model selector, applicable task parameter chips, credit indication, explicit action |

The content region may become shorter on a constrained viewport, but must
retain internal scrolling rather than pushing the header or footer out of
view. The dialog itself must not gain a document-level scrollbar.

## Visual Rules

- Use the existing Creator City dark Canvas palette, thin borders, compact
  rectangular corners, and restrained elevation.
- Remove unproductive vertical whitespace. Empty content remains an editable
  input area, not a blank dialog body.
- Keep all controls visible without scrolling; the action stays in the footer
  at the right edge.
- Maintain readable desktop touch/click targets. Do not reduce controls only
  to make room for more decorative material.
- The content input is visually recessed from fixed chrome and uses its own
  internal scrollbar when needed.
- Dialog scrolling cannot move, resize, or obscure its selected source node or
  category navigation.

## Interaction and Safety

- Opening, closing, switching selected node/category, scrolling content, and
  editing unsaved task text remain local UI interactions.
- Existing explicit generation remains explicit; opening this dialog never
  performs generation, Provider, billing, credit, wallet, payment, or Canvas
  save work.
- Close/cancel preserves current existing semantics and must keep its visible
  control available at all scroll positions.
- Existing automatic Canvas panning remains layout-only and excluded from
  Canvas persistence.

## Verification

### Automated

- Render/layout contracts prove fixed header/footer and a single internal
  scroll region.
- Regression coverage preserves compact node navigation positioning and
  existing task action ownership.
- Run targeted Canvas task tests, `pnpm type-check`, `pnpm lint`, web build,
  and `git diff --check`.

### Browser

- At 100% Canvas zoom, select Text, Image, and Video nodes and open `Task`.
- Verify header and footer stay stationary while long content scrolls.
- Verify close, upload, model/parameter controls, credit indication, and the
  explicit action remain usable.
- Verify no dialog overlap with the selected node or category navigation.
- Verify opening/scrolling/closing produces no automatic Canvas PUT,
  generation, Provider, billing, credit, wallet, or payment request.

## Acceptance Criteria

- No oversized blank task-dialog body remains.
- Only content scrolls; header and footer do not move with it.
- The visual relationship is navigation above node, Task dialog below node.
- Existing task inputs and actions remain available and semantically unchanged.
- No forbidden integration or persistence surface changes.
