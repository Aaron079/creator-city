import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildCanvasNodeIndex,
  canvasNodeLayerPropsEqual,
  resolveCanvasEdgeNodes,
  type CanvasNodeLayerVisualState,
} from './canvasRenderPlanning'

type CanvasNode = { id: string; title: string }
type ReframeMode = 'original' | 'wide'
type GenerationHealth = { status: 'healthy' | 'unhealthy' } | null
type CanvasNodeLayerAvailability = {
  canOpenPromptInspector: boolean
  canOpenMediaDiagnostics: boolean
  canCreateStableCopy: boolean
  canRecoverMedia: boolean
  canRegenerateFromPrompt: boolean
  canOpenSkillPanel: boolean
  canOpenCreativeAssets: boolean
  canOpenAssetIntelligence: boolean
  canAddToStoryboard: boolean
  canContinueWorkflow: boolean
}
type CanvasNodeLayerState = CanvasNodeLayerVisualState<CanvasNode, ReframeMode, GenerationHealth>
const availabilityFields: Array<keyof CanvasNodeLayerAvailability> = [
  'canOpenPromptInspector',
  'canOpenMediaDiagnostics',
  'canCreateStableCopy',
  'canRecoverMedia',
  'canRegenerateFromPrompt',
  'canOpenSkillPanel',
  'canOpenCreativeAssets',
  'canOpenAssetIntelligence',
  'canAddToStoryboard',
  'canContinueWorkflow',
]

function layerState(
  node: CanvasNode,
  overrides: Partial<CanvasNodeLayerState> = {},
): CanvasNodeLayerState {
  return {
    node,
    active: false,
    dragging: false,
    incomingSourceNode: undefined,
    incomingPortraitLikely: false,
    sourceNodeTitle: undefined,
    sourceNodeMissing: false,
    reframeMode: 'original',
    canCreateDerivedVideo: false,
    canOpenGenerationDialog: false,
    generationHealth: null,
    canOpenPromptInspector: false,
    canOpenMediaDiagnostics: false,
    canCreateStableCopy: false,
    canRecoverMedia: false,
    canRegenerateFromPrompt: false,
    canOpenSkillPanel: false,
    canOpenCreativeAssets: false,
    canOpenAssetIntelligence: false,
    canAddToStoryboard: false,
    canContinueWorkflow: false,
    ...overrides,
  }
}

describe('canvas render planning', () => {
  test('indexes nodes and resolves every consecutive edge at canvas scale', () => {
    for (const nodeCount of [20, 50, 100]) {
      const nodes = Array.from(
        { length: nodeCount },
        (_, index): CanvasNode => ({ id: `node-${index}`, title: `Node ${index}` }),
      )
      const index = buildCanvasNodeIndex(nodes)

      assert.equal(index.size, nodeCount)
      for (let position = 0; position < nodeCount - 1; position += 1) {
        const edge = {
          fromNodeId: `node-${position}`,
          toNodeId: `node-${position + 1}`,
        }
        assert.deepEqual(resolveCanvasEdgeNodes(index, edge), {
          fromNode: nodes[position],
          toNode: nodes[position + 1],
        })
      }
    }
  })

  test('returns null when an edge source or target is missing from the index', () => {
    const nodes = [
      { id: 'node-1', title: 'Node 1' },
      { id: 'node-2', title: 'Node 2' },
    ]
    const index = buildCanvasNodeIndex(nodes)

    assert.equal(resolveCanvasEdgeNodes(index, {
      fromNodeId: 'missing-source',
      toNodeId: 'node-2',
    }), null)
    assert.equal(resolveCanvasEdgeNodes(index, {
      fromNodeId: 'node-1',
      toNodeId: 'missing-target',
    }), null)
  })

  test('keeps exactly N-1 layer props equal after one node identity changes', () => {
    for (const nodeCount of [20, 50, 100]) {
      const nodes = Array.from(
        { length: nodeCount },
        (_, index): CanvasNode => ({ id: `node-${index}`, title: `Node ${index}` }),
      )
      const previous = nodes.map((node) => layerState(node))
      const changedIndex = Math.floor(nodeCount / 2)
      const nextNodes = nodes.map((node, index) => (
        index === changedIndex ? { ...node } : node
      ))
      const next = nextNodes.map((node) => layerState(node))

      const equalCount = previous.filter((state, index) => (
        canvasNodeLayerPropsEqual(state, next[index]!)
      )).length
      assert.equal(equalCount, nodeCount - 1)
    }
  })

  test('rejects every visual state change', () => {
    const node = { id: 'node-1', title: 'Node 1' }
    const incomingSourceNode = { id: 'node-2', title: 'Node 2' }
    const previous = layerState(node)

    assert.equal(canvasNodeLayerPropsEqual(previous, layerState(node, { active: true })), false)
    assert.equal(canvasNodeLayerPropsEqual(previous, layerState(node, { dragging: true })), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { incomingSourceNode }),
    ), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { incomingPortraitLikely: true }),
    ), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { sourceNodeTitle: 'Source node' }),
    ), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { sourceNodeMissing: true }),
    ), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { reframeMode: 'wide' }),
    ), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { canCreateDerivedVideo: true }),
    ), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { canOpenGenerationDialog: true }),
    ), false)
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState(node, { generationHealth: { status: 'healthy' } }),
    ), false)
    for (const field of availabilityFields) {
      const enabled = layerState(node, { [field]: true } as Partial<CanvasNodeLayerState>)
      assert.equal(canvasNodeLayerPropsEqual(previous, enabled), false, `${field}: false to true`)
      assert.equal(canvasNodeLayerPropsEqual(
        enabled,
        layerState(node, { [field]: false } as Partial<CanvasNodeLayerState>),
      ), false, `${field}: true to false`)
    }
    assert.equal(canvasNodeLayerPropsEqual(
      previous,
      layerState({ ...node }),
    ), false)
  })
})
