# Canvas Secondary Right-Click Node Creation Design

## Goal

Make Canvas secondary-click creation intentional. A single right-click performs no Canvas action. Two secondary clicks in quick succession open a task picker for the next node.

## Interaction Contract

- On blank Canvas, the second right-click opens the existing `创建节点` picker at the second click position. Choosing an item creates an independent node at that Canvas position.
- On a node card, the second right-click opens the existing downstream task picker for that node. Choosing an item creates and connects the selected next node.
- A first right-click always suppresses the browser menu and performs no product action.
- The second click must land on the same interaction target within a short threshold. A delayed second click or a click on a different target starts a new sequence rather than opening a picker.
- Native double-click is not used because browsers do not consistently emit it for secondary buttons. The Canvas tracks secondary-click timing directly.
- The node card `...` control remains the explicit home for save, copy, duplicate, and delete. No node-management behavior is removed.

## Scope

- Reuse existing node creation and downstream-task menus, task types, positioning rules, edge creation, model defaults, generation opening, and persistence.
- Do not change node sizing, task-dialog layout, drag behavior, provider/BYOK flows, APIs, database schema, or Production deployment.

## Validation

- Add focused source/interaction boundary tests for the 320ms two-click threshold, Canvas picker opening, node downstream picker opening, and the absence of the legacy single-right-click card menu path.
- Verify the existing Canvas layout and task-dialog tests still pass.
- Perform manual browser acceptance: one right-click produces no UI; double right-click on empty Canvas opens `创建节点`; double right-click on a node opens its connected next-task menu; `...` still opens node management.
