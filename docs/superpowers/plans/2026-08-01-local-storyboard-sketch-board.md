# Local Storyboard Sketch Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing local Storyboard Director so reviewed shot plans deterministically render as editable black-and-white sketch storyboard frames without a Provider call.

**Architecture:** Add a small, typed Shot Grammar layer over the existing approved shot drafts, then derive versioned sketch-frame specifications and SVG markup from it. Persist the recipe's optional sketch board in existing canvas metadata with an explicit backward-compatible parser; the existing Director remains the only review, sync, and materialization surface.

**Tech Stack:** TypeScript, React, existing Creator Skill runtime, Storyboard Director recipe persistence, deterministic SVG rendering, Node/tsx tests.

---

## File Structure

- Create: `apps/web/src/lib/storyboard/sketch/types.ts` — sketch grammar, frame, board, and edit types.
- Create: `apps/web/src/lib/storyboard/sketch/grammar.ts` and `.test.ts` — deterministic composition/blocking/movement derivation and unresolved findings.
- Create: `apps/web/src/lib/storyboard/sketch/renderer.ts` and `.test.ts` — stable SVG render identity and markup.
- Create: `apps/web/src/components/create/StoryboardSketchBoard.tsx` and `.test.tsx` — editable board display integrated into the Director.
- Modify: `apps/web/src/lib/storyboard/recipe/types.ts` — add an optional `sketchBoard` to a version-2 recipe.
- Modify: `apps/web/src/lib/storyboard/recipe/persistence.ts` and `.test.ts` — migrate valid version-1 persisted recipes to a version-2 recipe with no sketch board; validate version-2 board data.
- Modify: `apps/web/src/lib/storyboard/recipe/state-machine.ts` and `.test.ts` — build, patch, invalidate, and regenerate only affected sketch frames.
- Modify: `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx`, `StoryboardDirectorPanel.tsx`, and tests — render sketch-board action/state without creating a duplicate workspace.
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx` and storyboard director lifecycle/materialization tests — persist and restore the recipe unchanged through existing save paths.
- Create: `scripts/local-storyboard-sketch-board-static.test.mjs` — Provider/generation/payment/static boundary.

### Task 1: Define deterministic sketch data and grammar

**Files:**
- Create: `apps/web/src/lib/storyboard/sketch/types.ts`
- Create: `apps/web/src/lib/storyboard/sketch/grammar.ts`
- Create: `apps/web/src/lib/storyboard/sketch/grammar.test.ts`

- [ ] **Step 1: Write failing grammar tests**

```ts
test('derives a wide establishing frame with deterministic subject blocking', () => {
  const frame = deriveStoryboardSketchFrame(approvedShot({ suggestedShotSize: 'wide', subject: '林', action: '走入空旷车站' }))
  assert.equal(frame.composition, 'establishing')
  assert.equal(frame.subjects[0]?.anchor, 'lower-center')
  assert.equal(frame.camera.label, '远景')
})

test('marks an underspecified shot unresolved instead of inventing a subject', () => {
  const frame = deriveStoryboardSketchFrame(approvedShot({ subject: '', action: '气氛紧张' }))
  assert.equal(frame.status, 'needs-review')
  assert.match(frame.notes[0] ?? '', /主体/)
})
```

- [ ] **Step 2: Run the grammar test to establish RED**

Run: `pnpm --filter web exec tsx --test src/lib/storyboard/sketch/grammar.test.ts`

Expected: FAIL because the sketch module does not exist.

- [ ] **Step 3: Implement typed deterministic grammar**

```ts
export type StoryboardSketchFrame = {
  shotId: string; renderKey: string; status: 'ready' | 'needs-review';
  composition: 'establishing' | 'two-shot' | 'single' | 'detail';
  camera: { label: string; angle: 'eye-level' | 'high' | 'low' };
  subjects: Array<{ label: string; anchor: 'lower-left' | 'lower-center' | 'lower-right' }>;
  actionLine: 'none' | 'left-to-right' | 'right-to-left' | 'toward-camera' | 'away-camera';
  movement: 'static' | 'pan' | 'tilt' | 'dolly' | 'zoom' | 'handheld';
  notes: string[];
}

export function deriveStoryboardSketchFrame(shot: RecipeReviewItem<ShotPlanDraft>): StoryboardSketchFrame {
  // Map the approved suggestedShotSize to composition/camera labels, derive action line from explicit action text,
  // and return needs-review when subject/action evidence is missing. Do not use randomness or network calls.
}
```

- [ ] **Step 4: Run grammar tests to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/lib/storyboard/sketch/grammar.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the local grammar layer**

```bash
git add apps/web/src/lib/storyboard/sketch/types.ts apps/web/src/lib/storyboard/sketch/grammar.ts apps/web/src/lib/storyboard/sketch/grammar.test.ts
git commit -m "feat: add local storyboard sketch grammar"
```

### Task 2: Render stable black-and-white sketch SVGs

**Files:**
- Create: `apps/web/src/lib/storyboard/sketch/renderer.ts`
- Create: `apps/web/src/lib/storyboard/sketch/renderer.test.ts`

- [ ] **Step 1: Write failing renderer tests**

```ts
test('same approved grammar input creates the same render key and SVG', () => {
  const frame = readyFrame()
  assert.equal(createSketchRenderKey(frame), createSketchRenderKey(frame))
  assert.equal(renderStoryboardSketchSvg(frame), renderStoryboardSketchSvg(frame))
})

test('a movement change changes only that frame render key', () => {
  assert.notEqual(createSketchRenderKey({ ...readyFrame(), movement: 'pan' }), createSketchRenderKey(readyFrame()))
})
```

- [ ] **Step 2: Run the renderer test to establish RED**

Run: `pnpm --filter web exec tsx --test src/lib/storyboard/sketch/renderer.test.ts`

Expected: FAIL because renderer exports do not exist.

- [ ] **Step 3: Implement deterministic safe SVG rendering**

```ts
export function createSketchRenderKey(frame: Omit<StoryboardSketchFrame, 'renderKey'>) {
  return createCreatorSkillFingerprint('storyboard-sketch-frame', '1.0.0', { sourceNodes: [{ id: frame.shotId, kind: 'text', title: '', prompt: JSON.stringify(frame) }] })
}

export function renderStoryboardSketchSvg(frame: StoryboardSketchFrame) {
  // Escape all labels, draw a white frame/black guides/silhouette rectangles and paths, then return SVG markup.
  // Do not interpolate user text into attributes without escaping.
}
```

- [ ] **Step 4: Run renderer tests to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/lib/storyboard/sketch/renderer.test.ts`

Expected: PASS; output contains no external URLs, scripts, or provider requests.

- [ ] **Step 5: Commit renderer support**

```bash
git add apps/web/src/lib/storyboard/sketch/renderer.ts apps/web/src/lib/storyboard/sketch/renderer.test.ts
git commit -m "feat: render deterministic storyboard sketches"
```

### Task 3: Persist a backward-compatible recipe sketch board

**Files:**
- Modify: `apps/web/src/lib/storyboard/recipe/types.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/persistence.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/recipePersistence.test.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/state-machine.ts`
- Modify: `apps/web/src/lib/storyboard/recipe/stateMachine.test.ts`

- [ ] **Step 1: Write failing migration and invalidation tests**

```ts
test('reads a valid version-1 recipe as version 2 with no sketch board', () => {
  const read = readStoryboardDirectorRecipe({ storyboardDirectorRecipe: validV1Recipe })
  assert.equal(read.status, 'valid')
  assert.equal(read.recipe.schemaVersion, 2)
  assert.equal(read.recipe.sketchBoard, null)
})

test('editing one approved shot invalidates only its sketch frame', () => {
  const next = patchStoryboardSketchFrame(recipeWithTwoFrames, 'scene-001-shot-001', { movement: 'pan' }, NOW)
  assert.equal(next.sketchBoard?.frames[0]?.status, 'stale')
  assert.equal(next.sketchBoard?.frames[1]?.status, 'ready')
})
```

- [ ] **Step 2: Run persistence/state tests to establish RED**

Run: `pnpm --filter web exec tsx --test src/lib/storyboard/recipe/recipePersistence.test.ts src/lib/storyboard/recipe/stateMachine.test.ts`

Expected: FAIL because version 1 is currently the only valid recipe and sketch APIs do not exist.

- [ ] **Step 3: Implement version-2 migration and constrained sketch-board state**

```ts
export const STORYBOARD_DIRECTOR_RECIPE_VERSION = 2 as const
export type StoryboardSketchBoard = { version: 1; recipeRevision: string; frames: StoryboardSketchFrame[]; updatedAt: string }
// Recipe adds sketchBoard: StoryboardSketchBoard | null.

export function readStoryboardDirectorRecipe(metadata: unknown) {
  // Continue accepting schemaVersion 1; clone it to a version-2 recipe with sketchBoard: null.
  // Validate version-2 `sketchBoard` with exact allowed fields, finite bounded collections, unique shot ids, and safe JSON values.
}

export function createRecipeSketchBoard(recipe: StoryboardDirectorRecipe, now: string): StoryboardDirectorRecipe {
  // Require approved/fresh shot stage, derive only approved shots, set render keys, and retain the existing board only when its recipe revision matches.
}
```

- [ ] **Step 4: Run persistence/state tests to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/lib/storyboard/recipe/recipePersistence.test.ts src/lib/storyboard/recipe/stateMachine.test.ts`

Expected: PASS, including legacy persisted Recipe fixtures.

- [ ] **Step 5: Commit compatible persistence**

```bash
git add apps/web/src/lib/storyboard/recipe/types.ts apps/web/src/lib/storyboard/recipe/persistence.ts apps/web/src/lib/storyboard/recipe/recipePersistence.test.ts apps/web/src/lib/storyboard/recipe/state-machine.ts apps/web/src/lib/storyboard/recipe/stateMachine.test.ts
git commit -m "feat: persist local storyboard sketch boards"
```

### Task 4: Integrate editable sketch board into Storyboard Director

**Files:**
- Create: `apps/web/src/components/create/StoryboardSketchBoard.tsx`
- Create: `apps/web/src/components/create/StoryboardSketchBoard.test.tsx`
- Modify: `apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx`
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.tsx`
- Modify: `apps/web/src/components/create/StoryboardDirectorPanel.test.tsx`
- Modify: `apps/web/src/components/create/VisualCanvasWorkspace.tsx`
- Modify: `apps/web/src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts`

- [ ] **Step 1: Write failing UI behavior tests**

```tsx
test('shows Generate sketch board only after the shot stage is approved and fresh', () => {
  const markup = renderToStaticMarkup(createElement(StoryboardDirectorRecipePanel, approvedRecipeProps))
  assert.match(markup, /生成草图分镜/)
  assert.doesNotMatch(renderToStaticMarkup(createElement(StoryboardDirectorRecipePanel, staleRecipeProps)), /生成草图分镜/)
})

test('changing one frame movement commits only that sketch frame', () => {
  const next = patchSketchFrame(board, 'scene-001-shot-001', { movement: 'dolly' })
  assert.equal(next.frames.filter((frame) => frame.renderKey !== board.frames.find((item) => item.shotId === frame.shotId)?.renderKey).length, 1)
})
```

- [ ] **Step 2: Run UI tests to establish RED**

Run: `pnpm --filter web exec tsx --test src/components/create/StoryboardSketchBoard.test.tsx src/components/create/StoryboardDirectorPanel.test.tsx src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts`

Expected: FAIL because the action and component do not exist.

- [ ] **Step 3: Implement the board inside the existing director surface**

```tsx
export function StoryboardSketchBoard({ board, onPatchFrame, onRegenerateFrame }: StoryboardSketchBoardProps) {
  // Render a flow grid grouped by scene. Each card uses the local SVG output, exposes compact selects for framing,
  // angle, subject anchor, action line, and movement, and labels needs-review frames clearly.
  // No nested modal/card stack and no direct fetch call.
}
```

Add `onGenerateSketchBoard` and `onPatchSketchFrame` props through RecipePanel → DirectorPanel → Workspace. In the Workspace, call the state-machine helper, commit recipe metadata through the existing `handleCommitStoryboardDirectorRecipe`, flush local snapshot, and schedule exactly one canvas save. Do not add another board or another persistence path.

- [ ] **Step 4: Run UI tests to establish GREEN**

Run: `pnpm --filter web exec tsx --test src/components/create/StoryboardSketchBoard.test.tsx src/components/create/StoryboardDirectorPanel.test.tsx src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts`

Expected: PASS; a stale recipe disables sketch generation and edits preserve unrelated frame identity.

- [ ] **Step 5: Commit Director integration**

```bash
git add apps/web/src/components/create/StoryboardSketchBoard.tsx apps/web/src/components/create/StoryboardSketchBoard.test.tsx apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx apps/web/src/components/create/StoryboardDirectorPanel.tsx apps/web/src/components/create/StoryboardDirectorPanel.test.tsx apps/web/src/components/create/VisualCanvasWorkspace.tsx apps/web/src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.test.ts
git commit -m "feat: add local storyboard sketch board"
```

### Task 5: Validate performance, boundaries, and production behavior

**Files:**
- Create: `scripts/local-storyboard-sketch-board-static.test.mjs`
- Modify: `docs/CURRENT_STATUS.md`
- Modify: `docs/NEXT_TASKS.md`

- [ ] **Step 1: Write boundary and 100-shot render tests**

```ts
test('renders 100 deterministic sketches without any network dependency', () => {
  const board = createSketchBoard(recipeWithApprovedShots(100), NOW)
  assert.equal(board.sketchBoard?.frames.length, 100)
  assert.equal(board.sketchBoard?.frames.every((frame) => frame.renderKey.startsWith('csf1_')), true)
})

test('static sketch implementation does not reference Provider, generate, payment, credits, or fetch', () => {
  assert.doesNotMatch(source, /\/api\/generate|providerId|payment|credits|fetch\(/)
})
```

- [ ] **Step 2: Run the complete targeted suite**

Run: `pnpm --filter web exec tsx --test src/lib/storyboard/sketch/grammar.test.ts src/lib/storyboard/sketch/renderer.test.ts src/lib/storyboard/recipe/recipePersistence.test.ts src/lib/storyboard/recipe/stateMachine.test.ts src/components/create/StoryboardSketchBoard.test.tsx src/components/create/StoryboardDirectorPanel.test.tsx && node --test scripts/local-storyboard-sketch-board-static.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run repository validation**

Run: `pnpm type-check`

Run: `pnpm lint`

Run: `pnpm build`

Run: `git diff --check`

Expected: type-check/build/diff-check pass; lint may report only documented existing warnings.

- [ ] **Step 4: Perform isolated browser QA**

Verify in a disposable Preview project: create or open a reviewed text Recipe, generate sketches, edit a camera movement, confirm only that card redraws, save, refresh, reopen, verify the board is identical, make an upstream source edit, verify exact stale impact, and confirm no Provider/generate/payment/credit/wallet requests or console errors. Repeat at 20, 50, and 100 shots with no dialog overflow.

- [ ] **Step 5: Commit closeout docs after production verification**

```bash
git add scripts/local-storyboard-sketch-board-static.test.mjs docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
git commit -m "docs: close local storyboard sketch board"
```
