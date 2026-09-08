# Canvas Secondary Right-Click Node Creation Implementation Plan

**Goal:** Replace the Canvas single-right-click menus with a reliable double-secondary-click node-creation gesture, and make primary-button double-click open the same task picker instead of directly creating Video nodes.

**Architecture:** Keep `VisualCanvasWorkspace` as the orchestration point. Add a small secondary-click sequence helper so timing and target matching are deterministic, then route blank-Canvas interaction to the existing `nodeCreateMenu` and node-card interaction to the existing `nodeAddMenu`.

**Tech Stack:** React, TypeScript, Node test runner, pnpm.

## Tasks

- [ ] Add a focused failing Canvas interaction-boundary test covering the second-click threshold and separate Canvas/node routes.
- [ ] Add a pure secondary-click sequence helper in the Canvas module and make the test pass.
- [ ] Wire Canvas empty-surface and node-card `contextmenu` events through the helper; suppress the legacy single-click node context menu path.
- [ ] Replace the legacy Canvas primary-button double-click Video creation path with the existing `nodeCreateMenu` picker.
- [ ] Keep the `...` node-management control wired to the existing context menu.
- [ ] Run focused tests, type check, lint, build, agent checks, diff checks, and a manual browser acceptance pass before requesting Preview deployment approval.
