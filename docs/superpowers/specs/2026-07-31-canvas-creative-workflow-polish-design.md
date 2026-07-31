# Canvas Creative Workflow Polish Design

**Status:** Proposed - awaiting Founder spec approval
**Task:** P1-CANVAS-CREATIVE-WORKFLOW-POLISH
**Date:** 2026-07-31

## Intent

Strengthen the existing Creator City Canvas workflow rather than introduce a parallel product surface. The existing dark canvas, node toolbar, `NodeToolCenter`, Storyboard Director Recipe, and `DirectorToolPanelFrame` remain the visual and interaction foundation.

The product should make the next safe creative action easier to understand after a user selects a node or reviews an approved Recipe stage. It must not autonomously invoke a Provider, generate media, mutate a source node, or charge credits.

## Existing Foundation

- `StoryboardDirectorRecipePanel` already owns the reviewed progression from source through scenes, beats, shots, evidence, approval, grouped materialization, board sync, and draft-node creation.
- `NodeToolCenter` already presents compatible tools by node kind, media availability, and locally declared capabilities.
- The migrated Director tools already share the compact `DirectorToolPanelFrame` language: source context, a live summary, a scrollable body, and an explicit action footer.

This task adds connective guidance only. It does not recreate script-to-storyboard functionality already delivered by Creator Skill Engine Stage C.

## User Experience

### 1. Director-first next action

The existing Storyboard Director Recipe footer gains a compact, context-aware next-action line. It uses the current small type, dark surface, borders, and action-button patterns.

It states the highest-value action that is already available in the current Recipe state, for example:

- approve the current scene, beat, or shot stage;
- resolve a blocking finding before materialization;
- sync the approved shot board;
- create compatible image/video draft nodes after approval;
- focus the immutable source when the Recipe is stale.

The line must explain why an action is unavailable when the state machine blocks it. It must never imply that a blocked action is already complete.

### 2. Explicit handoff from approved shots to existing node tools

When the Recipe has approved shot plans, its existing creation flow should provide a focused, opt-in handoff to an existing compatible node tool after a derived node exists. The handoff is an ordinary selection/focus event, not a new overlay or wizard.

The selected node retains its source and provenance. The user then chooses an existing tool such as Camera Control, Lighting, Lens Lexicon, Prompt Booster, Visual Style, or Asset Variant Planner from the current node toolbar.

### 3. Node tool decision context

For a selected node, `NodeToolCenter` gains a quiet context cue only when a strong deterministic recommendation exists. The cue is based solely on already-known node and Recipe metadata. It does not call an external model or Provider.

Examples:

- an image/video node derived from an approved shot may surface one compatible director-oriented tool first;
- a text or incomplete node continues to show only the tools that are currently available;
- a media-dependent tool remains absent until there is media rather than being shown as a broken option.

The complete grouped tool list remains discoverable and unchanged. A recommendation does not hide alternatives or reorder tools unpredictably.

### 4. Result return and review

Existing tools continue creating explicit derived drafts or preview states. After a tool action succeeds, the workflow returns the user to the selected derived node or the relevant Recipe/board context with a concise confirmation of:

- what was created or prepared;
- which source remains unchanged;
- the next optional review action.

No tool may silently overwrite the selected source node. Closing or cancelling preserves the existing cancellation semantics.

## Visual Constraints

- Reuse the current Canvas dark palette, compact typography, 8px-or-less corners, thin white-alpha borders, existing Lucide iconography, and existing button hierarchy.
- Keep the Canvas dominant. Do not add a full-page wizard, dashboard-style card grid, hero treatment, gradient background, or a second left rail.
- Keep controls in their existing locations: Recipe footer/context area, node tool menu, and existing Director tool panel frame.
- Ensure all text wraps safely at narrow viewport widths; preserve the existing responsive Director workspace behavior.
- Do not introduce new global keyboard shortcuts in this task.

## State and Safety Rules

- Recommendations are deterministic and derived from existing local Canvas/Recipe state only.
- Recommendations must respect current state-machine gates, stale-source handling, partial-batch blockers, media requirements, and capability flags.
- Source nodes remain immutable. Derived identity/provenance, materialization dedupe, board sync, and recovery behavior remain intact.
- No automatic generate request, Provider request, upload, billing/credit/payment mutation, or Canvas save is permitted merely by opening guidance, selecting a recommendation, or opening a tool.
- No schema, migration, API route, Provider/BYOK behavior, generation route, billing, payment, environment, package, or executor change is in scope.

## Likely Implementation Surface

- `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx`
- `apps/web/src/components/create/canvas/node-tools/NodeToolCenter.tsx`
- a small, pure Canvas/Storyboard recommendation helper and focused unit tests, placed beside the existing local state/registry modules
- existing component tests for Director and node tools

Exact files will be confirmed during implementation audit. No product code is changed by this design commit.

## Acceptance Criteria

1. The Director presents exactly one clear next action or blocker explanation for each meaningful Recipe state.
2. Guidance reflects actual state-machine availability and does not enable blocked actions.
3. Recommended node tools are compatible with the selected node and do not hide the existing full tool menu.
4. Opening or reading guidance makes zero generate, Provider, upload, payment, credit, wallet, billing, or Canvas-save requests.
5. Existing source immutability, derived-node provenance, approval, materialization, sync, dedupe, stale-source, and cancel behavior remain unchanged.
6. The experience uses the current Creator City Canvas visual language at desktop and narrow widths.
7. Targeted tests cover the recommendation mapping, blocked states, source-stale state, compatibility filtering, and no-auto-action boundaries.
8. Browser QA uses a safe non-generating flow and records console/network boundaries separately from any harness limitation.

## Verification Plan

1. Record focused red tests for absent/incorrect next-action mapping before implementation.
2. Run targeted component and pure-helper tests after each change.
3. Run `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check`.
4. Audit the diff for prohibited Generate, Provider, BYOK, billing/payment/credits/wallet, schema, environment, package, executor, and API-route changes.
5. Perform local or safe Preview browser QA: open Recipe, verify guidance through blocked/ready states, select a compatible node tool, close without mutation, and record console/network evidence.
6. Production QA is read-only unless a separate explicit safe-write authorization and isolated fixture are available.

## Non-Goals

- A new visual dashboard, a new workflow shell, or a parallel AI Director product.
- Replacing the existing Storyboard Director Recipe or independently callable Creator Skills.
- Autonomous generation, batch generation, background generation, or hidden Provider invocation.
- Any change to account, authentication, database, asset upload, billing, payment, or Provider infrastructure.
