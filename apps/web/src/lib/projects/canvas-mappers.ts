import type { AssetType } from '@prisma/client'

type DbCanvasNode = {
  id: string
  nodeId: string
  kind: string
  title: string | null
  providerId: string | null
  status: string
  x: number
  y: number
  width: number
  height: number
  prompt: string | null
  resultText: string | null
  resultImageUrl: string | null
  resultVideoUrl: string | null
  resultAudioUrl: string | null
  resultPreview: string | null
  errorMessage: string | null
  paramsJson: unknown
  metadataJson: unknown
  createdAt: Date
  updatedAt: Date
}

type DbCanvasEdge = {
  id: string
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  type: string | null
  metadataJson: unknown
  createdAt: Date
  updatedAt: Date
}

export function mapCanvasNode(row: DbCanvasNode) {
  const params = row.paramsJson && typeof row.paramsJson === 'object'
    ? row.paramsJson as Record<string, unknown>
    : {}
  const metadata = row.metadataJson && typeof row.metadataJson === 'object'
    ? row.metadataJson as Record<string, unknown>
    : {}

  return {
    id: row.nodeId,
    type: row.kind,
    kind: row.kind,
    title: row.title ?? String(metadata.title ?? row.kind),
    subtitle: String(metadata.subtitle ?? ''),
    prompt: row.prompt ?? '',
    model: row.providerId ?? String(params.model ?? ''),
    providerId: row.providerId ?? String(params.model ?? ''),
    stage: String(params.stage ?? 'draft'),
    ratio: typeof params.ratio === 'string' ? params.ratio : undefined,
    status: row.status,
    resultText: row.resultText ?? undefined,
    resultImageUrl: row.resultImageUrl ?? undefined,
    resultVideoUrl: row.resultVideoUrl ?? undefined,
    resultAudioUrl: row.resultAudioUrl ?? undefined,
    resultPreview: row.resultPreview ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    outputLabel: typeof metadata.outputLabel === 'string' ? metadata.outputLabel : undefined,
    preview: metadata.preview,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.getTime(),
  }
}

export function mapCanvasEdge(row: DbCanvasEdge) {
  return {
    id: row.edgeId,
    fromNodeId: row.sourceNodeId,
    toNodeId: row.targetNodeId,
    status: typeof row.metadataJson === 'object'
      && row.metadataJson
      && 'status' in row.metadataJson
      ? String((row.metadataJson as { status?: unknown }).status)
      : 'active',
  }
}

export function toAssetType(input: string | undefined): AssetType {
  if (input === 'image') return 'IMAGE'
  if (input === 'video') return 'VIDEO'
  if (input === 'audio') return 'AUDIO'
  if (input === 'text') return 'SCRIPT'
  return 'DOCUMENT'
}

export function serializeAsset<T extends { sizeBytes?: bigint | number | null }>(asset: T) {
  return {
    ...asset,
    sizeBytes: typeof asset.sizeBytes === 'bigint' ? Number(asset.sizeBytes) : asset.sizeBytes,
  }
}
