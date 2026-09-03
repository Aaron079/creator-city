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
