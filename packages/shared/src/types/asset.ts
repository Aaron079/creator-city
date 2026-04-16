// ─── Asset ───────────────────────────────────────────────────────────────────
// Canonical source. asset.types.ts re-exports from here.

export type AssetType =
  | 'VIDEO'
  | 'AUDIO'
  | 'IMAGE'
  | 'SCRIPT'
  | 'DOCUMENT'
  | 'MODEL_3D'
  | 'PRESET'
  | 'TEMPLATE'

export type AssetStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED'

export interface AssetMetadata {
  // Video / Audio
  width?: number
  height?: number
  duration?: number    // seconds
  fps?: number
  bitrate?: number
  codec?: string
  format?: string
  colorSpace?: string
  channels?: number
  sampleRate?: number
  // Document
  pageCount?: number
  wordCount?: number
  // Extensible
  custom?: Record<string, unknown>
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  status: AssetStatus
  ownerId: string
  projectId?: string
  url: string
  thumbnailUrl?: string
  mimeType: string
  sizeBytes: number
  metadata: AssetMetadata
  tags: string[]
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AssetVersion {
  id: string
  assetId: string
  version: number
  url: string
  sizeBytes: number
  createdBy: string
  note?: string
  createdAt: Date
}

export interface AssetUploadIntent {
  assetId: string
  uploadUrl: string
  fields?: Record<string, string>
  expiresAt: Date
}
