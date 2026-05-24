export type GenerationTaskStatus = 'running' | 'done' | 'error'

export type CanvasGenerationTaskNode = {
  id: string
  title?: string
  kind?: string
  providerId?: string
  model?: string
  status?: string
  resultVideoUrl?: string
  resultImageUrl?: string
  resultAudioUrl?: string
  errorMessage?: string
  generationJobId?: string
  metadataJson?: unknown
}

export type CanvasGenerationTask = {
  nodeId: string
  nodeTitle: string
  kind: string
  providerId: string
  model: string
  taskId: string
  status: GenerationTaskStatus
  submittedAt?: string
  completedAt?: string
  lastCheckedAt?: string
  resultUrl?: string
  errorMessage?: string
}

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function taskStatus(node: CanvasGenerationTaskNode, metadata: Record<string, unknown>): GenerationTaskStatus {
  if (node.status === 'error' || node.status === 'failed' || node.status === 'cancelled') return 'error'
  if (node.status === 'done' || node.resultVideoUrl || metadata.completedAt) return 'done'
  return 'running'
}

export function collectGenerationTasks(nodes: CanvasGenerationTaskNode[]): CanvasGenerationTask[] {
  return nodes.flatMap((node) => {
    const metadata = metadataRecord(node.metadataJson)
    const taskId = stringValue(metadata.taskId)
      || stringValue(metadata.generationJobId)
      || stringValue(node.generationJobId)
    if (!taskId) return []

    const resultUrl = stringValue(node.resultVideoUrl)
      || stringValue(node.resultImageUrl)
      || stringValue(node.resultAudioUrl)

    return [{
      nodeId: node.id,
      nodeTitle: node.title || node.id,
      kind: node.kind || 'unknown',
      providerId: node.providerId || stringValue(metadata.providerId),
      model: stringValue(metadata.model) || node.model || '',
      taskId,
      status: taskStatus(node, metadata),
      submittedAt: stringValue(metadata.submittedAt) || undefined,
      completedAt: stringValue(metadata.completedAt) || undefined,
      lastCheckedAt: stringValue(metadata.lastCheckedAt) || undefined,
      resultUrl: resultUrl || undefined,
      errorMessage: node.errorMessage || stringValue((metadata.lastError as Record<string, unknown> | undefined)?.message) || undefined,
    }]
  })
}
