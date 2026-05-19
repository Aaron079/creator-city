import type { Node, Edge } from '@xyflow/react'

export type CanvasV2NodeKind = 'text' | 'image' | 'video' | 'asset' | 'generation'

export type CanvasV2NodeData = {
  nodeId: string
  kind: CanvasV2NodeKind
  title?: string
  prompt?: string
  status?: 'idle' | 'running' | 'succeeded' | 'failed'
  providerRegion?: 'cn' | 'global'
  executionRegion?: 'cn' | 'global'
  storageRegion?: 'cn' | 'global'
  providerId?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  thumbnailUrl?: string
  errorMessage?: string
  assetId?: string
  workflowId?: string
  projectId?: string
  metadataJson?: Record<string, unknown>
  [key: string]: unknown
}

export type CanvasV2EdgeData = {
  edgeId: string
  type?: string
  status?: string
  [key: string]: unknown
}

export type FlowNode = Node<CanvasV2NodeData>
export type FlowEdge = Edge<CanvasV2EdgeData>

export type CanvasNodeRecord = {
  nodeId: string
  kind: string
  title?: string | null
  prompt?: string | null
  status?: string | null
  x?: number
  y?: number
  width?: number
  height?: number
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  errorMessage?: string | null
  metadataJson?: Record<string, unknown> | null
  paramsJson?: Record<string, unknown> | null
}

export type CanvasEdgeRecord = {
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  type?: string | null
  metadataJson?: Record<string, unknown> | null
}

export function canvasNodesToFlowNodes(records: CanvasNodeRecord[]): FlowNode[] {
  return records.map((r): FlowNode => {
    const meta = (r.metadataJson && typeof r.metadataJson === 'object' && !Array.isArray(r.metadataJson))
      ? r.metadataJson as Record<string, unknown> : {}
    const params = (r.paramsJson && typeof r.paramsJson === 'object') ? r.paramsJson as Record<string, unknown> : {}
    return {
      id: r.nodeId,
      type: 'canvasV2Node',
      position: { x: Number(r.x ?? 0), y: Number(r.y ?? 0) },
      data: {
        nodeId: r.nodeId,
        kind: (r.kind as CanvasV2NodeKind) ?? 'text',
        title: typeof r.title === 'string' ? r.title : undefined,
        prompt: typeof r.prompt === 'string' ? r.prompt : undefined,
        status: (r.status as CanvasV2NodeData['status']) ?? 'idle',
        providerRegion: (typeof meta.providerRegion === 'string' ? meta.providerRegion : undefined) as CanvasV2NodeData['providerRegion'],
        executionRegion: (typeof meta.executionRegion === 'string' ? meta.executionRegion : undefined) as CanvasV2NodeData['executionRegion'],
        storageRegion: (typeof meta.storageRegion === 'string' ? meta.storageRegion : undefined) as CanvasV2NodeData['storageRegion'],
        providerId: typeof meta.providerId === 'string' ? meta.providerId : (typeof params.model === 'string' ? params.model : undefined),
        resultImageUrl: typeof r.resultImageUrl === 'string' ? r.resultImageUrl : undefined,
        resultVideoUrl: typeof r.resultVideoUrl === 'string' ? r.resultVideoUrl : undefined,
        thumbnailUrl: typeof meta.thumbnailUrl === 'string' ? meta.thumbnailUrl : (typeof r.resultImageUrl === 'string' ? r.resultImageUrl : undefined),
        errorMessage: typeof r.errorMessage === 'string' ? r.errorMessage : undefined,
        assetId: typeof meta.assetId === 'string' ? meta.assetId : undefined,
        workflowId: typeof meta.workflowId === 'string' ? meta.workflowId : undefined,
        projectId: typeof meta.projectId === 'string' ? meta.projectId : undefined,
        metadataJson: meta,
      },
    }
  })
}

export function flowNodesToCanvasNodes(nodes: FlowNode[], workflowId: string, projectId: string): CanvasNodeRecord[] {
  return nodes.map((n): CanvasNodeRecord => ({
    nodeId: n.id,
    kind: n.data.kind,
    title: n.data.title ?? null,
    prompt: n.data.prompt ?? null,
    status: n.data.status ?? 'idle',
    x: n.position.x,
    y: n.position.y,
    width: 280,
    height: 200,
    resultImageUrl: n.data.resultImageUrl ?? null,
    resultVideoUrl: n.data.resultVideoUrl ?? null,
    errorMessage: n.data.errorMessage ?? null,
    metadataJson: {
      ...n.data.metadataJson,
      nodeId: n.id,
      workflowId,
      projectId,
      providerId: n.data.providerId,
      providerRegion: n.data.providerRegion,
      executionRegion: n.data.executionRegion,
      storageRegion: n.data.storageRegion,
      assetId: n.data.assetId,
    },
    paramsJson: { model: n.data.providerId ?? null },
  }))
}

export function canvasEdgesToFlowEdges(records: CanvasEdgeRecord[]): FlowEdge[] {
  return records.map((r): FlowEdge => ({
    id: r.edgeId,
    source: r.sourceNodeId,
    target: r.targetNodeId,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#7c3aed', strokeWidth: 2 },
    data: { edgeId: r.edgeId, type: r.type ?? 'flow', status: 'active' },
  }))
}

export function flowEdgesToCanvasEdges(edges: FlowEdge[]): CanvasEdgeRecord[] {
  return edges.map((e): CanvasEdgeRecord => ({
    edgeId: e.id,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    type: 'flow',
    metadataJson: { status: 'active' },
  }))
}

export function normalizeCanvasV2Node(partial: Partial<CanvasV2NodeData> & { nodeId: string; kind: CanvasV2NodeKind }): CanvasV2NodeData {
  return { status: 'idle', providerRegion: 'cn', executionRegion: 'cn', storageRegion: 'cn', ...partial }
}

export function normalizeCanvasV2Edge(partial: Partial<CanvasV2EdgeData> & { edgeId: string }): CanvasV2EdgeData {
  return { type: 'flow', status: 'active', ...partial }
}
