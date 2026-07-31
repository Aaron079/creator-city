# Canvas Creative Workflow Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic next-action guidance to the existing Storyboard Director and compatible-tool recommendation to the existing Node Tool Center without changing tool execution or adding a parallel UI.

**Architecture:** Two pure helpers decide guidance from existing Recipe state and the current node/tool capability state. `StoryboardDirectorRecipePanel` renders the Recipe helper's compact text above its existing footer; `NodeToolCenter` renders the tool helper's optional recommendation above its unchanged grouped list. Both helpers are data-only and cannot create requests or mutate Canvas state.

**Tech Stack:** Next.js client components, TypeScript, Node built-in test runner through `tsx --test`, existing Tailwind utility classes.

---

### Task 1: Deterministic Recipe Guidance

**Files:**
- Create: `apps/web/src/lib/storyboard/recipe/workflowGuidance.ts`
- Create: `apps/web/src/lib/storyboard/recipe/workflowGuidance.test.ts`
- Modify: `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx:176-203, 854-944`

- [ ] **Step 1: Write the failing tests**

```ts
test('guides a stale recipe back to its immutable source', () => {
  const guidance = getStoryboardDirectorWorkflowGuidance(staleRecipe)
  assert.equal(guidance.action, 'focus-source')
  assert.equal(guidance.label, '定位来源并开始新版本')
})

test('guides a ready recipe to materialize reviewed results', () => {
  const guidance = getStoryboardDirectorWorkflowGuidance(completedRecipe())
  assert.equal(guidance.action, 'materialize-grouped')
  assert.equal(guidance.label, '落地审核结果')
})
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/workflowGuidance.test.ts
```

Expected: fails because `workflowGuidance.ts` does not exist.

- [ ] **Step 3: Implement the smallest pure helper**

```ts
export type StoryboardDirectorWorkflowGuidance = {
  tone: 'neutral' | 'warning' | 'ready'
  action: 'focus-source' | 'approve-stage' | 'resolve-findings' | 'materialize-grouped' | 'wait'
  label: string
  detail: string
}

export function getStoryboardDirectorWorkflowGuidance(
  recipe: StoryboardDirectorRecipe,
  options?: { partialBatchBlocked?: boolean },
): StoryboardDirectorWorkflowGuidance
```

It must use `summarizeStoryboardDirectorRecipe()` and preserve priority: stale source, partial-batch blocker, blocking findings, stage approval, materialization, wait. It returns text only.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/workflowGuidance.test.ts
```

- [ ] **Step 5: Render the existing Director guidance**

Import the helper in `StoryboardDirectorRecipePanel.tsx`, derive it after `partialBatchBlocked`, and render a compact, non-interactive status row above the existing footer. Reuse current small type, dark surface, thin borders, and responsive wrapping. Do not add a route, modal, state mutation, or new handler.

- [ ] **Step 6: Add a Director rendered regression**

Use the current Recipe fixture in `StoryboardDirectorPanel.test.tsx` to assert stale source recovery guidance and ready materialization guidance. It must not invoke a materialization callback.

- [ ] **Step 7: Run focused Recipe tests**

```bash
pnpm --filter web exec tsx --test src/lib/storyboard/recipe/workflowGuidance.test.ts src/lib/storyboard/recipe/stateMachine.test.ts src/components/create/StoryboardDirectorPanel.test.tsx
```

### Task 2: Compatible Node Tool Recommendation

**Files:**
- Create: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.ts`
- Create: `apps/web/src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts`
- Modify: `apps/web/src/components/create/canvas/node-tools/NodeToolCenter.tsx:1-78`

- [ ] **Step 1: Write failing recommendation tests**

```ts
test('recommends Storyboard Director for a text node', () => {
  const result = recommendNodeTool({ nodeKind: 'text', hasMediaResult: false, caps: {} })
  assert.equal(result?.actionId, 'storyboard-director')
})

test('recommends compatible camera control for a visual node', () => {
  const result = recommendNodeTool({ nodeKind: 'image', hasMediaResult: true, caps: {} })
  assert.equal(result?.actionId, 'camera-control')
})

test('never recommends an unavailable capability-gated tool', () => {
  const result = recommendNodeTool({ nodeKind: 'image', hasMediaResult: true, caps: {} })
  assert.notEqual(result?.actionId, 'remove-background')
})
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts
```

Expected: fails because `nodeToolRecommendation.ts` does not exist.

- [ ] **Step 3: Implement registry-filtered selection**

```ts
export function availableNodeTools(input: NodeToolRecommendationInput): readonly NodeToolEntry[]
export function recommendNodeTool(input: NodeToolRecommendationInput): NodeToolEntry | null
```

Use existing compatibility rules: kind, media requirement, image-only edit category, and capability gates. Choose `storyboard-director` for text, `camera-control` for compatible visual nodes, then the first available tool. Never return an excluded registry item.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts
```

- [ ] **Step 5: Render one recommendation without hiding alternatives**

Replace component-local registry filtering with `availableNodeTools()`. When a recommendation exists, render a small `推荐下一步` section before existing category sections. Its button invokes the current `onAction` callback. Keep every existing compatible category/tool visible and keep action IDs unchanged.

- [ ] **Step 6: Add a rendered NodeToolCenter regression**

Assert recommendation visibility for text and image inputs, capability-gated exclusion, and callback behavior. Do not assert or trigger a network request.

- [ ] **Step 7: Run focused node tool tests**

```bash
pnpm --filter web exec tsx --test src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts src/components/create/AssetAgentToolbar.test.ts
```

### Task 3: Safety, Full Verification, and Delivery

**Files:**
- Modify: `docs/CURRENT_STATUS.md` only after implementation and verification complete
- Modify: `docs/NEXT_TASKS.md` only after implementation and verification complete

- [ ] **Step 1: Run full focused suite**

```bash
pnpm --filter web exec tsx --test \
  src/lib/storyboard/recipe/workflowGuidance.test.ts \
  src/lib/storyboard/recipe/stateMachine.test.ts \
  src/components/create/StoryboardDirectorPanel.test.tsx \
  src/components/create/canvas/node-tools/nodeToolRecommendation.test.ts \
  src/components/create/AssetAgentToolbar.test.ts
```

Expected: all pass; no Provider, Generate, upload, or billing/payment endpoint is called.

- [ ] **Step 2: Run repository validation**

```bash
pnpm type-check
pnpm lint
pnpm build
git diff --check
```

Expected: type-check and build exit zero; lint may retain documented existing warnings.

- [ ] **Step 3: Audit forbidden boundaries**

```bash
git diff --name-only
```

Expected: no Generate route, Provider/BYOK, billing/payment/credits/wallet, schema/migration, environment, package/lockfile, executor, or API-route file changed.

- [ ] **Step 4: Safe browser QA**

Read-only authenticated Canvas QA: open Storyboard Director, verify visible guidance, select a node, open Tools, verify recommendation and full compatible list, then close. Do not create, save, upload, generate, or invoke a Provider. Record unavailable network evidence as `QA_HARNESS_LIMITATION`.

- [ ] **Step 5: Document, commit, and push verified work**

Commit product/test files separately from the status documents, then push `main`. The status documents must record exact tests, browser evidence, limitations, and forbidden-zone audit.

## Self-Review

- **Spec coverage:** Task 1 handles Director-first action and truthful blocked-state guidance. Task 2 handles compatible node-tool recommendation without a new surface. Task 3 covers safety, verification, QA, documentation, and delivery.
- **Non-goals:** No task adds a route, background process, Provider call, generate action, upload, billing/payment mutation, schema, environment, dependency, or executor change.
- **Type consistency:** The Recipe helper returns `StoryboardDirectorWorkflowGuidance`; the node helper accepts `NodeToolRecommendationInput` and returns existing `NodeToolEntry`, preserving `onAction(actionId)`.
- **Placeholder scan:** No task relies on TBD behavior, generic test instructions, or unspecified paths.
