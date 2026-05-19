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
  errorCode?: string
  assetId?: string
  workflowId?: string
  projectId?: string
  executorKind?: 'aliyun_fc' | 'vercel' | string
  generationJobId?: string
  upstreamMessage?: string
  metadataJson?: Record<string, unknown>
  paramsJson?: Record<string, unknown>
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

/**
 * Convert nodes from the canvas GET API response (mapCanvasNode shape) to ReactFlow nodes.
 * The GET API returns: { id, kind, title, prompt, status, x, y, resultImageUrl, resultVideoUrl,
 * errorMessage, metadataJson, providerId, ... }
 */
export function canvasNodesToFlowNodes(records: CanvasNodeRecord[]): FlowNode[] {
  return records.map((r): FlowNode => {
    const meta = (r.metadataJson && typeof r.metadataJson === 'object' && !Array.isArray(r.metadataJson))
      ? r.metadataJson as Record<string, unknown> : {}
    const params = (r.paramsJson && typeof r.paramsJson === 'object') ? r.paramsJson as Record<string, unknown> : {}

    // Extract executorKind from metadataJson
    const executorKind = typeof meta.executorKind === 'string' ? meta.executorKind
      : typeof meta.executor_kind === 'string' ? meta.executor_kind
      : undefined

    // Extract generationJobId from metadataJson
    const generationJobId = typeof meta.generationJobId === 'string' ? meta.generationJobId
      : typeof meta.generation_job_id === 'string' ? meta.generation_job_id
      : typeof meta.jobId === 'string' ? meta.jobId
      : undefined

    // Extract errorCode from metadataJson
    const errorCode = typeof meta.errorCode === 'string' ? meta.errorCode
      : typeof meta.error_code === 'string' ? meta.error_code
      : undefined

    // Extract upstreamMessage from metadataJson
    const upstreamMessage = typeof meta.upstreamMessage === 'string' ? meta.upstreamMessage
      : typeof meta.upstream_message === 'string' ? meta.upstream_message
      : undefined

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
        errorCode,
        assetId: typeof meta.assetId === 'string' ? meta.assetId : undefined,
        workflowId: typeof meta.workflowId === 'string' ? meta.workflowId : undefined,
        projectId: typeof meta.projectId === 'string' ? meta.projectId : undefined,
        executorKind,
        generationJobId,
        upstreamMessage,
        metadataJson: meta,
        paramsJson: params,
      },
    }
  })
}

/**
 * Convert API edge records (with fromNodeId/toNodeId shape from mapCanvasEdge) to ReactFlow edges.
 */
export type CanvasApiEdgeRecord = {
  id: string
  fromNodeId: string
  toNodeId: string
  type?: string | null
  metadataJson?: Record<string, unknown>
  status?: string
}

export function canvasApiEdgesToFlowEdges(records: CanvasApiEdgeRecord[]): FlowEdge[] {
  return records.map((r): FlowEdge => ({
    id: r.id,
    source: r.fromNodeId,
    target: r.toNodeId,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#7c3aed', strokeWidth: 2 },
    data: { edgeId: r.id, type: r.type ?? 'flow', status: r.status ?? 'active' },
  }))
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
      executorKind: n.data.executorKind,
      generationJobId: n.data.generationJobId,
      errorCode: n.data.errorCode,
      upstreamMessage: n.data.upstreamMessage,
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
