export type CanvasNodeIdentity = {
  id: string
}

export type CanvasEdgeIdentity = {
  fromNodeId: string
  toNodeId: string
}

export function buildCanvasNodeIndex<Node extends CanvasNodeIdentity>(
  nodes: readonly Node[],
) {
  return new Map(nodes.map((node) => [node.id, node]))
}

export function resolveCanvasEdgeNodes<
  Node extends CanvasNodeIdentity,
  Edge extends CanvasEdgeIdentity,
>(
  nodeIndex: ReadonlyMap<string, Node>,
  edge: Edge,
) {
  const fromNode = nodeIndex.get(edge.fromNodeId)
  const toNode = nodeIndex.get(edge.toNodeId)
  return fromNode && toNode ? { fromNode, toNode } : null
}

export type CanvasNodeLayerVisualState<Node, Mode, Health> = {
  node: Node
  active: boolean
  dragging: boolean
  incomingSourceNode: Node | undefined
  incomingPortraitLikely: boolean
  sourceNodeTitle: string | undefined
  sourceNodeMissing: boolean
  reframeMode: Mode
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
  canCreateDerivedVideo: boolean
  canOpenGenerationDialog: boolean
  generationHealth: Health
}

export function canvasNodeLayerPropsEqual<Node, Mode, Health>(
  previous: CanvasNodeLayerVisualState<Node, Mode, Health>,
  next: CanvasNodeLayerVisualState<Node, Mode, Health>,
) {
  return previous.node === next.node
    && previous.active === next.active
    && previous.dragging === next.dragging
    && previous.incomingSourceNode === next.incomingSourceNode
    && previous.incomingPortraitLikely === next.incomingPortraitLikely
    && previous.sourceNodeTitle === next.sourceNodeTitle
    && previous.sourceNodeMissing === next.sourceNodeMissing
    && previous.reframeMode === next.reframeMode
    && previous.canOpenPromptInspector === next.canOpenPromptInspector
    && previous.canOpenMediaDiagnostics === next.canOpenMediaDiagnostics
    && previous.canCreateStableCopy === next.canCreateStableCopy
    && previous.canRecoverMedia === next.canRecoverMedia
    && previous.canRegenerateFromPrompt === next.canRegenerateFromPrompt
    && previous.canOpenSkillPanel === next.canOpenSkillPanel
    && previous.canOpenCreativeAssets === next.canOpenCreativeAssets
    && previous.canOpenAssetIntelligence === next.canOpenAssetIntelligence
    && previous.canAddToStoryboard === next.canAddToStoryboard
    && previous.canContinueWorkflow === next.canContinueWorkflow
    && previous.canCreateDerivedVideo === next.canCreateDerivedVideo
    && previous.canOpenGenerationDialog === next.canOpenGenerationDialog
    && previous.generationHealth === next.generationHealth
}
