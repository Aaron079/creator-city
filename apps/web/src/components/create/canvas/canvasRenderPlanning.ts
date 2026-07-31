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

export type CanvasNodeLayerVisualState<Node, Mode> = {
  node: Node
  active: boolean
  dragging: boolean
  incomingSourceNode: Node | undefined
  incomingPortraitLikely: boolean
  sourceNodeTitle: string | undefined
  sourceNodeMissing: boolean
  reframeMode: Mode
  canCreateDerivedVideo: boolean
  canOpenGenerationDialog: boolean
}

export function canvasNodeLayerPropsEqual<Node, Mode>(
  previous: CanvasNodeLayerVisualState<Node, Mode>,
  next: CanvasNodeLayerVisualState<Node, Mode>,
) {
  return previous.node === next.node
    && previous.active === next.active
    && previous.dragging === next.dragging
    && previous.incomingSourceNode === next.incomingSourceNode
    && previous.incomingPortraitLikely === next.incomingPortraitLikely
    && previous.sourceNodeTitle === next.sourceNodeTitle
    && previous.sourceNodeMissing === next.sourceNodeMissing
    && previous.reframeMode === next.reframeMode
    && previous.canCreateDerivedVideo === next.canCreateDerivedVideo
    && previous.canOpenGenerationDialog === next.canOpenGenerationDialog
}
