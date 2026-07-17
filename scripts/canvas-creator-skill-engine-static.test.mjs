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

function count(source, pattern) {
  return source.match(pattern)?.length ?? 0
}

function assertMutationCaught(assertBoundary, source, mutate) {
  assertBoundary(source)
  assert.throws(
    () => assertBoundary(mutate(source)),
    assert.AssertionError,
    'the boundary assertion must reject a weakened implementation',
  )
}

function scriptSegmentationObject(source) {
  const idIndex = source.search(
    /id:\s*['"]script-segmentation['"]/,
  )
  assert.ok(idIndex >= 0, 'script-segmentation registry entry should exist')
  const start = source.lastIndexOf('\n  {', idIndex)
  const end = source.indexOf('\n  },', idIndex)
  assert.ok(start >= 0 && end > idIndex, 'script-segmentation registry entry should be an object')
  return source.slice(start, end + '\n  },'.length)
}

function scriptSegmentationCallbacks(source) {
  return source.match(
    /const\s+\w*ScriptSegmentation\w*\s*=\s*useCallback\([\s\S]*?\n\s*\},\s*\[[^\]]*\]\)/g,
  ) ?? []
}

function scriptSegmentationPanelUsage(source) {
  const match = source.match(/<ScriptSegmentationPanel\b[\s\S]*?\/>/)
  assert.ok(match, 'Task 5 ScriptSegmentationPanel should be rendered')
  return match[0]
}

describe('Creator Skill canvas integration static boundary', () => {
  test('registry exposes the exact available Text-only panel tool through NodeToolCenter only', () => {
    const assertBoundary = (source) => {
      const entry = scriptSegmentationObject(source)
      for (const expected of [
        /label:\s*['"]剧本分场['"]/,
        /icon:\s*['"]§['"]/,
        /description:\s*['"]将文本拆分为可审核的场景节点['"]/,
        /category:\s*['"]prompt-direction['"]/,
        /executionType:\s*['"]panel['"]/,
        /supportedKinds:\s*\[\s*['"]text['"]\s*\]/,
        /requiresMedia:\s*false/,
        /requiresAsset:\s*false/,
        /available:\s*true/,
        /openActionId:\s*['"]script-segmentation['"]/,
      ]) assert.match(entry, expected)
    }

    assertMutationCaught(assertBoundary, registry, (source) => (
      source.replace("supportedKinds: ['text']", "supportedKinds: ['text', 'image']")
    ))
    assert.equal(count(toolbar, /<NodeToolCenter\b/g), 1)
    assert.doesNotMatch(toolbar, />\s*剧本分场\s*</)
  })

  test('modal union and toolbar forward the optional action callback', () => {
    assert.match(
      modalTypes,
      /\|\s*['"]script-segmentation['"]/,
    )
    assert.match(toolbar, /onOpenScriptSegmentation\?\s*:\s*\(\)\s*=>\s*void/)
    assert.match(
      toolbar,
      /case\s+['"]script-segmentation['"]\s*:\s*onOpenScriptSegmentation\?\.\(\)\s*;\s*break/,
    )
    assert.match(
      toolbar,
      /export function AssetAgentToolbar\(\{[\s\S]*?onOpenScriptSegmentation[\s\S]*?\}:\s*AssetAgentToolbarProps\)/,
    )
  })

  test('opening is Text-only and captures an immutable six-field source snapshot', () => {
    const callbacks = scriptSegmentationCallbacks(workspace)
    const openBoundary = callbacks.find((source) => source.includes("openNodeScopedTool('script-segmentation'"))
    assert.ok(openBoundary, 'workspace should open script segmentation through openNodeScopedTool')
    assert.match(openBoundary, /\.kind\s*!==\s*['"]text['"][^\n]*return/)
    assert.match(openBoundary, /Object\.freeze/)
    assert.match(openBoundary, /:\s*CreatorSkillSourceNode\s*=/)
    for (const field of ['id', 'kind', 'title', 'prompt', 'resultText', 'metadataJson']) {
      assert.match(openBoundary, new RegExp(`\\b${field}:`))
    }
    assert.match(openBoundary, /resultText:\s*typeof\s+\w+\.resultText\s*===\s*['"]string['"]/)
    assert.match(openBoundary, /openNodeScopedTool\(\s*['"]script-segmentation['"]\s*,/)
    assert.match(workspace, /useState<CreatorSkillSourceNode\s*\|\s*null>\(null\)/)
    assert.match(workspace, /resetCanvasModalStates[\s\S]{0,1600}set\w*ScriptSegmentation\w*\(null\)/)
  })

  test('Task 5 panel renders only for the matching live Text source and receives metadata snapshots', () => {
    assert.match(workspace, /import\s+\{\s*ScriptSegmentationPanel\s*\}\s+from\s+['"][^'"]+ScriptSegmentationPanel['"]/)
    assert.match(workspace, /type\s+CreatorSkillSourceNode/)
    assert.match(workspace, /activeCanvasModal\s*===\s*['"]script-segmentation['"]/)
    assert.match(workspace, /\.kind\s*===\s*['"]text['"]/)

    const panel = scriptSegmentationPanelUsage(workspace)
    assert.match(panel, /sourceNode=\{[^}]+\}/)
    assert.match(
      panel,
      /existingNodes=\{nodes\.map\(\([^)]*\)\s*=>\s*\(\{\s*metadataJson:\s*[^}]+\.metadataJson\s*\}\)\)\}/,
    )
    assert.doesNotMatch(panel, /existingNodes=\{nodes\}/)
    assert.match(workspace, /activeCanvasModal\s*!==\s*['"]script-segmentation['"][\s\S]{0,400}return/)
    assert.match(workspace, /!\w+Source[\s\S]{0,200}closeCanvasPanel\(\)/)
  })

  test('apply re-reads the latest source and closes changed analysis before any create', () => {
    const callbacks = scriptSegmentationCallbacks(workspace)
    const applyBoundary = callbacks.find((source) => (
      source.includes('latestNodesRef.current') && source.includes("createNode('text'")
    ))
    assert.ok(applyBoundary, 'workspace should own a script segmentation apply callback')

    const assertBoundary = (source) => {
      assert.match(
        source,
        /latestNodesRef\.current\.find\(\([^)]*\)\s*=>\s*[^)]*\.id\s*===\s*[^)]*\.id\)/,
      )
      assert.ok(count(source, /resultText\?\.trim\(\)/g) >= 2)
      assert.match(source, /!\w*current\w*/i)
      assert.match(source, /\.kind\s*!==\s*['"]text['"]/)
      assert.match(source, /!==\s*\w*analy\w*/i)
      const guardEnd = source.indexOf('return', source.indexOf('!=='))
      const firstCreate = source.indexOf("createNode('text'")
      assert.ok(guardEnd > 0 && guardEnd < firstCreate, 'stale guard must return before creation')
      const staleBranch = source.slice(source.indexOf('if ('), guardEnd + 'return'.length)
      assert.match(staleBranch, /closeCanvasPanel\(\)/)
      assert.match(staleBranch, /showCanvasFeedback\([^)]*(?:重新|重跑|再次运行)/)
    }

    assertMutationCaught(assertBoundary, applyBoundary, (source) => (
      source.replace(/!==\s*\w*analy\w*/i, '=== analyzedSourceText')
    ))
  })

  test('approved nonduplicates resolve against evolving occupancy and append actual created nodes', () => {
    const applyBoundary = scriptSegmentationCallbacks(workspace).find((source) => (
      source.includes("createNode('text'")
    ))
    assert.ok(applyBoundary)

    const assertBoundary = (source) => {
      const occupancyMatch = source.match(
        /const\s+(\w+)\s*=\s*\[\s*\.\.\.latestNodesRef\.current\s*\]/,
      )
      assert.ok(occupancyMatch, 'batch occupancy must snapshot the latest nodes')
      const occupancy = occupancyMatch[1]
      assert.match(source, /\.forEach\(\(\w+\s*,\s*index\)\s*=>/)
      const positionMatch = source.match(
        new RegExp(`const\\s+(\\w+)\\s*=\\s*resolveNonOverlappingPosition\\(\\s*\\{[\\s\\S]*?width:[\\s\\S]*?height:[\\s\\S]*?\\}\\s*,\\s*${occupancy}\\s*\\)`),
      )
      assert.ok(positionMatch, 'candidate rectangle must resolve against evolving occupancy')
      const resolvedPosition = positionMatch[1]
      const createdMatch = source.match(
        /const\s+(\w+)\s*=\s*createNode\(\s*['"]text['"]\s*,\s*\{/,
      )
      assert.ok(createdMatch, 'createNode return value must be retained')
      const createdNode = createdMatch[1]
      for (const expected of [
        /title:\s*\w+\.title/,
        /prompt:\s*\w+\.prompt/,
        /parentNodeId:\s*\w+\.id/,
        /metadataJson:\s*\w+\.metadataJson/,
        /edgeLabel:\s*['"]剧本分场['"]/,
        /edgeToolId:\s*['"]script-segmentation['"]/,
        /edgeToolIcon:\s*['"]§['"]/,
      ]) assert.match(source, expected)
      assert.match(
        source,
        new RegExp(`(?:position\\s*:\\s*${resolvedPosition}|\\b${resolvedPosition}\\s*,)`),
      )
      assert.doesNotMatch(source, /metadataJson:\s*\{/)
      assert.match(
        source,
        new RegExp(`${occupancy}\\.push\\(\\s*${createdNode}\\s*\\)`),
      )
      assert.ok(
        source.indexOf(`${occupancy}.push`) > source.indexOf(`const ${createdNode} = createNode`),
        'actual created node must join occupancy after creation',
      )
    }

    assertMutationCaught(assertBoundary, applyBoundary, (source) => (
      source.replace(/\[\s*\.\.\.latestNodesRef\.current\s*\]/, '[]')
    ))
    assertMutationCaught(assertBoundary, applyBoundary, (source) => (
      source.replace(/\},\s*occupancy\)/, '}, latestNodesRef.current)')
    ))
    assertMutationCaught(assertBoundary, applyBoundary, (source) => (
      source.replace(/\n\s*\w+\.push\(\s*\w+\s*\)/, '')
    ))
  })

  test('successful mixed creation keeps duplicate feedback mounted', () => {
    const applyBoundary = scriptSegmentationCallbacks(workspace).find((source) => (
      source.includes("createNode('text'")
    ))
    assert.ok(applyBoundary)

    const assertBoundary = (source) => {
      const successStart = source.indexOf("const textNodeSize = getNodeSize('text')")
      assert.ok(successStart >= 0)
      const successPath = source.slice(successStart)
      assert.match(successPath, /flushLocalSnapshot\(\)/)
      assert.match(successPath, /scheduleCanvasSave\(0\)/)
      assert.match(successPath, /showCanvasFeedback\(/)
      assert.doesNotMatch(successPath, /closeCanvasPanel\(\)/)
    }

    assertMutationCaught(assertBoundary, applyBoundary, (source) => (
      `${source}\ncloseCanvasPanel()`
    ))
  })

  test('integration remains local canvas orchestration with no source patch or remote side effects', () => {
    const integration = [
      ...scriptSegmentationCallbacks(workspace),
      scriptSegmentationPanelUsage(workspace),
    ].join('\n')

    const assertBoundary = (source) => {
      assert.doesNotMatch(source, /handleNodePatch/)
      assert.doesNotMatch(source, /fetch\s*\(|\/api\/generate\//i)
      assert.doesNotMatch(source, /\b(?:provider|billing|credits?|wallet|payment|upload)\b/i)
      assert.doesNotMatch(source, /method:\s*['"]PUT['"]/i)
    }

    assertMutationCaught(assertBoundary, integration, (source) => (
      `${source}\nhandleNodePatch(sourceNode.id, { prompt: plan.prompt })`
    ))
  })
})
