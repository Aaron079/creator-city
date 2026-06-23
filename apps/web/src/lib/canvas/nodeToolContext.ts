import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

export interface NodeToolContext {
  projectId: string
  targetNodeId: string
  targetAssetId?: string
  targetKind: VisualCanvasNodeKind
  targetTitle: string
  prompt?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  posterUrl?: string
  hasMediaResult: boolean
  sourceRevision?: number
}
