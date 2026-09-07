# Canvas Tool Plugin Registry Phase 3A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Prompt Booster's explicitly selected suggestion node-scoped, recoverable, and safely copied into its existing derived-node workflow.

**Architecture:** Extend the typed local tool-state adapter rather than adding a generic metadata store. `PromptBoosterPanel` receives a saved selection and reports explicit user selection changes; `VisualCanvasWorkspace` binds that selection to its locked node identity and existing derived-node handoff. Prompt Booster stays out of generation prompt composition.

**Tech Stack:** TypeScript, React 18, Node test runner through `apps/web/node_modules/.bin/tsx`, Next.js Canvas workspace, localStorage.

---

## File Structure

- Modify: `apps/web/src/lib/canvas/tool-plugin-state.ts` — typed Prompt Booster state, validation, node key, read/write/copy/clear helpers.
- Modify: `apps/web/src/lib/canvas/tool-plugin-state.test.ts` — localStorage contract coverage.
- Modify: `apps/web/src/components/create/PromptBoosterPanel.tsx` — valid selection restoration and explicit callback.
- Modify: `apps/web/src/components/create/PromptBoosterPanel.test.tsx` — rendered restore and stale-selection contracts.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — locked-node registry binding and derived-node copy.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tool-plugin-state.test.ts` — workspace boundary assertions.
- Modify: `docs/CURRENT_STATUS.md` and `docs/NEXT_TASKS.md` — truthful closeout after validation.

### Task 1: Prompt Booster State Contract

**Files:**
- Modify: `apps/web/src/lib/canvas/tool-plugin-state.test.ts`
- Modify: `apps/web/src/lib/canvas/tool-plugin-state.ts`

- [ ] **Step 1: Write failing state tests**

Add these tests using the existing `installStorage()` harness and import `getNodePromptBoosterKey`.

```ts
test('keeps Prompt Booster selection isolated per node and restores it from storage', () => {
  installStorage()
  saveRegisteredToolStateValue(projectId, sourceNodeId, 'prompt-booster', {
    suggestionId: 'composition-depth',
    title: '强化空间层次',
  })

  assert.deepEqual(loadRegisteredToolState(projectId, sourceNodeId).promptBooster, {
    suggestionId: 'composition-depth',
    title: '强化空间层次',
  })
  assert.equal(loadRegisteredToolState(projectId, 'node-other').promptBooster, null)
})

test('rejects malformed Prompt Booster state and copies only to the child node', () => {
  const values = installStorage()
  values.set(getNodePromptBoosterKey(projectId, sourceNodeId), '{broken')
  assert.equal(loadRegisteredToolState(projectId, sourceNodeId).promptBooster, null)

  saveRegisteredToolStateValue(projectId, sourceNodeId, 'prompt-booster', {
    suggestionId: 'lighting-motivation',
    title: '明确光线动机',
  })
  copyRegisteredToolState(projectId, sourceNodeId, childNodeId, 'prompt-booster')

  assert.deepEqual(loadRegisteredToolState(projectId, childNodeId).promptBooster, {
    suggestionId: 'lighting-motivation',
    title: '明确光线动机',
  })
  assert.match(values.get(getNodePromptBoosterKey(projectId, sourceNodeId)) ?? '', /lighting-motivation/)
})
```

- [ ] **Step 2: Run RED test**

```bash
cd /Users/aaron/creator-city/apps/web
./node_modules/.bin/tsx --test src/lib/canvas/tool-plugin-state.test.ts
```

Expected: FAIL because `prompt-booster` and `getNodePromptBoosterKey` do not exist.

- [ ] **Step 3: Implement the smallest typed storage extension**

In `tool-plugin-state.ts`, add:

```ts
export type PromptBoosterSelection = Readonly<{
  suggestionId: string
  title: string
}>

export type RegisteredToolStatePluginId =
  | 'camera-control'
  | 'scene-lighting'
  | 'prompt-booster'

export function getNodePromptBoosterKey(projectId: string, nodeId: string): string {
  return `creator-city:prompt-booster:${projectId}:${nodeId}`
}
```

Add `promptBooster: PromptBoosterSelection | null` to `RegisteredToolPluginState`, use `null` in `getDefaultRegisteredToolState`, and add a save overload. Use this parser:

```ts
function readPromptBoosterSelection(projectId: string, nodeId: string): PromptBoosterSelection | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getNodePromptBoosterKey(projectId, nodeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { suggestionId?: unknown; title?: unknown }
    if (typeof parsed.suggestionId !== 'string' || typeof parsed.title !== 'string') return null
    const suggestionId = parsed.suggestionId.trim()
    const title = parsed.title.trim()
    return suggestionId && title ? { suggestionId, title } : null
  } catch {
    return null
  }
}
```

Load with the parser. Save only trimmed non-empty IDs and titles. Add `clearRegisteredToolStateValue(projectId, nodeId, 'prompt-booster')`, which removes only this target key. In `copyRegisteredToolState`, read with the parser and write a newly allocated object only to the child key; never write a source key.

- [ ] **Step 4: Run GREEN test**

Run the Task 1 Step 2 command. Expected: all existing Camera/Lighting tests and both new Prompt Booster tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/aaron/creator-city
git add apps/web/src/lib/canvas/tool-plugin-state.ts apps/web/src/lib/canvas/tool-plugin-state.test.ts
git commit -m "feat: register prompt booster tool state"
```

### Task 2: Prompt Booster Restore Contract

**Files:**
- Modify: `apps/web/src/components/create/PromptBoosterPanel.test.tsx`
- Modify: `apps/web/src/components/create/PromptBoosterPanel.tsx`

- [ ] **Step 1: Write failing rendered tests**

Render the existing prompt-bearing fixture node with:

```tsx
persistedSelection={{ suggestionId: 'composition-depth', title: '强化空间层次' }}
onSelectionChange={onSelectionChange}
```

Assert the matching suggestion is selected. Render with `{ suggestionId: 'retired-rule', title: '旧建议' }`, assert the primary action is disabled, then click a selected suggestion and assert `onSelectionChange` receives `null`.

- [ ] **Step 2: Run RED test**

Run the existing focused `PromptBoosterPanel.test.tsx` command from `apps/web`. Expected: TypeScript fails because the two new props do not exist.

- [ ] **Step 3: Implement restore and explicit callbacks**

Extend props with:

```ts
persistedSelection?: PromptBoosterSelection | null
onSelectionChange?: (selection: PromptBoosterSelection | null) => void
```

Add this exported helper adjacent to `runAnalysis`:

```ts
export function restorePromptBoosterSelection(
  report: PromptBoostReport | null,
  persistedSelection: PromptBoosterSelection | null | undefined,
): PromptBoosterSelection | null {
  if (!persistedSelection) return null
  const suggestion = report?.suggestions.find((item) => item.id === persistedSelection.suggestionId)
  return suggestion ? { suggestionId: suggestion.id, title: suggestion.title } : null
}
```

When analysis changes, set the selected ID only from this helper. Do not rewrite stale persisted state. Replace the inline suggestion-select callback with a handler that toggles the canonical `{ suggestionId, title }` selection and calls `onSelectionChange`. Clear and dismiss operations call `onSelectionChange(null)` only when they remove the active selection.

- [ ] **Step 4: Run GREEN test**

Run the Task 2 Step 2 command. Expected: valid restore is selected, stale state is inert, and manual deselection reports `null`.

- [ ] **Step 5: Commit**

```bash
cd /Users/aaron/creator-city
git add apps/web/src/components/create/PromptBoosterPanel.tsx apps/web/src/components/create/PromptBoosterPanel.test.tsx
git commit -m "feat: restore prompt booster selections"
```

### Task 3: Canvas Registry Binding

**Files:**
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tool-plugin-state.test.ts`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `apps/web/src/lib/canvas/tool-plugin-state.ts`

- [ ] **Step 1: Write failing workspace boundary assertions**

Assert that the Prompt Booster panel receives `persistedSelection`, writes through:

```ts
saveRegisteredToolStateValue(projectId, nodeId, 'prompt-booster', selection)
```

and that its existing `onCreateDerived` path calls:

```ts
copyRegisteredToolState(projectId, sourceNode.id, node.id, 'prompt-booster')
```

Assert the changed file does not add `/api/generate/video`, `setupBilling`, or Provider adapter usage.

- [ ] **Step 2: Run RED test**

Run the existing focused workspace tool-plugin state test from `apps/web`. Expected: FAIL because no Prompt Booster registry binding exists.

- [ ] **Step 3: Bind the locked node to registered state**

Add `promptBoosterSelection` workspace state with default `getDefaultRegisteredToolState().promptBooster`. In the existing node-scoped state loads in `openNodeScopedTool`, the active-node effect, and the editing-node effect, also load `toolState.promptBooster`.

Pass it to `PromptBoosterPanel` and use this handler:

```tsx
onSelectionChange={(selection) => {
  setPromptBoosterSelection(selection)
  const targetId = lockedNodeToolContext?.targetNodeId ?? null
  if (!projectId || !targetId) return
  if (selection) {
    saveRegisteredToolStateValue(projectId, targetId, 'prompt-booster', selection)
  } else {
    clearRegisteredToolStateValue(projectId, targetId, 'prompt-booster')
  }
}}
```

After the existing Prompt Booster `createNode` call, and before `openCanvasPanel`, copy state only to the child:

```ts
copyRegisteredToolState(projectId, sourceNode.id, node.id, 'prompt-booster')
```

Do not change Prompt Booster's append behavior, derived metadata, `composeRegisteredToolPrompt`, generation handlers, or any API route.

- [ ] **Step 4: Run GREEN tests**

```bash
cd /Users/aaron/creator-city/apps/web
./node_modules/.bin/tsx --test src/lib/canvas/tool-plugin-state.test.ts
./node_modules/.bin/tsx --test src/lib/canvas/tool-plugin-registry.test.ts
```

Then run the focused panel and workspace tests from Tasks 2 and 3. Expected: all pass; source state remains unchanged; child has a copied selection; generation tests are untouched.

- [ ] **Step 5: Commit**

```bash
cd /Users/aaron/creator-city
git add apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/VisualCanvasWorkspace.tool-plugin-state.test.ts apps/web/src/lib/canvas/tool-plugin-state.ts
git commit -m "feat: bind prompt booster to tool registry"
```

### Task 4: Validation and Closeout

**Files:**
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Run project validation**

```bash
cd /Users/aaron/creator-city
pnpm type-check
pnpm lint
pnpm build
pnpm agent:check
git diff --check
```

Expected: type-check, build, agent check, and diff check pass. Existing lint warnings may remain, but no new warning is allowed.

- [ ] **Step 2: Run authenticated Preview browser QA without generation**

Use the `codex/video-gate-qa` Preview account:

1. Select node A, open Prompt Booster, select one suggestion, close and reopen.
2. Select node B and confirm node A's selection is absent.
3. Return to node A and confirm its selection restores.
4. Create a Prompt Booster derived node, verify source prompt remains unchanged and the child retains its existing Prompt Booster lineage.
5. Save, refresh, reopen node A, and confirm restoration.
6. Do not click Generate, configure Provider/BYOK, or use payment.

Classify unavailable browser request enumeration as `QA_HARNESS_LIMITATION`, not a product failure.

- [ ] **Step 3: Run the forbidden-zone audit**

```bash
cd /Users/aaron/creator-city
git diff --name-only 059ee35..HEAD
git diff --check
```

Expected: only Prompt Booster, tool-plugin state/tests, and task documents change. No schema, payment, Provider, generation route, env, package, or executor file appears.

- [ ] **Step 4: Record and commit closeout**

Update both task documents with actual commit SHA(s), tests, Preview SHA/URL, browser result, and any truthful limitation. Mark Phase 3A closed only after the preceding checks pass.

```bash
cd /Users/aaron/creator-city
git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: close tool plugin registry phase 3a"
```

Do not push or deploy until the Founder explicitly confirms the final implementation and documentation commits.
