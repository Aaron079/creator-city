export type KeyframePreviewStatus =
  | 'available'
  | 'not-extracted'
  | 'cors-restricted'
  | 'video-unavailable'

export type KeyframeExtractionProvenance = {
  version: 1
  sourceNodeId: string
  sourceAssetId?: string
  sourceVideoUrlAvailable: boolean
  selectedTimeSeconds: number
  selectedTimeLabel: string
  evidenceKind: 'browser-frame-preview' | 'time-point-reference'
  previewStatus: KeyframePreviewStatus
  createdAt: string
}

export function buildKeyframeExtractionProvenance(input: {
  sourceNodeId: string
  sourceAssetId?: string
  sourceVideoUrlAvailable: boolean
  selectedTimeSeconds: number
  selectedTimeLabel: string
  hasLocalFrame: boolean
  previewStatus: KeyframePreviewStatus
  createdAt: string
}): KeyframeExtractionProvenance {
  if (!input.sourceNodeId.trim()) throw new Error('Keyframe source node ID is required')
  if (!input.selectedTimeLabel.trim()) throw new Error('Keyframe time label is required')
  if (!Number.isFinite(input.selectedTimeSeconds) || input.selectedTimeSeconds < 0) {
    throw new Error('Keyframe time must be a non-negative finite number')
  }
  if (input.hasLocalFrame && input.previewStatus !== 'available') {
    throw new Error('Keyframe local frame evidence requires an available preview status')
  }

  return {
    version: 1,
    sourceNodeId: input.sourceNodeId,
    ...(input.sourceAssetId?.trim() ? { sourceAssetId: input.sourceAssetId } : {}),
    sourceVideoUrlAvailable: input.sourceVideoUrlAvailable,
    selectedTimeSeconds: input.selectedTimeSeconds,
    selectedTimeLabel: input.selectedTimeLabel,
    evidenceKind: input.hasLocalFrame ? 'browser-frame-preview' : 'time-point-reference',
    previewStatus: input.previewStatus,
    createdAt: input.createdAt,
  }
}
