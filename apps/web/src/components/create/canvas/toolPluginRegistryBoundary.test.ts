import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const visualCanvasWorkspaceSource = readFileSync(resolve(testDirectory, '../VisualCanvasWorkspace.tsx'), 'utf8')

test('routes both canvas generation prompt paths through the tool plugin registry', () => {
  assert.equal(
    visualCanvasWorkspaceSource.match(/composeRegisteredToolPrompt\(/g)?.length,
    2,
  )

  for (const obsoleteDeclaration of [
    'const cameraCtx = buildCameraPromptContext(nodeCameraCtx)',
    'const lightingCtx = buildSceneLightingPromptContext(nodeLightingCtx)',
    'const cameraContext = buildCameraPromptContext(nodeCamera)',
    'const lightingContext = buildSceneLightingPromptContext(nodeLighting)',
  ]) {
    assert.doesNotMatch(visualCanvasWorkspaceSource, new RegExp(obsoleteDeclaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(
    visualCanvasWorkspaceSource,
    /normalizeCanvasToolPluginNodeKind\(nodeSnapshot\.kind\)/,
  )
  assert.doesNotMatch(visualCanvasWorkspaceSource, /nodeSnapshot\.kind as CanvasToolPluginNodeKind/)
})

test('keeps Camera and Lighting node state behind the plugin-state adapter', () => {
  assert.match(visualCanvasWorkspaceSource, /from '@\/lib\/canvas\/tool-plugin-state'/)
  assert.doesNotMatch(visualCanvasWorkspaceSource, /from '@\/lib\/canvas\/nodeDirectorContextStorage'/)
  assert.equal(visualCanvasWorkspaceSource.match(/loadRegisteredToolState\(/g)?.length, 5)
  assert.equal(visualCanvasWorkspaceSource.match(/saveRegisteredToolStateValue\(/g)?.length, 3)
  assert.equal(visualCanvasWorkspaceSource.match(/clearRegisteredToolStateValue\(/g)?.length, 1)
  assert.equal(visualCanvasWorkspaceSource.match(/copyRegisteredToolState\(/g)?.length, 3)
})

test('binds locked Camera and Lighting panels to their target node state', () => {
  const start = visualCanvasWorkspaceSource.indexOf('const openNodeScopedTool = useCallback(')
  const end = visualCanvasWorkspaceSource.indexOf('// ── End Canvas Modal Manager', start)
  const openNodeScopedToolSource = visualCanvasWorkspaceSource.slice(start, end)

  assert.match(openNodeScopedToolSource, /directorTargetNodeIdRef\.current = node\.id/)
  assert.match(openNodeScopedToolSource, /loadRegisteredToolState\(projectId, node\.id\)/)
  assert.match(openNodeScopedToolSource, /setCameraSettings\(toolState\.camera\)/)
  assert.match(openNodeScopedToolSource, /setSceneLightingSettings\(toolState\.lighting\)/)
})
