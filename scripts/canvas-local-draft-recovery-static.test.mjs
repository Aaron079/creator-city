import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspace = readFileSync(
  new URL('../apps/web/src/components/create/VisualCanvasWorkspace.tsx', import.meta.url),
  'utf8',
)

test('workspace rejects cross-project local records during normalization', () => {
  const normalizationStart = workspace.indexOf('const normalizeLocalCanvasSnapshot')
  const normalizationEnd = workspace.indexOf('const readBestLocalCanvasSnapshot')
  const normalization = workspace.slice(normalizationStart, normalizationEnd)

  assert.match(normalization, /parsedProjectId !== id[\s\S]*return null/)
})

test('workspace delegates version classification to the recovery guard', () => {
  assert.match(workspace, /import \{ decideCanvasDraftRecovery \}/)
  assert.match(workspace, /const recoveryDecision = decideCanvasDraftRecovery\(/)
  assert.match(workspace, /recoveryDecision\.action === 'prompt-local-recovery'/)
})

test('authorized load renders the server before offering local recovery', () => {
  const applyServer = workspace.indexOf('nodes: serverNodes,')
  const promptDecision = workspace.indexOf("recoveryDecision.action === 'prompt-local-recovery'")

  assert.notEqual(applyServer, -1)
  assert.notEqual(promptDecision, -1)
  assert.ok(applyServer < promptDecision)
  assert.match(workspace, /nodes: serverNodes,[\s\S]*allowEmpty: true/)
  assert.match(workspace, /setDraftRestorePrompt\(\{[\s\S]*source: localCandidate\.source/)
})

test('authorized ensure load can clear stale nodes from another project', () => {
  const ensureStart = workspace.indexOf('if (!resolvedProjectId)')
  const ensureEnd = workspace.indexOf('// Do NOT render local draft before API authorization is confirmed.')
  const ensureLoad = workspace.slice(ensureStart, ensureEnd)

  assert.match(ensureLoad, /nodes: \(ensureData\.nodes \?\? \[\]\)[\s\S]*allowEmpty: true/)
})

test('workspace no longer auto-renders local canvas candidates', () => {
  assert.doesNotMatch(workspace, /shouldRestoreLocalCanvas/)
  assert.doesNotMatch(workspace, /effectiveNodes/)
  assert.doesNotMatch(workspace, /effectiveEdges/)
  assert.doesNotMatch(workspace, /effectiveViewport/)
})

test('dismissal explicitly keeps the server version without a save', () => {
  assert.match(workspace, /const keepServerCanvas = useCallback\(\(\) => \{[\s\S]*继续使用服务器版本/)
  assert.match(workspace, /onClick=\{keepServerCanvas\}/)
  assert.match(workspace, />\s*使用服务器版本\s*</)
})

test('clean page leave does not manufacture a newer local draft', () => {
  assert.match(workspace, /const hasUnsyncedLocalChangesRef = useRef\(false\)/)
  assert.match(
    workspace,
    /const writeUnifiedLocalSnapshot = useCallback\(\(args\?: \{[\s\S]*hasUnsyncedLocalChangesRef\.current = !args\?\.syncedAt/,
  )
  assert.match(
    workspace,
    /function flushBeforeLeave\(\) \{[\s\S]*if \(hasUnsyncedLocalChangesRef\.current\) flushLocalSnapshot\(\)/,
  )
  assert.match(
    workspace,
    /const keepServerCanvas = useCallback\(\(\) => \{[\s\S]*flushLocalSnapshot\(serverSaveVersionRef\.current\)/,
  )
})
