export type CanvasWorkflowNodeStatus = 'idle' | 'queued' | 'running' | 'done' | 'error'

export type CanvasWorkflowNode = {
  id: string
  kind: string
  prompt?: string
  status?: string
  resultText?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  errorMessage?: string
}

export type CanvasWorkflowEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
}

export type CanvasWorkflowInputAsset = {
  id: string
  type: 'image' | 'video' | 'audio' | 'text'
  url?: string
  text?: string
}

export type CanvasWorkflowRunNodeInput<TNode extends CanvasWorkflowNode> = {
  node: TNode
  upstreamNodes: TNode[]
  upstreamText: string
  inputAssets: CanvasWorkflowInputAsset[]
}

export type CanvasWorkflowRunNodeResult = {
  resultText?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  resultPreview?: string
  outputLabel?: string
  errorMessage?: string
  preview?: unknown
  metadataJson?: unknown
}

export type CanvasWorkflowNodePatch = Partial<CanvasWorkflowRunNodeResult> & {
  status?: CanvasWorkflowNodeStatus
}

export type CanvasWorkflowRunResult<TNode extends CanvasWorkflowNode> =
  | {
      ok: true
      nodes: TNode[]
      executionOrder: string[]
      failedNodeIds: string[]
    }
  | {
      ok: false
      errorCode: 'WORKFLOW_CYCLE_DETECTED' | 'WORKFLOW_NO_START_NODE'
      message: string
      nodes: TNode[]
      executionOrder: string[]
      failedNodeIds: string[]
    }

export async function runCanvasWorkflow<TNode extends CanvasWorkflowNode>({
  nodes,
  edges,
  startNodeId,
  runNode,
  onNodeUpdate,
}: {
  nodes: TNode[]
  edges: CanvasWorkflowEdge[]
  startNodeId?: string | null
  runNode: (input: CanvasWorkflowRunNodeInput<TNode>) => Promise<CanvasWorkflowRunNodeResult>
  onNodeUpdate?: (nodeId: string, patch: CanvasWorkflowNodePatch, nodes: TNode[]) => void
}): Promise<CanvasWorkflowRunResult<TNode>> {
  const nodeById = new Map(nodes.map((node) => [node.id, { ...node } as TNode]))
  const validEdges = edges.filter((edge) => nodeById.has(edge.fromNodeId) && nodeById.has(edge.toNodeId))
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()

  for (const node of nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }

  for (const edge of validEdges) {
    outgoing.get(edge.fromNodeId)?.push(edge.toNodeId)
    incoming.get(edge.toNodeId)?.push(edge.fromNodeId)
  }

  const startIds = startNodeId
    ? (nodeById.has(startNodeId) ? [startNodeId] : [])
    : nodes.filter((node) => (incoming.get(node.id)?.length ?? 0) === 0).map((node) => node.id)

  if (startIds.length === 0 && nodes.length > 0) {
    return {
      ok: false,
      errorCode: 'WORKFLOW_NO_START_NODE',
      message: '没有可运行的起始节点。',
      nodes: snapshot(nodes, nodeById),
      executionOrder: [],
      failedNodeIds: [],
    }
  }

  const reachable = collectReachable(startIds, outgoing)
  const executionOrder = topologicalOrder(reachable, validEdges)
  if (executionOrder.length !== reachable.size) {
    return {
      ok: false,
      errorCode: 'WORKFLOW_CYCLE_DETECTED',
      message: '检测到循环连接，请先移除循环后再运行工作流。',
      nodes: snapshot(nodes, nodeById),
      executionOrder,
      failedNodeIds: [],
    }
  }

  const failedNodeIds: string[] = []

  for (const nodeId of executionOrder) {
    patchNode(nodeById, nodes, nodeId, { status: 'queued', errorMessage: undefined }, onNodeUpdate)
  }

  for (const nodeId of executionOrder) {
    const node = nodeById.get(nodeId)
    if (!node) continue

    const upstreamNodes = (incoming.get(nodeId) ?? [])
      .map((id) => nodeById.get(id))
      .filter((item): item is TNode => Boolean(item))
    const upstreamText = upstreamNodes
      .map((item) => item.resultText)
      .filter((item): item is string => Boolean(item?.trim()))
      .join('\n\n')
    const inputAssets = collectInputAssets(upstreamNodes)

    patchNode(nodeById, nodes, nodeId, { status: 'running', errorMessage: undefined }, onNodeUpdate)

    try {
      const result = await runNode({
        node: nodeById.get(nodeId) ?? node,
        upstreamNodes,
        upstreamText,
        inputAssets,
      })
      patchNode(nodeById, nodes, nodeId, { ...result, status: 'done', errorMessage: undefined }, onNodeUpdate)
    } catch (error) {
      const message = error instanceof Error ? error.message : '节点运行失败。'
      failedNodeIds.push(nodeId)
      patchNode(nodeById, nodes, nodeId, { status: 'error', errorMessage: message }, onNodeUpdate)
    }
  }

  return {
    ok: true,
    nodes: snapshot(nodes, nodeById),
    executionOrder,
    failedNodeIds,
  }
}

function collectReachable(startIds: string[], outgoing: Map<string, string[]>) {
  const visited = new Set<string>()
  const stack = [...startIds]
  while (stack.length) {
    const nodeId = stack.pop()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)
    for (const next of outgoing.get(nodeId) ?? []) {
      stack.push(next)
    }
  }
  return visited
}

function topologicalOrder(reachable: Set<string>, edges: CanvasWorkflowEdge[]) {
  const indegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const nodeId of reachable) {
    indegree.set(nodeId, 0)
    outgoing.set(nodeId, [])
  }
  for (const edge of edges) {
    if (!reachable.has(edge.fromNodeId) || !reachable.has(edge.toNodeId)) continue
    outgoing.get(edge.fromNodeId)?.push(edge.toNodeId)
    indegree.set(edge.toNodeId, (indegree.get(edge.toNodeId) ?? 0) + 1)
  }

  const queue = [...reachable].filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0)
  const order: string[] = []
  while (queue.length) {
    const nodeId = queue.shift()
    if (!nodeId) continue
    order.push(nodeId)
    for (const next of outgoing.get(nodeId) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1
      indegree.set(next, nextDegree)
      if (nextDegree === 0) queue.push(next)
    }
  }
  return order
}

function collectInputAssets<TNode extends CanvasWorkflowNode>(upstreamNodes: TNode[]): CanvasWorkflowInputAsset[] {
  return upstreamNodes.flatMap((node) => {
    const assets: CanvasWorkflowInputAsset[] = []
    if (node.resultImageUrl) assets.push({ id: node.id, type: 'image', url: node.resultImageUrl })
    if (node.resultVideoUrl) assets.push({ id: node.id, type: 'video', url: node.resultVideoUrl })
    if (node.resultAudioUrl) assets.push({ id: node.id, type: 'audio', url: node.resultAudioUrl })
    if (node.resultText) assets.push({ id: node.id, type: 'text', text: node.resultText })
    return assets
  })
}

function patchNode<TNode extends CanvasWorkflowNode>(
  nodeById: Map<string, TNode>,
  originalNodes: TNode[],
  nodeId: string,
  patch: CanvasWorkflowNodePatch,
  onNodeUpdate?: (nodeId: string, patch: CanvasWorkflowNodePatch, nodes: TNode[]) => void,
) {
  const node = nodeById.get(nodeId)
  if (!node) return
  nodeById.set(nodeId, { ...node, ...patch } as TNode)
  onNodeUpdate?.(nodeId, patch, snapshot(originalNodes, nodeById))
}

function snapshot<TNode extends CanvasWorkflowNode>(originalNodes: TNode[], nodeById: Map<string, TNode>) {
  return originalNodes.map((node) => nodeById.get(node.id) ?? node)
}
