import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sketchBoard = readFileSync(new URL(
  '../apps/web/src/components/create/StoryboardSketchBoard.tsx',
  import.meta.url,
), 'utf8')
const recipePanel = readFileSync(new URL(
  '../apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx',
  import.meta.url,
), 'utf8')
const workspace = readFileSync(new URL(
  '../apps/web/src/components/create/VisualCanvasWorkspace.tsx',
  import.meta.url,
), 'utf8')
const stateMachine = readFileSync(new URL(
  '../apps/web/src/lib/storyboard/recipe/state-machine.ts',
  import.meta.url,
), 'utf8')

function namedBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0, `${startMarker} should exist`)
  assert.ok(end > start, `${endMarker} should follow ${startMarker}`)
  return source.slice(start, end)
}

test('local storyboard sketch board remains provider-free and bounded to Recipe persistence', () => {
  for (const [name, source] of [
    ['sketch board', sketchBoard],
    ['recipe panel', recipePanel],
    ['state machine', stateMachine],
  ]) {
    assert.doesNotMatch(source, /\bfetch\s*\(|axios|\/api\/generate\//, `${name} must not make generation requests`)
    assert.doesNotMatch(source, /provider(?:Id|Adapter)?|byok/i, `${name} must not use Providers or BYOK`)
    assert.doesNotMatch(source, /billing|credits|wallet|ledger|payment|recharge|checkout/i, `${name} must not use billing`)
  }

  assert.match(sketchBoard, /基于已批准镜头的确定性示意，不调用生成服务。/)
  assert.match(sketchBoard, /恢复本地推演/)
  assert.match(recipePanel, /生成本地草图分镜/)
  assert.match(recipePanel, /onPatchSketchFrame/)
  assert.match(recipePanel, /onRegenerateSketchFrame/)
})

test('workspace uses the existing guarded Recipe commit path for every sketch mutation', () => {
  const create = namedBlock(
    workspace,
    'const handleCreateStoryboardSketchBoard',
    'const handlePatchStoryboardSketchFrame',
  )
  const patch = namedBlock(
    workspace,
    'const handlePatchStoryboardSketchFrame',
    'const handleRegenerateStoryboardSketchFrame',
  )
  const regenerate = namedBlock(
    workspace,
    'const handleRegenerateStoryboardSketchFrame',
    'const handleCreateStoryboardDirectorDraftNodes',
  )

  for (const handler of [create, patch, regenerate]) {
    assert.match(handler, /currentStoryboardRecipeContext/)
    assert.match(handler, /isLiveStoryboardRecipeContext/)
    assert.match(handler, /handleCommitStoryboardDirectorRecipe/)
    assert.doesNotMatch(handler, /createNode|handleRegenerateNodeFromPrompt|openGenerationDialog|fetch\s*\(/)
  }
  assert.match(create, /createRecipeSketchBoard/)
  assert.match(patch, /patchStoryboardSketchFrame/)
  assert.match(regenerate, /regenerateStoryboardSketchFrame/)
})
