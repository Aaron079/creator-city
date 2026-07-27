import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

const registry = readFileSync(new URL(
  '../apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts',
  import.meta.url,
), 'utf8')
const toolbar = readFileSync(new URL(
  '../apps/web/src/components/create/AssetAgentToolbar.tsx',
  import.meta.url,
), 'utf8')
const workspace = readFileSync(new URL(
  '../apps/web/src/components/create/VisualCanvasWorkspace.tsx',
  import.meta.url,
), 'utf8')
const recipePanel = readFileSync(new URL(
  '../apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx',
  import.meta.url,
), 'utf8')
const stateMachine = readFileSync(new URL(
  '../apps/web/src/lib/storyboard/recipe/state-machine.ts',
  import.meta.url,
), 'utf8')
const recipeFiles = [
  '../apps/web/src/lib/storyboard/recipe/identity.ts',
  '../apps/web/src/lib/storyboard/recipe/persistence.ts',
  '../apps/web/src/lib/storyboard/recipe/state-machine.ts',
  '../apps/web/src/lib/storyboard/recipe/intelligence.ts',
  '../apps/web/src/components/create/canvas/skills/storyboardDirectorMaterialization.ts',
  '../apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')

function count(source, pattern) {
  return source.match(pattern)?.length ?? 0
}

function namedBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0, `${startMarker} should exist`)
  assert.ok(end > start, `${endMarker} should follow ${startMarker}`)
  return source.slice(start, end)
}

function registryEntry(source, id) {
  const idIndex = source.search(new RegExp(`id:\\s*['"]${id}['"]`))
  assert.ok(idIndex >= 0, `${id} registry entry should exist`)
  const start = source.lastIndexOf('\n  {', idIndex)
  const end = source.indexOf('\n  },', idIndex)
  assert.ok(start >= 0 && end > idIndex, `${id} registry entry should be an object`)
  return source.slice(start, end + '\n  },'.length)
}

describe('Creator Skill Engine Stage C canvas boundary', () => {
  test('Recipe files contain no network, Provider, billing, or generation integration', () => {
    assert.doesNotMatch(recipeFiles, /\bfetch\s*\(|axios|\/api\/generate\//)
    assert.doesNotMatch(recipeFiles, /billing|credits|wallet|ledger|payment|recharge|checkout/iu)
    assert.doesNotMatch(recipeFiles, /providerAdapter|DATABASE_URL|process\.env/)
  })

  test('state machine calls all Skills through the public runtime', () => {
    assert.match(stateMachine, /runWithOwnedInput\(\s*runner,\s*['"]script-segmentation['"]/)
    assert.match(stateMachine, /runWithOwnedInput\(\s*runner,\s*['"]narrative-beat-analysis['"]/)
    assert.match(stateMachine, /runWithOwnedInput\(\s*runner,\s*['"]shot-planning['"]/)
    assert.match(stateMachine, /function\s+runWithOwnedInput[\s\S]*runner\(skillId,\s*runnerInput\)/)
    assert.doesNotMatch(stateMachine, /from\s+['"][^'"]+\/(parser|planner)['"]/)
  })

  test('registers exactly one Text-only Storyboard Director panel tool', () => {
    const entry = registryEntry(registry, 'storyboard-director')
    assert.equal(count(registry, /id:\s*['"]storyboard-director['"]/g), 1)
    assert.match(entry, /label:\s*['"]分镜导演['"]/)
    assert.match(entry, /executionType:\s*['"]panel['"]/)
    assert.match(entry, /supportedKinds:\s*\[\s*['"]text['"]\s*\]/)
    assert.match(entry, /requiresMedia:\s*false/)
    assert.match(entry, /requiresAsset:\s*false/)
    assert.match(entry, /openActionId:\s*['"]storyboard-director['"]/)
  })

  test('toolbar dispatches the Text action to the existing Director boundary', () => {
    assert.match(toolbar, /onOpenStoryboardDirector\?\s*:\s*\(\)\s*=>\s*void/)
    assert.match(toolbar, /case\s+['"]storyboard-director['"]:\s*onOpenStoryboardDirector\?\.\(\)/)
    assert.equal(count(workspace, /<StoryboardDirectorPanel\b/g), 1)
    assert.equal(count(workspace, /const\s+\[storyboardDirectorOpen,\s*setStoryboardDirectorOpen\]/g), 1)
    assert.match(workspace, /onOpenStoryboardDirector=\{\(\)\s*=>\s*handleStartStoryboardDirectorRecipe\(activeNode\.id\)\}/)
  })

  test('workspace discovers valid Recipes and excludes their control nodes from sources', () => {
    const discovery = namedBlock(
      workspace,
      'const availableDirectorRecipes',
      'const activeDirectorRecipe',
    )
    const active = namedBlock(
      workspace,
      'const activeDirectorRecipe',
      'const availableDirectorSources',
    )
    const sources = namedBlock(
      workspace,
      'const availableDirectorSources',
      'const effectiveDirectorState',
    )
    assert.match(discovery, /nodes\.flatMap/)
    assert.match(discovery, /readStoryboardDirectorRecipe\(node\.metadataJson\)/)
    assert.match(discovery, /read\.status\s*===\s*['"]valid['"]/)
    assert.match(active, /activeDirectorControlNodeId/)
    assert.match(active, /readStoryboardDirectorRecipe\(node\?\.metadataJson\)/)
    assert.match(active, /read\.status\s*===\s*['"]valid['"]\s*\?\s*read\.recipe\s*:\s*null/)
    assert.match(sources, /node\.kind\s*===\s*['"]text['"]/)
    assert.match(sources, /readStoryboardDirectorRecipe\(node\.metadataJson\)\.status\s*!==\s*['"]valid['"]/)
  })

  test('workspace creates or patches only the control and derived nodes', () => {
    const start = namedBlock(workspace, 'const handleStartStoryboardDirectorRecipe', 'const handleOpenStoryboardDirectorRecipe')
    const commit = namedBlock(workspace, 'const handleCommitStoryboardDirectorRecipe', 'const handleMaterializeStoryboardDirectorRecipe')
    assert.match(start, /planStoryboardDirectorControlNode/)
    assert.match(start, /createNode\(\s*['"]text['"]/)
    assert.match(start, /parentNodeId:\s*sourceNode\.id/)
    assert.doesNotMatch(start, /handleNodePatch\(\s*sourceNode\.id/)
    assert.match(commit, /handleNodePatch\(\s*controlNode\.id/)
    assert.match(commit, /\.\.\.metadataRecord\(controlNode\.metadataJson\)/)
    assert.equal(count(commit, /flushLocalSnapshot\(\)/g), 1)
    assert.equal(count(commit, /scheduleCanvasSave\(/g), 1)
  })

  test('Recipe opening and review never auto-materialize or auto-generate', () => {
    const open = namedBlock(workspace, 'const handleOpenStoryboardDirectorRecipe', 'const handleCommitStoryboardDirectorRecipe')
    assert.doesNotMatch(open, /createNode|handleRegenerateNodeFromPrompt|pendingAutoGenerate/)
    assert.doesNotMatch(recipePanel, /onAutoGenerate|handleRegenerate|\/api\/generate/)
  })

  test('commit checks active identity and source freshness before bounded persistence', () => {
    const commit = namedBlock(workspace, 'const handleCommitStoryboardDirectorRecipe', 'const handleMaterializeStoryboardDirectorRecipe')
    assert.match(commit, /readStoryboardDirectorRecipe\(controlNode\?\.metadataJson\)/)
    assert.match(commit, /read\.status\s*!==\s*['"]valid['"]/)
    assert.match(commit, /read\.recipe\.recipeId\s*!==\s*nextRecipe\.recipeId/)
    assert.match(commit, /markRecipeSourceFreshness/)
    assert.match(commit, /markRecipeSourceMissing/)
    assert.doesNotMatch(commit, /writeDirectorState|setDirectorState/)
  })

  test('cloud Recipe board wins while manual Director remains local', () => {
    const effective = namedBlock(workspace, 'const effectiveDirectorState', 'const legacyDirectorState')
    const stateChange = namedBlock(workspace, 'onStateChange={(next)', 'onActiveShotChange')
    assert.match(effective, /activeDirectorRecipe\s*\?\s*activeDirectorRecipe\.storyboard\s*:\s*directorState/)
    assert.match(workspace, /const\s+legacyDirectorState\s*=\s*readLegacyDirectorState\(projectId\)/)
    assert.match(stateChange, /if\s*\(activeDirectorRecipe\)[\s\S]*handleCommitStoryboardDirectorRecipe\(\{[\s\S]*storyboard:\s*next[\s\S]*\}\)[\s\S]*else\s*\{[\s\S]*setDirectorState\(next\)/)
    assert.match(workspace, /if\s*\(activeDirectorRecipe\)\s*return[\s\S]{0,120}writeDirectorState\(directorState,\s*projectId\)/)
  })

  test('grouped apply revalidates identity before creation and uses evolving occupancy', () => {
    const materialize = namedBlock(
      workspace,
      'const handleMaterializeStoryboardDirectorRecipe',
      'const handleSyncStoryboardDirectorShotBoard',
    )
    const firstCreate = materialize.indexOf("createNode('text'")
    const liveCheck = materialize.indexOf('isLiveStoryboardRecipeContext')
    assert.ok(liveCheck >= 0 && liveCheck < firstCreate, 'live identity check must precede grouped creation')
    assert.match(materialize, /planStoryboardDirectorGroupedNodes\([\s\S]*latestNodesRef\.current/)
    assert.match(materialize, /const\s+occupancy\s*=\s*\[\.\.\.latestNodesRef\.current\]/)
    assert.match(materialize, /resolveNonOverlappingPosition\([\s\S]*occupancy/)
    assert.match(materialize, /occupancy\.push\(node\)/)
    assert.match(materialize, /completed\.push\(receiptFromCreatedPlan/)
    assert.match(materialize, /recordStoryboardDirectorReceipts\([\s\S]*completed/)
    assert.equal(count(materialize, /flushLocalSnapshot\(\)/g), 0)
    assert.equal(count(materialize, /scheduleCanvasSave\(/g), 0)
    assert.doesNotMatch(materialize, /deleteNode|pendingAutoGenerateIds|handleRegenerateNodeFromPrompt/)
  })

  test('partial grouped failure reports exact counts and locks blind rerun', () => {
    const materialize = namedBlock(
      workspace,
      'const handleMaterializeStoryboardDirectorRecipe',
      'const handleSyncStoryboardDirectorShotBoard',
    )
    assert.match(materialize, /completed\.length/)
    assert.match(materialize, /plans\.create\.length\s*-\s*completed\.length/)
    assert.match(materialize, /showCanvasFeedback\(/)
    assert.match(materialize, /setStoryboardDirectorMaterializationLocked\(true\)/)
    assert.doesNotMatch(materialize, /catch[\s\S]*deleteNode/)
  })

  test('sync and draft apply are explicit, fresh, and persist one successful batch', () => {
    const sync = namedBlock(
      workspace,
      'const handleSyncStoryboardDirectorShotBoard',
      'const handleCreateStoryboardDirectorDraftNodes',
    )
    const drafts = namedBlock(
      workspace,
      'const handleCreateStoryboardDirectorDraftNodes',
      'const handleImportLegacyStoryboardDirectorState',
    )
    assert.match(sync, /currentStoryboardRecipeContext/)
    assert.match(sync, /isLiveStoryboardRecipeContext/)
    assert.match(sync, /planStoryboardDirectorShotBoardSync/)
    assert.match(sync, /handleCommitStoryboardDirectorRecipe/)
    assert.doesNotMatch(sync, /writeDirectorState/)
    assert.match(drafts, /currentStoryboardRecipeContext/)
    assert.match(drafts, /isLiveStoryboardRecipeContext/)
    assert.match(drafts, /planStoryboardDirectorDraftNodes\([\s\S]*latestNodesRef\.current/)
    assert.match(drafts, /createNode\(plan\.kind/)
    assert.match(drafts, /recordStoryboardDirectorReceipts/)
    assert.equal(count(drafts, /flushLocalSnapshot\(\)/g), 0)
    assert.equal(count(drafts, /scheduleCanvasSave\(/g), 0)
    assert.match(drafts, /handleCommitStoryboardDirectorRecipe\(recordStoryboardDirectorReceipts/)
    assert.doesNotMatch(drafts, /pendingAutoGenerateIds|handleRegenerateNodeFromPrompt|openGenerationDialog/)
  })

  test('legacy import is explicit and cannot overwrite a nonempty cloud board', () => {
    const legacy = namedBlock(
      workspace,
      'const handleImportLegacyStoryboardDirectorState',
      'const focusStoryboardDirectorSource',
    )
    assert.match(legacy, /readLegacyDirectorState\(projectId\)/)
    assert.match(legacy, /activeDirectorRecipe\.storyboard\.shots\.length/)
    assert.match(legacy, /importLegacyShotBoard/)
    assert.match(legacy, /handleCommitStoryboardDirectorRecipe/)
    assert.doesNotMatch(legacy, /writeDirectorState/)
  })

  test('wired Director receives required Recipe integration props and global open creates nothing', () => {
    const rendered = namedBlock(workspace, '<StoryboardDirectorPanel', '/>')
    for (const prop of [
      'recipe',
      'openedFromRecipe',
      'availableSources',
      'availableRecipes',
      'saveState',
      'legacyState',
      'onStartRecipe',
      'onOpenRecipe',
      'onCommitRecipe',
      'onFocusSource',
      'onMaterializeGrouped',
      'onSyncShotBoard',
      'onCreateDraftNodes',
      'onImportLegacy',
    ]) {
      assert.match(rendered, new RegExp(`${prop}=`), `${prop} should be wired`)
    }
    const globalOpen = namedBlock(
      workspace,
      'const handleOpenGlobalStoryboardDirector',
      'const handleStartStoryboardDirectorRecipe',
    )
    assert.match(globalOpen, /setStoryboardDirectorOpenedFromRecipe\(false\)/)
    assert.match(globalOpen, /setStoryboardDirectorOpen\(true\)/)
    assert.doesNotMatch(globalOpen, /createNode|handleStartStoryboardDirectorRecipe/)
  })

  test('active control deletion and canvas identity changes close stale Recipe context', () => {
    const lifecycle = namedBlock(
      workspace,
      '// Storyboard Director Recipe lifecycle',
      '// End Storyboard Director Recipe lifecycle',
    )
    assert.match(lifecycle, /activeDirectorControlNodeId/)
    assert.match(lifecycle, /nodes\.some\(\(node\)\s*=>\s*node\.id\s*===\s*activeDirectorControlNodeId\)/)
    assert.match(lifecycle, /setActiveDirectorControlNodeId\(['"]['"]\)/)
    assert.match(lifecycle, /setStoryboardDirectorOpen\(false\)/)
    assert.match(lifecycle, /setStoryboardDirectorMaterializationLocked\(false\)/)
    assert.match(lifecycle, /\[projectId,\s*workflowId\]/)
    assert.match(lifecycle, /markRecipeSourceMissing/)
    assert.match(lifecycle, /handleNodePatch\(controlNode\.id/)
    assert.doesNotMatch(lifecycle, /deleteNode/)
  })
})
