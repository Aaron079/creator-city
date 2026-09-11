import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, 'VisualCanvasWorkspace.tsx'), 'utf8')

function sourceBetween(startMarker: string, endMarker: string) {
  const start = workspaceSource.indexOf(startMarker)
  assert.ok(start >= 0, `missing start marker: ${startMarker}`)
  const end = workspaceSource.indexOf(endMarker, start)
  assert.ok(end > start, `missing end marker after ${startMarker}: ${endMarker}`)
  return workspaceSource.slice(start, end)
}

test('initializes spatial previs wherever workflow metadata initializes the shot sequence', () => {
  const pairedWorkflowLoads = workspaceSource.matchAll(
    /setCloudShotSequence\(parseShotSequenceFromWorkflowMetadata\(([^)]+)\)\)\s+setSpatialPrevis\(parseSpatialPrevisMetadata\(\1, ([^)]+)\)\)/g,
  )

  assert.deepEqual([...pairedWorkflowLoads].map((match) => match[2]), [
    'ensureData.project.id',
    'resolvedProjectId',
  ])
})

test('keeps spatial previs saves scoped away from pending canvas deletions', () => {
  const spatialSaveSource = sourceBetween(
    'const handleSaveSpatialPrevis = useCallback',
    'const createGeneratedAsset = useCallback',
  )

  assert.match(
    spatialSaveSource,
    /const saveMode = entityPayload\.saveMode === 'full' && entityPayload\.nodes\.length === 0\s+\? 'incremental'/,
  )
  assert.match(spatialSaveSource, /deletedNodeIds: \[\],\s+deletedEdgeIds: \[\]/)
  assert.match(spatialSaveSource, /workflowMetadata: spatialPrevisMetadata\(\{\}, next\)/)
  assert.doesNotMatch(spatialSaveSource, /deletedNodeIdsRef|deletedEdgeIdsRef/)
})

test('keeps an explicit spatial save conflict non-destructive and reloads only from current canvas metadata', () => {
  const spatialSaveSource = sourceBetween(
    'const handleSaveSpatialPrevis = useCallback',
    'const createGeneratedAsset = useCallback',
  )
  const reloadSource = sourceBetween(
    'const handleReloadSpatialPrevis = useCallback',
    'const createGeneratedAsset = useCallback',
  )

  assert.match(spatialSaveSource, /if \(data\.errorCode === 'CANVAS_SAVE_CONFLICT'\) return 'conflict'/)
  assert.match(reloadSource, /\/api\/projects\//)
  assert.match(reloadSource, /method: 'GET'/)
  assert.match(reloadSource, /credentials: 'include'/)
  assert.match(reloadSource, /parseSpatialPrevisMetadata\(data\.workflow\?\.metadataJson, projectId\) \?\? normalizeSpatialPrevis\(\{ projectId \}\)/)
  assert.match(reloadSource, /setSpatialPrevis\(next\)/)
  assert.match(reloadSource, /setSpatialPrevisPanelRevision\(\(current\) => current \+ 1\)/)
})

test('keeps the spatial previs overlay non-closing so the guarded panel close button is the single close path', () => {
  const mountSource = sourceBetween(
    "{isSpatialPrevisOpen && saveStatus !== 'opening'",
    '{isContinuityCheckerOpen',
  )

  assert.match(mountSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/)
  assert.equal((mountSource.match(/closeCanvasPanel\(\)/g) ?? []).length, 1)
})

test('maps an ordered spatial asset batch through the existing single-file uploader', () => {
  const uploadSource = sourceBetween(
    'const handleUploadSpatialSceneAsset = useCallback',
    'const refreshSeedanceReceipts = useCallback',
  )
  const panelMountSource = sourceBetween(
    "{isSpatialPrevisOpen && saveStatus !== 'opening'",
    '{isContinuityCheckerOpen',
  )

  assert.match(uploadSource, /handleUploadSpatialSceneAssets/)
  assert.match(uploadSource, /uploadSpatialSceneAssetFiles\(files, handleUploadSpatialSceneAsset\)/)
  assert.match(panelMountSource, /onUploadSceneAssets=\{handleUploadSpatialSceneAssets\}/)
  assert.doesNotMatch(uploadSource, /\/api\/assets\/batch|\/api\/uploads/)
})

test('creates and exports neutral spatial previs delivery packages without submitting a provider generation', () => {
  const deliveryNodeSource = sourceBetween(
    'const handleCreateSpatialPrevisDeliveryNode = useCallback',
    'const openScriptSegmentation = useCallback',
  )
  const panelMountSource = sourceBetween(
    "{isSpatialPrevisOpen && saveStatus !== 'opening'",
    '{isContinuityCheckerOpen',
  )

  assert.match(deliveryNodeSource, /createNode\('text'/)
  assert.doesNotMatch(deliveryNodeSource, /const node = createNode\(/)
  assert.match(deliveryNodeSource, /metadataJson:\s*\{\s*previsDelivery:/)
  assert.match(deliveryNodeSource, /new Blob\(/)
  assert.match(deliveryNodeSource, /URL\.createObjectURL/)
  assert.match(deliveryNodeSource, /URL\.revokeObjectURL/)
  assert.match(deliveryNodeSource, /\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/assets/)
  assert.doesNotMatch(deliveryNodeSource, /\/api\/generate\/seedance-previs/)
  assert.match(panelMountSource, /onCreateDeliveryNode=\{handleCreateSpatialPrevisDeliveryNode\}/)
  assert.match(panelMountSource, /onDownloadDeliveryPackage=\{handleDownloadSpatialPrevisDeliveryPackage\}/)
  assert.match(panelMountSource, /onSaveDeliveryPackageToAssets=\{handleSaveSpatialPrevisDeliveryPackageToAssets\}/)
})

test('creates and persists a stable running video node before dispatching its spatial test', () => {
  const runTestSource = sourceBetween(
    'const handleRunSpatialPrevisTest = useCallback',
    'const handleOpenGlobalStoryboardDirector = useCallback',
  )

  assert.match(runTestSource, /createNode\('video'/)
  assert.match(runTestSource, /const nodeId = `spatial-previs-test-\$\{crypto\.randomUUID\(\)\}`/)
  assert.match(runTestSource, /createNode\('video', \{\s*nodeId,/)
  assert.match(runTestSource, /title:\s*`三维预演测试 · \$\{durationSec\} 秒`/)
  assert.match(runTestSource, /model:\s*'spatial-previs-internal'/)
  assert.match(runTestSource, /status:\s*'running'/)
  assert.match(runTestSource, /spatialPrevisTest:\s*true/)
  assert.match(runTestSource, /previsDelivery/)
  assert.match(runTestSource, /sourceAssetIds/)
  assert.match(runTestSource, /sourceReferenceIds/)
  assert.match(runTestSource, /const previsDelivery = buildPrevisDeliveryPackage\(previs\)/)
  assert.match(runTestSource, /Object\.freeze\(previs\.scene\.references\.map/)
  assert.match(runTestSource, /metadataJson:\s*Object\.freeze\(/)

  const createIndex = runTestSource.indexOf("createNode('video'")
  const saveIndex = runTestSource.indexOf('await handleSaveSpatialPrevis(previs)')
  const requestIndex = runTestSource.indexOf("fetch('/api/generate/seedance-previs'")
  assert.ok(createIndex >= 0 && createIndex < saveIndex, 'video node must exist before the spatial save')
  assert.ok(saveIndex < requestIndex, 'spatial save must finish before dispatch')
  assert.match(runTestSource, /buildSpatialPrevisTestRequest\(previs, node\.id, durationSec\)/)
  assert.match(runTestSource, /body:\s*JSON\.stringify\(\{[\s\S]*?\.\.\.request/)
})

test('keeps internal spatial test presentation neutral while preserving its controlled dispatch', () => {
  const runTestSource = sourceBetween(
    'const handleRunSpatialPrevisTest = useCallback',
    'const handleOpenGlobalStoryboardDirector = useCallback',
  )

  assert.match(runTestSource, /model:\s*'spatial-previs-internal'/)
  assert.match(runTestSource, /resultPreview:\s*'三维预演测试已完成'/)
  assert.match(runTestSource, /'三维预演测试未能完成。'/)
  assert.match(runTestSource, /attribution:\s*'三维预演内部测试'/)
  assert.doesNotMatch(runTestSource, /formatGenerateError|Volcengine|Seedance/)
})

test('polls only the returned job and reconciles media onto the same spatial test node', () => {
  const runTestSource = sourceBetween(
    'const handleRunSpatialPrevisTest = useCallback',
    'const handleOpenGlobalStoryboardDirector = useCallback',
  )

  assert.match(runTestSource, /generationJobId/)
  assert.match(runTestSource, /pollVideoGenerationTask\('volcengine-seedance-video', generationJobId/)
  assert.match(runTestSource, /!spatialPrevisOpenRef\.current\) return/)
  assert.match(runTestSource, /if \(isActiveGenerationStatus\(statusResult\.status\)\) continue/)
  assert.match(runTestSource, /handleNodePatch\(node\.id, \{[\s\S]*?status:\s*'done'/)
  assert.match(runTestSource, /resultVideoUrl:\s*videoUrl/)
  assert.match(runTestSource, /const assetId = statusResult\.asset\?\.id \?\? statusResult\.assetId/)
  assert.match(runTestSource, /assetId,/)
  assert.match(runTestSource, /preview:\s*\{\s*type:\s*'remote-video'/)
  assert.doesNotMatch(runTestSource, /generation_polling_timeout/)
})

test('silently stops a stale spatial test poller before it writes a terminal node state', () => {
  const runTestSource = sourceBetween(
    'const handleRunSpatialPrevisTest = useCallback',
    'const handleOpenGlobalStoryboardDirector = useCallback',
  )

  assert.match(
    runTestSource,
    /const failNode = \(generationJobId\?: string\) => \{[\s\S]*?if \(generationJobId && metadataRecord\(currentNode\.metadataJson\)\.generationJobId !== generationJobId\) return/,
  )
  assert.match(
    runTestSource,
    /const latestNode = latestNodesRef\.current\.find\(\(item\) => item\.id === node\.id\)[\s\S]*?if \(metadataRecord\(latestNode\.metadataJson\)\.generationJobId !== generationJobId\) return[\s\S]*?handleNodePatch\(node\.id, \{[\s\S]*?status:\s*'done'/,
  )
})

test('aborts the internal test poller on panel close and leaves a bounded timeout retryable without changing the running node', () => {
  const runTestSource = sourceBetween(
    'const handleRunSpatialPrevisTest = useCallback',
    'const handleOpenGlobalStoryboardDirector = useCallback',
  )

  assert.match(workspaceSource, /const spatialPrevisPollAbortRef = useRef<AbortController \| null>\(null\)/)
  assert.match(workspaceSource, /spatialPrevisPollAbortRef\.current\?\.abort\(\)/)
  assert.match(runTestSource, /const pollController = new AbortController\(\)/)
  assert.match(runTestSource, /delay\(5000, pollController\.signal\)/)
  assert.match(runTestSource, /pollVideoGenerationTask\('volcengine-seedance-video', generationJobId, pollController\.signal\)/)
  assert.match(runTestSource, /if \(polls >= MAX_VIDEO_GENERATION_POLLS\)\s*\{\s*setSpatialPrevisTestPanelStatus\(\{\s*kind:\s*'retryable'/)
  assert.match(runTestSource, /三维预演测试仍在生成中，可重新运行测试。/)
  assert.doesNotMatch(runTestSource, /failNode\(generationJobId, 'timeout'\)/)
  assert.doesNotMatch(runTestSource, /spatial_previs_test_polling_timeout/)
  assert.match(runTestSource, /generationJobId,\s*generationJob: \{ id: generationJobId \}/)

  const timeoutSource = runTestSource.slice(runTestSource.indexOf('if (polls >= MAX_VIDEO_GENERATION_POLLS)'))
  assert.doesNotMatch(timeoutSource, /handleNodePatch\(node\.id/)
})
