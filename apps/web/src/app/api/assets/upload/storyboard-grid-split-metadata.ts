export const STORYBOARD_GRID_SPLIT_TOOL_ID = 'storyboard-grid-split'

const MAX_ID_LENGTH = 200

export type StoryboardGridCropBox = {
  x: number
  y: number
  width: number
  height: number
}

export type StoryboardGridSplitLineage = {
  version: 1
  toolId: typeof STORYBOARD_GRID_SPLIT_TOOL_ID
  parentAssetId?: string
  sourceAssetId?: string
  sourceNodeId?: string
  gridSessionId?: string
  cropBox: StoryboardGridCropBox
  row?: number
  col?: number
  index?: number
}

export type StoryboardGridSplitLineageParseResult =
  | { ok: true; lineage?: StoryboardGridSplitLineage }
  | { ok: false; errorCode: 'INVALID_CROP_BOX' | 'INVALID_GRID_INDEX'; message: string }

type UploadStorageMetadataInput = {
  storageProvider: string
  bucket?: string | null
  key?: string | null
  originalName: string
  lineage?: StoryboardGridSplitLineage
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_ID_LENGTH)
}

function parseCropBox(value: FormDataEntryValue | null): StoryboardGridCropBox | null {
  if (typeof value !== 'string') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  const cropBox = {
    x: record.x,
    y: record.y,
    width: record.width,
    height: record.height,
  }
  if (
    typeof cropBox.x !== 'number' ||
    typeof cropBox.y !== 'number' ||
    typeof cropBox.width !== 'number' ||
    typeof cropBox.height !== 'number' ||
    !Number.isFinite(cropBox.x) ||
    !Number.isFinite(cropBox.y) ||
    !Number.isFinite(cropBox.width) ||
    !Number.isFinite(cropBox.height) ||
    cropBox.x < 0 ||
    cropBox.y < 0 ||
    cropBox.width <= 0 ||
    cropBox.height <= 0
  ) {
    return null
  }
  return cropBox as StoryboardGridCropBox
}

function parseOptionalNonNegativeInt(formData: FormData, key: 'row' | 'col' | 'index') {
  const raw = formData.get(key)
  if (raw == null || raw === '') return { ok: true as const }
  if (typeof raw !== 'string') return { ok: false as const }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return { ok: false as const }
  return { ok: true as const, value }
}

export function parseStoryboardGridSplitLineage(formData: FormData): StoryboardGridSplitLineageParseResult {
  if (formData.get('toolId') !== STORYBOARD_GRID_SPLIT_TOOL_ID) return { ok: true }

  const cropBox = parseCropBox(formData.get('cropBox'))
  if (!cropBox) {
    return {
      ok: false,
      errorCode: 'INVALID_CROP_BOX',
      message: '裁切元数据无效。',
    }
  }

  const row = parseOptionalNonNegativeInt(formData, 'row')
  const col = parseOptionalNonNegativeInt(formData, 'col')
  const index = parseOptionalNonNegativeInt(formData, 'index')
  if (!row.ok || !col.ok || !index.ok) {
    return {
      ok: false,
      errorCode: 'INVALID_GRID_INDEX',
      message: '裁切元数据无效。',
    }
  }

  const lineage: StoryboardGridSplitLineage = {
    version: 1,
    toolId: STORYBOARD_GRID_SPLIT_TOOL_ID,
    ...(formString(formData, 'parentAssetId') ? { parentAssetId: formString(formData, 'parentAssetId') } : {}),
    ...(formString(formData, 'sourceAssetId') ? { sourceAssetId: formString(formData, 'sourceAssetId') } : {}),
    ...(formString(formData, 'sourceNodeId') ? { sourceNodeId: formString(formData, 'sourceNodeId') } : {}),
    ...(formString(formData, 'gridSessionId') ? { gridSessionId: formString(formData, 'gridSessionId') } : {}),
    cropBox,
    ...(row.value !== undefined ? { row: row.value } : {}),
    ...(col.value !== undefined ? { col: col.value } : {}),
    ...(index.value !== undefined ? { index: index.value } : {}),
  }

  return { ok: true, lineage }
}

export function buildUploadAssetMetadata(args: UploadStorageMetadataInput) {
  return {
    storageProvider: args.storageProvider,
    ...(args.bucket != null ? { bucket: args.bucket } : {}),
    ...(args.key != null ? { key: args.key, storageKey: args.key } : {}),
    originalName: args.originalName,
    source: 'assets-upload',
    ...(args.lineage ? { cropLineage: args.lineage } : {}),
  }
}
