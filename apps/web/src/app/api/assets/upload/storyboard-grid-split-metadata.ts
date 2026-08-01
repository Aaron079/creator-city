import {
  STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID,
  type NormalizedReferenceCropBox,
  type StoryboardReferenceExtractionMetadata,
} from '@/lib/canvas/storyboardReferenceExtract'

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

export type StoryboardCropLineage = StoryboardGridSplitLineage | StoryboardReferenceExtractionMetadata

export type StoryboardCropLineageParseResult =
  | { ok: true; lineage?: StoryboardCropLineage }
  | {
      ok: false
      errorCode: 'INVALID_CROP_BOX' | 'INVALID_GRID_INDEX' | 'INVALID_REFERENCE_INDEX' | 'INVALID_REFERENCE_LINEAGE'
      message: string
    }

type UploadStorageMetadataInput = {
  storageProvider: string
  bucket?: string | null
  key?: string | null
  originalName: string
  lineage?: StoryboardCropLineage
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

function parseNormalizedReferenceCropBox(value: FormDataEntryValue | null): NormalizedReferenceCropBox | null {
  const cropBox = parseCropBox(value)
  if (!cropBox || cropBox.x > 1 || cropBox.y > 1 || cropBox.width > 1 || cropBox.height > 1) return null
  if (cropBox.x + cropBox.width > 1 || cropBox.y + cropBox.height > 1) return null
  return cropBox
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

function parseRequiredReferenceIdentifier(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_ID_LENGTH) return null
  return trimmed
}

function parseRequiredNonNegativeInt(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return null
  return value
}

export function parseStoryboardCropLineage(formData: FormData): StoryboardCropLineageParseResult {
  const toolId = formData.get('toolId')
  if (toolId === STORYBOARD_GRID_SPLIT_TOOL_ID) return parseStoryboardGridSplitLineage(formData)
  if (toolId !== STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID) return { ok: true }

  const cropBox = parseNormalizedReferenceCropBox(formData.get('cropBox'))
  if (!cropBox) {
    return { ok: false, errorCode: 'INVALID_CROP_BOX', message: '裁切元数据无效。' }
  }

  const index = parseRequiredNonNegativeInt(formData, 'index')
  if (index === null) {
    return { ok: false, errorCode: 'INVALID_REFERENCE_INDEX', message: '参考图提取序号无效。' }
  }

  const parentAssetId = parseRequiredReferenceIdentifier(formData, 'parentAssetId')
  const sourceAssetId = parseRequiredReferenceIdentifier(formData, 'sourceAssetId')
  const sourceNodeId = parseRequiredReferenceIdentifier(formData, 'sourceNodeId')
  const extractionSessionId = parseRequiredReferenceIdentifier(formData, 'extractionSessionId')
  if (!parentAssetId || !sourceAssetId || !sourceNodeId || !extractionSessionId || parentAssetId !== sourceAssetId) {
    return { ok: false, errorCode: 'INVALID_REFERENCE_LINEAGE', message: '参考图提取来源无效。' }
  }

  return {
    ok: true,
    lineage: {
      version: 2,
      toolId: STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID,
      parentAssetId,
      sourceAssetId,
      sourceNodeId,
      extractionSessionId,
      index,
      cropBox,
    },
  }
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
