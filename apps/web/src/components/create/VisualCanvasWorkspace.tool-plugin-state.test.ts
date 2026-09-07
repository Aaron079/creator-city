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
    /const targetId = lockedNodeToolContext\?\.targetNodeId/,
  )
  assert.match(selectionHandlerSource, /if \(!projectId \|\| !targetId\) return/)
  assert.equal(selectionHandlerSource.match(/saveRegisteredToolStateValue\(/g)?.length, 1)
  assert.match(
    selectionHandlerSource,
    /saveRegisteredToolStateValue\(projectId, targetId, 'prompt-booster', selection\)/,
  )
  assert.equal(selectionHandlerSource.match(/clearRegisteredToolStateValue\(/g)?.length, 1)
  assert.match(
    selectionHandlerSource,
    /clearRegisteredToolStateValue\(projectId, targetId, 'prompt-booster'\)/,
  )
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
    '// Load per-node camera/lighting so chips + panel show this node\'s settings',
    '}, [activeNode])',
  )
  assert.match(activeNodeStateSource, /setPromptBoosterSelection\(toolState\.promptBooster\)/)

  const editingNodeStateSource = sourceBetween(
    '// Load per-node camera/lighting so generation dialog chips show the editing node\'s settings',
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
  const count = (token: string) => workspaceSource.split(token).length - 1

  assert.equal(count('/api/generate/image'), 3)
  assert.equal(count('/api/generate/video'), 4)
  assert.equal(count('setupBilling'), 0)
  assert.equal(workspaceSource.match(/provider[\s-]?adapter/gi)?.length ?? 0, 0)
  assert.equal(workspaceSource.match(/payment/gi)?.length ?? 0, 0)
  assert.equal(workspaceSource.match(/billing/gi)?.length, 33)
})
