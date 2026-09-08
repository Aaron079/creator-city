# Canvas Context Menus Design

**Goal:** Replace the current double-right-click creation behavior with two single-right-click, compact glass menus whose controls perform real Canvas actions.

## Visual Contract

- Both menus are a `216px`-wide, single-column glass surface with a 16px radius.
- Menu backgrounds stay translucent. The Canvas behind an open menu is softly blurred; there is no extra panel, widened container, or opaque overlay.
- Menu type is small and medium weight: 13px header, 14px row labels, 38px row height.
- Existing node, task-dialog, navigation, and resize layouts remain unchanged.

## Node Menu

A single right-click on a node selects it and opens its contextual menu at the pointer location. It contains:

1. `打开任务`: opens that node's existing task dialog.
2. `保存到素材库`: enabled only for a node with a persisted asset; it opens the matching asset in the existing asset library. Nodes without a persisted asset show the row disabled rather than accepting a no-op click.
3. `刷新结果`: enabled only for generated media; refreshes its existing resolved asset URL without running a paid generation.
4. `复制节点`: stores the node in the existing Canvas clipboard.
5. `创建副本`: calls the existing duplicate-node path.
6. `删除节点`: opens a browser confirmation before calling the existing deletion path.

## Blank Canvas Menu

A single right-click on an unoccupied Canvas location opens a menu at the pointer location. It contains:

1. `上传素材`: opens the existing Canvas material upload picker at that Canvas location.
2. `粘贴节点`: enabled only when the existing Canvas clipboard contains a node; creates the copy at the right-clicked world location.
3. `适应画布`: calls the existing fit-canvas view action.
4. `重置视图`: calls the existing reset-canvas view action.

It intentionally has no node-creation controls. Double-left-click node creation remains untouched.

## Behavior and Safety

- Opening either menu closes the other transient Canvas menus.
- Clicking outside or pressing Escape closes it.
- The blur layer has no pointer events, so it cannot block Canvas controls.
- Every menu item either invokes a real operation or is visibly disabled with an explanatory title. No placeholder feedback actions are allowed.

## Verification

- Unit tests verify one right-click opens the correct menu and the old two-right-click sequence is no longer required for node or blank Canvas menus.
- Browser-rendered tests verify both menu widths, translucent style, backdrop blur, row density, and disabled states.
- Interaction tests verify each enabled operation calls its concrete handler, while deletion requires confirmation.
