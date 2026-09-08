# Canvas Creative Workbench Proportion Design

## Goal

Restore the Canvas task dialog as a usable creative surface while preserving the selected-node workflow. The display node remains compact and the task dialog becomes a wider, centered workbench beneath it.

## Visual Contract

- The selected display node is 380px wide by 194px high at 100% Canvas zoom.
- The task dialog is 760px wide by 292px high at 100% Canvas zoom, centered on the node centerline. This retains the 1:2 node-to-dialog width proportion approved in the layout reference.
- The node navigation stays above the node and is 380px wide, matching the node rather than the dialog.
- The dialog is separated from the node by the existing 8px stack gap and remains stage-aware when Canvas space is constrained.

## Dialog Composition

- The 44px top rail contains the source label, upload action, the "only the input scrolls" hint, and close action on one horizontal line. It never scrolls and does not take prompt-body space beyond its fixed height.
- Remove the separate prompt-meta row. The "creative content" label becomes the prompt field's placeholder/accessible label so the prompt begins immediately below the top rail.
- The prompt field is the only scroll container. Its wrapper does not scroll; all fixed rails stay visible as prompt content grows.
- The prompt field is the visual center and receives the remaining dialog height after fixed rails are measured.
- Model selection, ratio, resolution, duration, audio, credits, and generate controls occupy one fixed 48px horizontal control rail. They do not create a second vertical control row.
- The existing account/source state remains a compact fixed 38px billing rail. No-Key text and the existing provider-settings link remain visible and actionable.

## Behavioral Boundaries

- Preserve generation, BYOK account selection, provider settings link, asset upload/removal, script import/application, local draft behavior, and save behavior.
- Do not modify APIs, persistence, schema, payment, wallet, provider configuration, or Production deployment behavior.

## Validation

- Extend layout tests to assert the 380px node / 760px dialog relationship and stage clamping.
- Extend rendered Chromium checks to assert exactly one prompt scroll container, a one-line top rail, and a one-line fixed control rail.
- Run focused Canvas tests, workspace type checking, lint, production build, and `pnpm agent:check`.
