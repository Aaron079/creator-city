import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceSource = readFileSync(resolve(testDirectory, 'VisualCanvasWorkspace.tsx'), 'utf8')

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = workspaceSource.indexOf(startMarker)
  assert.ok(start >= 0, `missing start marker: ${startMarker}`)
  const end = workspaceSource.indexOf(endMarker, start)
  assert.ok(end > start, `missing end marker after ${startMarker}: ${endMarker}`)
  return workspaceSource.slice(start, end)
}

test('binds Prompt Booster selection to the locked node registry state', () => {
  assert.match(
    workspaceSource,
    /const \[promptBoosterSelection, setPromptBoosterSelection\] = useState<PromptBoosterSelection \| null>\(\(\) => getDefaultRegisteredToolState\(\)\.promptBooster\)/,
  )
  assert.match(workspaceSource, /persistedSelection=\{promptBoosterSelection\}/)

  const selectionHandlerSource = sourceBetween(
    'onSelectionChange={(selection) => {',
    'onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}',
  )

  assert.match(selectionHandlerSource, /setPromptBoosterSelection\(selection\)/)
  assert.match(
    selectionHandlerSource,
    /persistPromptBoosterSelectionForTarget\(\s*\{\s*projectId: lockedNodeToolContext\?\.projectId,\s*nodeId: lockedNodeToolContext\?\.targetNodeId,\s*\},\s*selection,\s*\)/,
  )
  assert.equal(selectionHandlerSource.match(/persistPromptBoosterSelectionForTarget\(/g)?.length, 1)
  assert.doesNotMatch(selectionHandlerSource, /saveRegisteredToolStateValue\(/)
  assert.doesNotMatch(selectionHandlerSource, /clearRegisteredToolStateValue\(/)
})

test('loads and resets Prompt Booster selection with registered node state', () => {
  const projectResetSource = sourceBetween(
    'const defaults = getDefaultRegisteredToolState()',
    "const rawSkills = window.localStorage.getItem(getEnabledSkillsKey(projectId))",
  )
  assert.match(projectResetSource, /setPromptBoosterSelection\(defaults\.promptBooster\)/)

  const openNodeScopedToolSource = sourceBetween(
    'const openNodeScopedTool = useCallback(',
    '// ── End Canvas Modal Manager',
  )
  assert.match(
    openNodeScopedToolSource,
    /panelId === 'camera-control' \|\| panelId === 'scene-lighting' \|\| panelId === 'prompt-booster'/,
  )
  assert.match(openNodeScopedToolSource, /loadRegisteredToolState\(projectId, node\.id\)/)
  assert.match(openNodeScopedToolSource, /setPromptBoosterSelection\(toolState\.promptBooster\)/)

  const activeNodeStateSource = sourceBetween(
    '// Load registered node tool state so chips + panel show this node\'s settings',
    '}, [activeNode])',
  )
  assert.match(activeNodeStateSource, /setPromptBoosterSelection\(toolState\.promptBooster\)/)

  const editingNodeStateSource = sourceBetween(
    '// Load registered node tool state so generation dialog chips show the editing node\'s settings',
    '}, [editingNodeId])',
  )
  assert.match(editingNodeStateSource, /setPromptBoosterSelection\(toolState\.promptBooster\)/)
})

test('copies Prompt Booster state from source to derived node before opening generation', () => {
  const promptBoosterPanelSource = sourceBetween(
    '<PromptBoosterPanel',
    "onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}",
  )
  const createNodeIndex = promptBoosterPanelSource.indexOf('const node = createNode(')
  const copyStateIndex = promptBoosterPanelSource.indexOf(
    "copyRegisteredToolState(projectId, sourceNode.id, node.id, 'prompt-booster')",
  )
  const openPanelIndex = promptBoosterPanelSource.indexOf(
    "openCanvasPanel('generation', { nodeId: node.id })",
  )

  assert.ok(createNodeIndex >= 0, 'Prompt Booster must create a derived node')
  assert.ok(copyStateIndex > createNodeIndex, 'Prompt Booster must copy state after createNode')
  assert.ok(openPanelIndex > copyStateIndex, 'Prompt Booster must copy state before opening generation')
  assert.equal(promptBoosterPanelSource.match(/copyRegisteredToolState\(/g)?.length, 1)
})

test('does not expand generation, provider, payment, or billing surfaces', () => {
  const promptBoosterPanelSource = sourceBetween(
    '<PromptBoosterPanel',
    "onClose={() => { setLockedNodeToolContext(null); closeCanvasPanel() }}",
  )

  assert.doesNotMatch(promptBoosterPanelSource, /\/api\/generate\/(?:image|video)/)
  assert.doesNotMatch(promptBoosterPanelSource, /setupBilling/)
  assert.doesNotMatch(promptBoosterPanelSource, /provider[\s-]?adapter/i)
  assert.doesNotMatch(promptBoosterPanelSource, /payment|billing/i)
})
