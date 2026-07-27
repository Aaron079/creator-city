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
const directorPanel = readFileSync(new URL(
  '../apps/web/src/components/create/StoryboardDirectorPanel.tsx',
  import.meta.url,
), 'utf8')
const saveScheduling = readFileSync(new URL(
  '../apps/web/src/components/create/canvas/canvasSaveScheduling.ts',
  import.meta.url,
), 'utf8')
const workspaceLifecycle = readFileSync(new URL(
  '../apps/web/src/components/create/canvas/storyboardDirectorWorkspaceLifecycle.ts',
  import.meta.url,
), 'utf8')
const stateMachine = readFileSync(new URL(
  '../apps/web/src/lib/storyboard/recipe/state-machine.ts',
  import.meta.url,
), 'utf8')
const recipeFiles = [
  '../apps/web/src/lib/storyboard/recipe/types.ts',
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
    const commit = namedBlock(workspace, 'const handleCommitStoryboardDirectorRecipe', 'const currentStoryboardRecipeContext')
    assert.match(start, /planStoryboardDirectorControlNode/)
    assert.match(start, /createNode\(\s*['"]text['"]/)
    assert.match(start, /parentNodeId:\s*sourceNode\.id/)
    assert.doesNotMatch(start, /handleNodePatch\(\s*sourceNode\.id/)
    assert.match(commit, /handleNodePatch\(\s*controlNode\.id/)
    assert.match(commit, /\.\.\.metadataRecord\(controlNode\.metadataJson\)/)
    assert.equal(count(commit, /flushSnapshot:\s*writeStageCCanonicalLocalSnapshot/g), 1)
    assert.doesNotMatch(commit, /flushLocalSnapshot\(\)/)
    assert.equal(count(commit, /scheduleCanvasSave\(/g), 1)
    assert.match(commit, /scheduleCanvasSave\([^)]*\{\s*snapshot:\s*['"]already-flushed['"]\s*\}/)
  })

  test('Recipe opening and review never auto-materialize or auto-generate', () => {
    const open = namedBlock(workspace, 'const handleOpenStoryboardDirectorRecipe', 'const handleCommitStoryboardDirectorRecipe')
    assert.doesNotMatch(open, /createNode|handleRegenerateNodeFromPrompt|pendingAutoGenerate/)
    assert.doesNotMatch(recipePanel, /onAutoGenerate|handleRegenerate|\/api\/generate/)
  })

  test('commit checks active identity and source freshness before bounded persistence', () => {
    const commit = namedBlock(workspace, 'const handleCommitStoryboardDirectorRecipe', 'const handleMaterializeStoryboardDirectorRecipe')
    assert.match(commit, /readStoryboardDirectorRecipe\(controlNode\?\.metadataJson\)/)
    assert.match(commit, /createStoryboardDirectorRecipeRevision/)
    assert.match(commit, /expectedRevision/)
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
    assert.match(stateChange, /if\s*\(activeDirectorRecipe\)[\s\S]*return\s+handleCommitStoryboardDirectorRecipe\(\{[\s\S]*storyboard:\s*next[\s\S]*expectedRevision:\s*activeDirectorRecipeRevision[\s\S]*setDirectorState\(next\)/)
    assert.match(workspace, /if\s*\(activeDirectorRecipe\)\s*return[\s\S]{0,120}writeDirectorState\(directorState,\s*projectId\)/)
    assert.match(workspace, /boardCommitMode=\{activeDirectorRecipe\s*\?\s*['"]buffered['"]\s*:\s*['"]immediate['"]\}/)
    assert.match(directorPanel, /boardCommitMode:\s*['"]immediate['"]\s*\|\s*['"]buffered['"]/)
    assert.doesNotMatch(directorPanel, /boardCommitMode\s*=\s*['"]immediate['"]/)
    assert.doesNotMatch(directorPanel, /onCommitRecipe\?\s*:|onMaterializeGrouped\?\s*:|const\s+NOOP/)
    assert.match(directorPanel, /deferredBoardPatchesRef/)
    assert.match(directorPanel, /let\s+nextState\s*=\s*baseState[\s\S]*commit\(nextState\)/)
    assert.match(directorPanel, /const\s+handleBlur[\s\S]*commitBuffered\(\)/)
    assert.match(directorPanel, /onBlur:\s*handleBlur/)
    assert.match(directorPanel, /skipNextBlur/)
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
    assert.match(materialize, /runStoryboardDirectorCreationBatch/)
    assert.match(materialize, /reserveStoryboardDirectorNodeId/)
    assert.match(materialize, /nodeId,/)
    assert.match(materialize, /completedTargets/)
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
    assert.match(materialize, /completedTargets\.length/)
    assert.match(materialize, /creation\.uncreatedCount/)
    assert.match(materialize, /showCanvasFeedback\(/)
    assert.match(materialize, /recordStoryboardDirectorRecoveryBatch/)
    assert.match(materialize, /attemptStoryboardDirectorRecipeCommit/)
    assert.match(materialize, /['"]grouped-materialization['"]/)
    assert.match(materialize, /installEmergencyDirectorPartialBatch/)
    assert.match(materialize, /recoverLatestRecipe:\s*\(latestRecipe\)\s*=>\s*recordStoryboardDirectorRecoveryBatch\(/)
    assert.match(materialize, /handleCommitStoryboardDirectorRecipe\(recordStoryboardDirectorReceipts/)
    assert.match(materialize, /if\s*\(!persisted\)[\s\S]*0 个未创建/)
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
    assert.match(sync, /storyboardDirectorPartialBatchBlockers/)
    assert.match(sync, /handleCommitStoryboardDirectorRecipe/)
    assert.doesNotMatch(sync, /writeDirectorState/)
    assert.match(drafts, /currentStoryboardRecipeContext/)
    assert.match(drafts, /isLiveStoryboardRecipeContext/)
    assert.match(drafts, /planStoryboardDirectorDraftNodes\([\s\S]*latestNodesRef\.current/)
    assert.match(drafts, /createNode\(plan\.kind/)
    assert.match(drafts, /recordStoryboardDirectorReceipts/)
    assert.equal(count(drafts, /flushLocalSnapshot\(\)/g), 0)
    assert.equal(count(drafts, /scheduleCanvasSave\(/g), 0)
    assert.match(drafts, /recordStoryboardDirectorRecoveryBatch/)
    assert.match(drafts, /runStoryboardDirectorCreationBatch/)
    assert.match(drafts, /reserveStoryboardDirectorNodeId/)
    assert.match(drafts, /['"]draft-node-creation['"]/)
    assert.match(drafts, /handleCommitStoryboardDirectorRecipe\(recordStoryboardDirectorReceipts/)
    assert.match(drafts, /if\s*\(!persisted\)[\s\S]*0 个未创建/)
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
      'emergencyPartialBatch',
      'onAcknowledgeEmergencyPartialBatch',
      'boardCommitMode',
      'boardContextKey',
      'registerDeferredBoardFlush',
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
    assert.doesNotMatch(lifecycle, /setEmergencyDirectorPartialBatches\(\[\]\)|setEmergencyDirectorPartialBatch\(null\)/)
    assert.match(lifecycle, /collectStoryboardDirectorDurableLocks\(nodes/)
    assert.match(lifecycle, /durableLocks\.reduce\(upsertStoryboardDirectorEmergencyLock,\s*current\)/)
    assert.match(lifecycle, /\[flushDirectorBoardDrafts,\s*projectId,\s*workflowId\]/)
    assert.match(lifecycle, /markRecipeSourceMissing/)
    assert.match(lifecycle, /handleNodePatch\(controlNode\.id/)
    assert.doesNotMatch(lifecycle, /deleteNode/)
  })

  test('partial blockers are validated, intelligence-blocking, and explicitly acknowledged', () => {
    assert.match(recipeFiles, /PARTIAL_MATERIALIZATION_BATCH/)
    assert.match(recipeFiles, /createStoryboardDirectorPartialBatchIdentity/)
    assert.match(recipeFiles, /plannedCount/)
    assert.match(recipeFiles, /createdCount/)
    assert.match(recipeFiles, /uncreatedCount/)
    assert.match(recipeFiles, /successfulTargetIds/)
    assert.match(recipeFiles, /acknowledgeStoryboardDirectorPartialBatch/)
    assert.match(recipePanel, /确认已检查此批次/)
    assert.match(recipePanel, /acknowledgeStoryboardDirectorPartialBatch/)
    assert.match(recipePanel, /已创建[\s\S]{0,240}未创建/)
    assert.match(recipePanel, /partialBatchBlocked/)
    assert.match(recipePanel, /disabled=\{!actions\.syncShotBoard\s*\|\|\s*partialBatchBlocked/)
  })

  test('Stage C persistence executes one snapshot and one save transition', () => {
    assert.match(saveScheduling, /snapshot:\s*['"]flush['"]\s*\|\s*['"]already-flushed['"]/)
    assert.match(saveScheduling, /options\?\.snapshot\s*!==\s*['"]already-flushed['"]/)
    assert.match(saveScheduling, /runBoundedCanvasPersistence/)
    assert.match(saveScheduling, /hasPriorMutation/)
    assert.match(saveScheduling, /persistenceOrder\?:\s*['"]flush-first['"]\s*\|\s*['"]schedule-first['"]/)
    assert.match(saveScheduling, /completeEmergencyCanvasAcknowledgment/)
    assert.match(saveScheduling, /createCanvasAutosaveSuppression/)
    assert.match(saveScheduling, /consumeCanvasAutosaveSuppression/)
    assert.match(saveScheduling, /function\s+writeCanonicalCanvasSnapshot/)
    assert.match(saveScheduling, /const\s+serialized\s*=\s*JSON\.stringify\(payload\)/)
    assert.equal(count(saveScheduling, /storage\.setItem\(key,\s*serialized\)/g), 1)
    const schedule = namedBlock(
      workspace,
      'const scheduleCanvasSave',
      'const handleManualSave',
    )
    assert.match(schedule, /completeLocalCanvasSaveSchedule/)
    assert.equal(count(schedule, /flushSnapshot:\s*flushLocalSnapshot/g), 1)
    assert.doesNotMatch(schedule, /flushLocalSnapshot\(\)/)
    const commit = namedBlock(
      workspace,
      'const handleCommitStoryboardDirectorRecipe',
      'const currentStoryboardRecipeContext',
    )
    assert.match(commit, /runBoundedCanvasPersistence/)
    assert.match(commit, /hasPriorMutation:\s*options\.hasPriorCanvasMutation/)
    assert.match(commit, /persistenceOrder:\s*['"]schedule-first['"]/)
    assert.match(commit, /markMutation\(\)[\s\S]*handleNodePatch/)
    assert.match(commit, /resolveStoryboardDirectorRecipeRevision\(/)
    assert.match(commit, /recoverLatestRecipe:\s*options\.recoverLatestRecipe/)
    assert.match(commit, /rollbackControlPatch/)
    assert.equal(count(commit, /flushSnapshot:\s*writeStageCCanonicalLocalSnapshot/g), 1)
    assert.equal(count(commit, /scheduleCanvasSave\(\s*0,\s*\{\s*snapshot:\s*['"]already-flushed['"]\s*\}\s*\)/g), 1)
    const grouped = namedBlock(
      workspace,
      'const handleMaterializeStoryboardDirectorRecipe',
      'const handleSyncStoryboardDirectorShotBoard',
    )
    const drafts = namedBlock(
      workspace,
      'const handleCreateStoryboardDirectorDraftNodes',
      'const handleImportLegacyStoryboardDirectorState',
    )
    assert.match(grouped, /installEmergencyDirectorPartialBatch\([\s\S]*creationAttempted/)
    assert.match(drafts, /installEmergencyDirectorPartialBatch\([\s\S]*creationAttempted/)
    const emergencyAck = namedBlock(
      workspace,
      'const handleAcknowledgeEmergencyDirectorPartialBatch',
      'const focusStoryboardDirectorSource',
    )
    assert.match(emergencyAck, /acknowledgeStoryboardDirectorPartialBatch/)
    assert.match(emergencyAck, /handleCommitStoryboardDirectorRecipe/)
    assert.match(emergencyAck, /clearStoryboardDirectorEmergencyLock/)
    assert.doesNotMatch(emergencyAck, /flushLocalSnapshot|scheduleCanvasSave/)
    assert.match(recipePanel, /onCommitRecipe\(acknowledgeStoryboardDirectorPartialBatch\(/)
  })

  test('Director buffering does not add a shot title editor', () => {
    assert.doesNotMatch(directorPanel, /ariaLabel=["']镜头标题["']/)
    assert.doesNotMatch(directorPanel, /FieldRow label=["']镜头标题["']/)
    assert.match(directorPanel, /ariaLabel=["']情绪["']/)
    assert.match(directorPanel, /ariaLabel=["']导演备注["']/)
  })

  test('derived deletion reconciles every valid Recipe before one bounded delete batch', () => {
    assert.match(workspaceLifecycle, /planStoryboardDirectorReceiptAwareDeletion/)
    assert.match(workspaceLifecycle, /removeStoryboardDirectorReceiptsForTarget/)
    assert.match(workspaceLifecycle, /executeStoryboardDirectorReceiptAwareDeletion/)
    const deletion = namedBlock(workspace, 'const deleteNode', 'useEffect(() => {')
    assert.match(deletion, /planStoryboardDirectorReceiptAwareDeletion/)
    assert.match(deletion, /executeStoryboardDirectorReceiptAwareDeletion/)
    assert.match(deletion, /writeStageCCanonicalLocalSnapshot\(\{\s*nodes:/)
    assert.match(deletion, /scheduleCanvasSave\(\s*0,\s*\{\s*snapshot:\s*['"]already-flushed['"]\s*\}\s*\)/)
    assert.match(deletion, /无法保存 Recipe 回执变更，节点未删除。/)
  })

  test('dirty Recipe board fields flush before every close and switch boundary', () => {
    assert.match(directorPanel, /registerDeferredBoardFlush/)
    assert.match(directorPanel, /flushDeferredBoardDrafts/)
    assert.match(directorPanel, /boardContextKey:\s*string/)
    assert.match(directorPanel, /deferredBoardBaseStateRef/)
    assert.match(directorPanel, /requestClose/)
    assert.doesNotMatch(directorPanel, /onPointerDown=\{\(e\)\s*=>\s*\{\s*e\.stopPropagation\(\);\s*onClose\(\)/)
    assert.match(workspace, /directorDeferredBoardFlushRef/)
    assert.match(workspace, /flushDirectorBoardDrafts/)
    assert.match(workspace, /onClose=\{handleCloseStoryboardDirector\}/)
  })

  test('partial recovery rebases by revision and emergency locks remain canvas-scoped', () => {
    assert.match(recipeFiles, /createStoryboardDirectorRecipeRevision/)
    assert.match(workspace, /recoverLatestRecipe/)
    assert.match(workspace, /executeStoryboardDirectorRecoveryPersistence/)
    assert.match(workspace, /recordStoryboardDirectorRecoveryBatch\(\s*latestRecipe/)
    assert.match(workspace, /persist:\s*\(recoveredRecipe,\s*latestRecipe\)/)
    assert.match(workspace, /expectedRevision:\s*createStoryboardDirectorRecipeRevision\(latestRecipe\)/)
    assert.match(workspaceLifecycle, /selectStoryboardDirectorEmergencyLock/)
    assert.match(workspaceLifecycle, /upsertStoryboardDirectorEmergencyLock/)
    assert.doesNotMatch(
      namedBlock(workspace, '// Storyboard Director Recipe lifecycle', '// End Storyboard Director Recipe lifecycle'),
      /setEmergencyDirectorPartialBatch\(null\)/,
    )
  })

  test('explicit Stage C persistence suppresses only its exact nodes effect revision', () => {
    const autosave = namedBlock(
      workspace,
      'useEffect(() => {\n    latestViewportRef.current',
      '// Flush pending save on page leave',
    )
    assert.match(autosave, /consumeCanvasAutosaveSuppression/)
    assert.match(workspace, /createCanvasAutosaveSuppression/)
    assert.match(workspace, /explicitCanvasAutosaveSuppressionRef/)
  })
})
