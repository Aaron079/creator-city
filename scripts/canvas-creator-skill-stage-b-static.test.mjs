import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

const registry = readFileSync(new URL(
  '../apps/web/src/components/create/canvas/node-tools/nodeToolRegistry.ts',
  import.meta.url,
), 'utf8')
const modalTypes = readFileSync(new URL(
  '../apps/web/src/components/canvas/modal/canvasModalTypes.ts',
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
const narrativePanel = readFileSync(new URL(
  '../apps/web/src/components/create/canvas/skills/NarrativeBeatAnalysisPanel.tsx',
  import.meta.url,
), 'utf8')
const shotPanel = readFileSync(new URL(
  '../apps/web/src/components/create/ShotListBuilderPanel.tsx',
  import.meta.url,
), 'utf8')

function count(source, pattern) {
  return source.match(pattern)?.length ?? 0
}

function registryEntry(source, id) {
  const idIndex = source.search(new RegExp(`id:\\s*['"]${id}['"]`))
  assert.ok(idIndex >= 0, `${id} registry entry should exist`)
  const start = source.lastIndexOf('\n  {', idIndex)
  const end = source.indexOf('\n  },', idIndex)
  assert.ok(start >= 0 && end > idIndex, `${id} registry entry should be an object`)
  return source.slice(start, end + '\n  },'.length)
}

function namedBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0, `${startMarker} should exist`)
  assert.ok(end > start, `${endMarker} should follow ${startMarker}`)
  return source.slice(start, end)
}

function assertGroupedApply(block, {
  edgeLabel,
  edgeToolId,
  edgeToolIcon,
  sourceGuard,
}) {
  const guardReturn = block.indexOf('return', block.indexOf('if ('))
  const firstCreate = block.indexOf("createNode('text'")
  assert.match(block, /latestNodesRef\.current\.find/)
  assert.match(block, /currentSource\.kind\s*!==\s*['"]text['"]/)
  assert.match(block, sourceGuard)
  assert.ok(guardReturn > 0 && guardReturn < firstCreate, 'stale guard must return before createNode')
  assert.match(block, /const\s+occupancy\s*=\s*\[\.\.\.latestNodesRef\.current\]/)
  assert.match(block, /resolveNonOverlappingPosition\([\s\S]*?,\s*occupancy\s*\)/)
  assert.match(block, /const\s+createdNode\s*=\s*createNode\(\s*['"]text['"]/)
  assert.match(block, /occupancy\.push\(createdNode\)/)
  assert.match(block, /title:\s*plan\.title/)
  assert.match(block, /prompt:\s*plan\.prompt/)
  assert.match(block, /metadataJson:\s*plan\.metadataJson/)
  assert.match(block, new RegExp(`edgeLabel:\\s*['"]${edgeLabel}['"]`))
  assert.match(block, new RegExp(`edgeToolId:\\s*['"]${edgeToolId}['"]`))
  assert.match(block, new RegExp(`edgeToolIcon:\\s*['"]${edgeToolIcon}['"]`))
  assert.equal(count(block, /flushLocalSnapshot\(\)/g), 1)
  assert.equal(count(block, /scheduleCanvasSave\(0\)/g), 1)
  assert.doesNotMatch(block, /handleNodePatch|commitNodes\([\s\S]*currentSource/)
}

describe('Creator Skill Engine Stage B canvas wiring', () => {
  test('registers narrative analysis and retains one Shot List Builder without a duplicate planning tool', () => {
    const narrative = registryEntry(registry, 'narrative-beat-analysis')
    assert.match(narrative, /label:\s*['"]叙事节拍分析['"]/)
    assert.match(narrative, /supportedKinds:\s*\[\s*['"]text['"]\s*\]/)
    assert.match(narrative, /openActionId:\s*['"]narrative-beat-analysis['"]/)

    const shot = registryEntry(registry, 'shot-list-builder')
    assert.match(shot, /label:\s*['"]分镜清单生成器['"]/)
    assert.match(shot, /supportedKinds:\s*\[\s*['"]text['"]\s*\]/)
    assert.match(shot, /openActionId:\s*['"]shot-list-builder['"]/)
    assert.equal(count(registry, /id:\s*['"]shot-list-builder['"]/g), 1)
    assert.equal(count(registry, /id:\s*['"]shot-planning['"]/g), 0)
  })

  test('modal and toolbar dispatch both Stage B actions', () => {
    assert.match(modalTypes, /\|\s*['"]narrative-beat-analysis['"]/)
    assert.match(toolbar, /onOpenNarrativeBeatAnalysis\?\s*:\s*\(\)\s*=>\s*void/)
    assert.match(toolbar, /onOpenShotListBuilder\?\s*:\s*\(\)\s*=>\s*void/)
    assert.match(toolbar, /case\s+['"]narrative-beat-analysis['"]\s*:\s*onOpenNarrativeBeatAnalysis\?\.\(\)/)
    assert.match(toolbar, /case\s+['"]shot-list-builder['"]\s*:\s*onOpenShotListBuilder\?\.\(\)/)
  })

  test('narrative opening freezes a complete Text source snapshot', () => {
    const open = namedBlock(
      workspace,
      'const openNarrativeBeatAnalysis',
      'const handleApplyNarrativeBeatPlans',
    )
    assert.match(open, /node\.kind\s*!==\s*['"]text['"][^\n]*return/)
    assert.match(open, /Object\.freeze/)
    for (const field of ['id', 'kind', 'title', 'prompt', 'resultText', 'metadataJson']) {
      assert.match(open, new RegExp(`\\b${field}:`))
    }
    assert.match(open, /openNodeScopedTool\(\s*['"]narrative-beat-analysis['"]/)
  })

  test('narrative grouped apply is stale-safe, source-immutable, and persistence-bounded', () => {
    const apply = namedBlock(
      workspace,
      'const handleApplyNarrativeBeatPlans',
      'const handleApplyShotPlans',
    )
    assertGroupedApply(apply, {
      edgeLabel: '叙事节拍',
      edgeToolId: 'narrative-beat-analysis',
      edgeToolIcon: '◆',
      sourceGuard: /currentSourceText\s*!==\s*analyzedSourceText/,
    })
  })

  test('shot grouped apply is stale-safe, source-immutable, and persistence-bounded', () => {
    const apply = namedBlock(
      workspace,
      'const handleApplyShotPlans',
      'const handleCreateCompatibilityShotNode',
    )
    assertGroupedApply(apply, {
      edgeLabel: '镜头规划',
      edgeToolId: 'shot-planning',
      edgeToolIcon: '◇',
      sourceGuard: /!shotPlansMatchCurrentSource/,
    })
  })

  test('compatibility creation scans current metadata and returns only newly created IDs', () => {
    const compatibility = namedBlock(
      workspace,
      'const handleCreateCompatibilityShotNode',
      'useEffect(() => {',
    )
    assert.match(compatibility, /latestNodesRef\.current/)
    assert.match(compatibility, /metadataJson/)
    assert.match(compatibility, /skillId/)
    assert.match(compatibility, /runFingerprint/)
    assert.match(compatibility, /resultId/)
    assert.match(compatibility, /return\s+['"]['"]/)
    assert.match(compatibility, /return\s+createdNode\.id/)
    assert.doesNotMatch(compatibility, /setPendingAutoGenerateIds/)
  })

  test('explicitly confirmed mixed batches dispatch image and video once and retain undispatched IDs', () => {
    const queueEffect = namedBlock(
      workspace,
      'useEffect(() => {\n    const queuedIds = pendingAutoGenerateIdsRef.current',
      'const assetResolveKey',
    )
    assert.match(queueEffect, /node\.kind\s*!==\s*['"]image['"]\s*&&\s*node\.kind\s*!==\s*['"]video['"]/)
    assert.match(queueEffect, /handleRegenerateNodeFromPrompt\(node\)/)
    assert.match(queueEffect, /dispatchedIds\.push\(nodeId\)/)
    assert.match(queueEffect, /discardedIds\.push\(nodeId\)/)
    assert.match(queueEffect, /const\s+queuedIds\s*=\s*pendingAutoGenerateIdsRef\.current/)
    assert.match(queueEffect, /for\s*\(const nodeId of queuedIds\)/)
    assert.match(queueEffect, /latestNodesRef\.current\.find/)
    assert.match(queueEffect, /prev\.filter\(\(id\)\s*=>\s*!dispatchedIds\.includes\(id\)\s*&&\s*!discardedIds\.includes\(id\)\)/)
    assert.doesNotMatch(queueEffect, /prev\.filter\(\(id\)\s*=>\s*!found\.includes\(id\)\)/)
  })

  test('deleting a node removes its pending dispatch and aborts its active request before removal', () => {
    const deletion = namedBlock(
      workspace,
      'const deleteNode = useCallback',
      'const duplicateNode = useCallback',
    )
    const pendingCleanup = deletion.indexOf('setPendingAutoGenerateIds')
    const abort = deletion.indexOf("context: 'deleted'")
    const controllerDelete = deletion.indexOf('generationAbortControllersRef.current.delete(nodeId)')
    const activeDelete = deletion.indexOf('activeGenerationNodeIdsRef.current.delete(nodeId)')
    const nodeRemoval = deletion.indexOf('commitNodes(')
    assert.match(deletion, /prev\.filter\(\(id\)\s*=>\s*id\s*!==\s*nodeId\)/)
    assert.match(deletion, /generationAbortControllersRef\.current\.get\(nodeId\)/)
    assert.match(deletion, /generationController\?\.abort\(\{[\s\S]*?context:\s*['"]deleted['"][\s\S]*?nodeId[\s\S]*?\}\s+satisfies\s+GenerationAbortReason\)/)
    assert.ok(pendingCleanup >= 0 && pendingCleanup < nodeRemoval)
    assert.ok(abort >= 0 && abort < nodeRemoval)
    assert.ok(controllerDelete >= 0 && controllerDelete < nodeRemoval)
    assert.ok(activeDelete >= 0 && activeDelete < nodeRemoval)
  })

  test('project load and unmount boundaries cannot leak the Stage B queue or active requests', () => {
    const load = namedBlock(
      workspace,
      'async function loadOrCreateProject()',
      'try {',
    )
    const clearRequests = namedBlock(
      workspace,
      'const clearGenerationTimersAndRequests',
      'const beginNodeGeneration',
    )
    const unmount = namedBlock(
      workspace,
      'useEffect(() => {\n    const timers = timersRef.current',
      '// Fetch asset transform capabilities',
    )
    const queueClear = load.indexOf('setPendingAutoGenerateIds([])')
    const synchronousQueueClear = load.indexOf('pendingAutoGenerateIdsRef.current = []')
    const controllerCleanup = load.indexOf('clearGenerationTimersAndRequests()')
    const modalReset = load.indexOf('resetCanvasModalStates()')
    assert.ok(synchronousQueueClear >= 0 && synchronousQueueClear < modalReset)
    assert.ok(queueClear >= 0 && queueClear < modalReset)
    assert.ok(controllerCleanup >= 0 && controllerCleanup < modalReset)
    assert.match(clearRequests, /generationAbortControllersRef\.current\.forEach\(\(controller,\s*nodeId\)\s*=>\s*controller\.abort\(\{[\s\S]*?context[\s\S]*?canvasIdentity[\s\S]*?nodeId[\s\S]*?\}\s+satisfies\s+GenerationAbortReason\)\)/)
    assert.match(clearRequests, /generationAbortControllersRef\.current\.clear\(\)/)
    assert.match(clearRequests, /activeGenerationNodeIdsRef\.current\.clear\(\)/)
    assert.match(unmount, /generationAbortControllersRef\.current\.forEach\(\(controller,\s*nodeId\)\s*=>\s*controller\.abort\(\{[\s\S]*?context:\s*['"]stale['"][\s\S]*?nodeId[\s\S]*?\}\s+satisfies\s+GenerationAbortReason\)\)/)
    assert.match(unmount, /generationAbortControllersRef\.current\.clear\(\)/)
    assert.match(unmount, /activeGenerationNodeIdsRef\.current\.clear\(\)/)
    assert.match(unmount, /pendingAutoGenerateIdsRef\.current\s*=\s*\[\]/)
  })

  test('an aborted outgoing generation cannot patch loading state into the next project', () => {
    const regeneration = namedBlock(
      workspace,
      'const handleRegenerateNodeFromPrompt',
      'useEffect(() => {\n    const queuedIds = pendingAutoGenerateIdsRef.current',
    )
    assert.match(
      regeneration,
      /finally\s*\{[\s\S]*?const\s+abortContext\s*=\s*generationAbortContext\(generationController\.signal\)[\s\S]*?finishNodeGeneration\(node\.id, generationController\)[\s\S]*?if\s*\(abortContext\s*===\s*null\)\s*\{\s*clearRegenerationLoading\(\)\s*\}/,
    )
    assert.doesNotMatch(regeneration, /if\s*\(!generationController\.signal\.aborted\)/)
  })

  test('visibility abort is retryable in the current canvas while stale boundaries stay write-silent', () => {
    const clearRequests = namedBlock(
      workspace,
      'const clearGenerationTimersAndRequests',
      'const beginNodeGeneration',
    )
    const leaveEffect = namedBlock(
      workspace,
      '// Flush pending save on page leave / tab hide / component unmount',
      '// One-shot DB recovery',
    )
    assert.match(clearRequests, /context:\s*GenerationAbortContext\s*=\s*['"]stale['"]/)
    assert.match(clearRequests, /const\s+activeNodeIds\s*=\s*new Set\(generationAbortControllersRef\.current\.keys\(\)\)/)
    assert.match(clearRequests, /context\s*===\s*['"]background['"][\s\S]*?generationCanvasIdentityRef\.current\s*===\s*expectedCanvasIdentity/)
    assert.match(clearRequests, /commitNodes\(\(current\)\s*=>\s*cancelBackgroundGenerationNodes\(current,\s*activeNodeIds\)\)/)
    assert.match(workspace, /function\s+cancelBackgroundGenerationNodes[\s\S]*?status:\s*['"]cancelled['"][\s\S]*?stoppedGenerationMetadata\(node\.metadataJson,\s*['"]background['"]\)/)
    const stoppedMetadata = namedBlock(
      workspace,
      'function stoppedGenerationMetadata',
      'function cancelBackgroundGenerationNodes',
    )
    assert.match(stoppedMetadata, /reason\s*===\s*['"]background['"][\s\S]*?generation_cancelled_by_user/)
    assert.doesNotMatch(stoppedMetadata, /generation_cancelled_on_background/)
    assert.match(leaveEffect, /if\s*\(context\s*===\s*['"]background['"]\)[\s\S]*?clearGenerationTimersAndRequests\(\s*['"]background['"],\s*canvasIdentity\s*\)/)
    assert.match(leaveEffect, /onVisibilityChange[\s\S]*?flushBeforeLeave\(\s*['"]background['"]\s*\)/)
    assert.match(leaveEffect, /clearGenerationTimersAndRequests\(\s*['"]stale['"],\s*canvasIdentity\s*\)/)
    assert.match(leaveEffect, /flushLocalSnapshot\(\)[\s\S]*?scheduleCanvasSave\(0\)/)
    assert.ok(leaveEffect.indexOf('window.clearTimeout(saveTimerRef.current)') < leaveEffect.indexOf('scheduleCanvasSave(0)'))
  })

  test('poll results are abort-gated before video, image, or generic job processing', () => {
    const regeneration = namedBlock(
      workspace,
      'const handleRegenerateNodeFromPrompt',
      'useEffect(() => {\n    const queuedIds = pendingAutoGenerateIdsRef.current',
    )
    const dialogGeneration = namedBlock(
      workspace,
      'const handleNodeDialogGenerate',
      'const handlePromptChange',
    )

    assert.match(
      regeneration,
      /const\s+statusResult\s*=\s*await\s+pollImageGenerationTask\([^\n]+\)\s*\n\s*if\s*\(generationAbortContext\(generationController\.signal\)\s*!==\s*null\)\s*return\s*\n\s*result\s*=/,
    )
    assert.match(
      regeneration,
      /const\s+statusResult\s*=\s*await\s+pollVideoGenerationTask\([^\n]+\)\s*\n\s*if\s*\(generationAbortContext\(generationController\.signal\)\s*!==\s*null\)\s*return\s*\n\s*result\s*=/,
    )
    assert.match(
      dialogGeneration,
      /const\s+statusResult\s*=\s*await\s+pollImageGenerationTask\([^\n]+\)\s*\n\s*if\s*\(generationController\s*&&\s*generationAbortContext\(generationController\.signal\)\s*!==\s*null\)\s*return\s*\n\s*result\s*=/,
    )
    assert.match(
      dialogGeneration,
      /const\s+statusResult\s*=\s*await\s+pollVideoGenerationTask\([^\n]+\)\s*\n\s*if\s*\(generationController\s*&&\s*generationAbortContext\(generationController\.signal\)\s*!==\s*null\)\s*return\s*\n\s*videoPolls\s*\+=\s*1/,
    )
    assert.match(
      dialogGeneration,
      /const\s+jobResult\s*=\s*await\s+pollGenerationJob\([^\n]+\)\s*\n\s*if\s*\(generationController\s*&&\s*generationAbortContext\(generationController\.signal\)\s*!==\s*null\)\s*return\s*\n\s*polls\s*\+=\s*1/,
    )
  })

  test('compatibility generation remains behind the panel second confirmation', () => {
    assert.match(shotPanel, /generateAfterCreate\s*&&\s*outcome\.createdIds\.length\s*>\s*0/)
    assert.match(shotPanel, /setIsConfirmingGenerate\(true\)/)
    assert.match(shotPanel, /runCompatibilityCreate\(true\)/)
    assert.match(workspace, /onAutoGenerateNodes=\{\(nodeIds\)\s*=>\s*\{[\s\S]*?pendingAutoGenerateIdsRef\.current\s*=\s*nodeIds[\s\S]*?setPendingAutoGenerateIds\(nodeIds\)[\s\S]*?\}\}/)
    assert.doesNotMatch(
      namedBlock(workspace, 'const handleCreateCompatibilityShotNode', 'useEffect(() => {'),
      /handleRegenerateNodeFromPrompt|setPendingAutoGenerateIds/,
    )
  })

  test('panels receive metadata and close when their source disappears or stops being Text', () => {
    assert.match(workspace, /<NarrativeBeatAnalysisPanel\b/)
    assert.match(workspace, /activeCanvasModal\s*===\s*['"]narrative-beat-analysis['"]/)
    assert.match(workspace, /narrativeBeatSource\?\.kind\s*===\s*['"]text['"]/)
    assert.match(workspace, /nodes\.find\(\(node\)\s*=>\s*node\.id\s*===\s*narrativeBeatSource\.id\)\?\.kind\s*===\s*['"]text['"]/)
    assert.match(workspace, /<ShotListBuilderPanel[\s\S]*?metadataJson:\s*node\.metadataJson[\s\S]*?onApplyShotPlans=\{handleApplyShotPlans\}/)
    assert.match(workspace, /onAutoGenerateNodes=\{\(nodeIds\)\s*=>\s*\{[\s\S]*?pendingAutoGenerateIdsRef\.current\s*=\s*nodeIds[\s\S]*?setPendingAutoGenerateIds\(nodeIds\)[\s\S]*?\}\}/)
    assert.match(workspace, /resetCanvasModalStates[\s\S]{0,1800}setNarrativeBeatSource\(null\)/)
  })

  test('Stage B analysis integration contains no network, Provider, or payment side effects', () => {
    const integration = [
      narrativePanel,
      shotPanel,
      namedBlock(workspace, 'const openNarrativeBeatAnalysis', 'const handleNodePatch'),
    ].join('\n')
    for (const forbidden of [
      /\bfetch\s*\(/,
      /\/api\/generate\//,
      /\bProvider\b/i,
      /\bBilling\b/i,
      /\bCredits?\b/i,
      /\bWallet\b/i,
      /\bPayment\b/i,
    ]) assert.doesNotMatch(integration, forbidden)
  })
})
