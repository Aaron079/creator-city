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
      'useEffect(() => {\n    if (pendingAutoGenerateIds.length === 0)',
      'const assetResolveKey',
    )
    assert.match(queueEffect, /node\.kind\s*!==\s*['"]image['"]\s*&&\s*node\.kind\s*!==\s*['"]video['"]/)
    assert.match(queueEffect, /handleRegenerateNodeFromPrompt\(node\)/)
    assert.match(queueEffect, /dispatchedIds\.push\(nodeId\)/)
    assert.match(queueEffect, /prev\.filter\(\(id\)\s*=>\s*!dispatchedIds\.includes\(id\)\)/)
    assert.doesNotMatch(queueEffect, /prev\.filter\(\(id\)\s*=>\s*!found\.includes\(id\)\)/)
  })

  test('compatibility generation remains behind the panel second confirmation', () => {
    assert.match(shotPanel, /generateAfterCreate\s*&&\s*outcome\.createdIds\.length\s*>\s*0/)
    assert.match(shotPanel, /setIsConfirmingGenerate\(true\)/)
    assert.match(shotPanel, /runCompatibilityCreate\(true\)/)
    assert.match(workspace, /onAutoGenerateNodes=\{\(nodeIds\)\s*=>\s*setPendingAutoGenerateIds\(nodeIds\)\}/)
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
    assert.match(workspace, /onAutoGenerateNodes=\{\(nodeIds\)\s*=>\s*setPendingAutoGenerateIds\(nodeIds\)\}/)
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
