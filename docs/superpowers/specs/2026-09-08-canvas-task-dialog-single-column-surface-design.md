# Canvas Task Dialog Single-Column Surface Design

**Status:** Founder-approved direction, pending specification review

## Goal

Restore the approved Canvas relationship for the existing selected-node Task
surface: a compact navigation surface, its display node, then one clean
single-column Task dialog below the node. The dialog must use space for the
editable content rather than leave a split top row and blank half-panel.

## Root Cause

The current `is-compact-fixed-controls` dialog uses a two-column grid for its
first row. The source/reference controls occupy the left column while billing
controls occupy the right column; the prompt body is forced onto a later full
width row. This creates the visible empty right area and disconnects the
prompt from its fixed controls.

## Scope

This is a layout-only correction for the existing Text, Image, and Video Task
dialog. It changes no task inputs, upload behavior, model/parameter choice,
BYOK account state, credit display, generation dispatch, persistence, or
Canvas panning semantics.

It does not change APIs, Provider/BYOK semantics, generation routes,
billing/payment/credits/wallet, schema/migrations, environment, packages,
cn-executor, or Production configuration.

## Surface Relationship

At normal Canvas zoom, the relationship is:

1. compact `任务 / 工具 / 资产` navigation adjacent to the selected display
   node, using the existing selected-node anchor;
2. the selected display node remains visually unobscured;
3. selecting `任务` opens a dialog directly below the display node, with a
   small fixed gap and the existing stage-bounded placement behavior.

The Task dialog matches the navigation surface width on desktop, bounded by
the existing Canvas stage margins. It remains a separate rectangle, never a
merged node or full-width canvas sheet.

## Dialog Anatomy

The desktop dialog remains compact, approximately 700 Canvas units wide and
282 units tall when space permits. It is a single vertical column:

| Region | Height | Behavior | Existing contents |
| --- | --- | --- | --- |
| Fixed header | 42px | Never scrolls | task identity/mode, text/reference upload entry where applicable, close control |
| Fixed context rail | 52px maximum | Never scrolls; horizontal lane only when constrained | existing upstream/reference/script-card state and actions |
| Prompt body | Flexible remainder | The only vertical scroll container | prompt/text label and editable content |
| Fixed action footer | 72px maximum | Never scrolls | existing model, applicable parameter chips, credit indication, account state, and explicit action |

The header and context rail use full dialog width. The footer also uses full
dialog width; its account state remains compact and horizontally reachable,
rather than reserving a second desktop column. Long upstream, reference, or
account content may scroll horizontally in its lane but cannot expand the
dialog vertically or displace the prompt body.

## Visual Rules

- Preserve the Creator City dark Canvas palette, 8px-or-less radius, thin
  borders, and restrained shadow.
- Remove the two-column compact dialog grid completely; no empty companion
  column remains.
- Give the prompt body clear visual priority with a subtle inset, useful empty
  editable area, and its own scrollbar only for overflow.
- Place the close control in the fixed header's right edge.
- Keep upload/reference status in the fixed top context rail, not inside the
  scrolling prompt body.
- Keep the model, parameters, credit/account state, and explicit action in
  the fixed footer. They must not move when a long prompt scrolls.
- On constrained stages, retain the established stage-aware height reduction
  and horizontal control lanes; do not return to a two-column layout.

## Interaction and Safety

- Opening, scrolling, editing, uploading, closing, and switching selected
  nodes retain their current behavior.
- Opening this dialog never performs generation, Provider, billing, credit,
  wallet, payment, or Canvas save work.
- Existing automatic layout panning remains visual-only and excluded from
  Canvas persistence.

## Verification

### Automated

- Add a failing layout contract proving compact Task dialogs are a single
  vertical column, with the prompt body between fixed upper controls and a
  fixed footer.
- Update rendered Chromium coverage for Text, Image, and Video variants.
- Retain existing stage bounds, node/navigation ordering, and no-auto-save
  contracts.

### Browser

- At 100% Canvas zoom, open `任务` on Text, Image, and Video nodes.
- Confirm the dialog is directly below its node and no two-column blank region
  exists.
- Scroll a long prompt and confirm header, context rail, footer, close,
  upload, model, parameters, account state, credit, and action stay fixed.
- Confirm no extra Canvas PUT, generation, Provider, billing, credit, wallet,
  or payment request is issued by layout interactions.

## Acceptance Criteria

- The screenshot's left/right split and unproductive blank area no longer
  exist.
- The visible order is compact navigation, node, then dialog below the node.
- Only the editable prompt body scrolls vertically.
- All existing controls remain fixed and reachable without changing their
  behavior.
- No forbidden integration, persistence, or configuration surface changes.
