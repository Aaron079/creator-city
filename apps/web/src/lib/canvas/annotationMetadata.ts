export const CANVAS_ANNOTATION_VERSION = 1 as const

export type CanvasAnnotationType = 'pen' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'path'

export type CanvasAnnotationPoint = {
  x: number
  y: number
}

export type CanvasAnnotationItem = {
  id: string
  type: CanvasAnnotationType
  color: string
  strokeWidth: number
  points: CanvasAnnotationPoint[]
  text?: string
  createdAt: string
}

export type CanvasAnnotationState = {
  version: typeof CANVAS_ANNOTATION_VERSION
  updatedAt: string
  imageSize?: {
    width: number
    height: number
  }
  items: CanvasAnnotationItem[]
}

const VALID_ANNOTATION_TYPES = new Set<CanvasAnnotationType>(['pen', 'arrow', 'rect', 'ellipse', 'text', 'path'])
const DEFAULT_COLOR = '#ffcc00'
const DEFAULT_STROKE_WIDTH = 3

type RectLike = {
  left: number
  top: number
  width: number
  height: number
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function normalizePoint(
  point: { clientX: number; clientY: number },
  rect: RectLike,
): CanvasAnnotationPoint {
  const width = rect.width > 0 ? rect.width : 1
  const height = rect.height > 0 ? rect.height : 1
  return {
    x: clamp01((point.clientX - rect.left) / width),
    y: clamp01((point.clientY - rect.top) / height),
  }
}

export function denormalizePoint(
  point: CanvasAnnotationPoint,
  size: { width: number; height: number },
) {
  return {
    x: point.x * size.width,
    y: point.y * size.height,
  }
}

export function createEmptyAnnotationState(
  now = new Date().toISOString(),
  imageSize?: CanvasAnnotationState['imageSize'],
): CanvasAnnotationState {
  return {
    version: CANVAS_ANNOTATION_VERSION,
    updatedAt: now,
    ...(imageSize ? { imageSize } : {}),
    items: [],
  }
}

function normalizePointValue(value: unknown): CanvasAnnotationPoint | null {
  const record = recordValue(value)
  const x = numberValue(record.x)
  const y = numberValue(record.y)
  if (x === null || y === null) return null
  return { x: clamp01(x), y: clamp01(y) }
}

function requiredPointCount(type: CanvasAnnotationType) {
  if (type === 'text') return 1
  if (type === 'pen' || type === 'path') return 2
  return 2
}

export function normalizeAnnotationItem(value: unknown): CanvasAnnotationItem | null {
  const record = recordValue(value)
  const rawType = stringValue(record.type)
  if (!VALID_ANNOTATION_TYPES.has(rawType as CanvasAnnotationType)) return null
  const type = rawType as CanvasAnnotationType
  const id = stringValue(record.id)
  if (!id) return null

  const points = Array.isArray(record.points)
    ? record.points.map(normalizePointValue).filter((point): point is CanvasAnnotationPoint => Boolean(point))
    : []
  if (points.length < requiredPointCount(type)) return null

  const strokeWidth = numberValue(record.strokeWidth)
  const color = stringValue(record.color) || DEFAULT_COLOR
  const createdAt = stringValue(record.createdAt) || new Date().toISOString()
  const text = type === 'text' ? stringValue(record.text).slice(0, 160) : undefined
  if (type === 'text' && !text) return null

  return {
    id,
    type,
    color,
    strokeWidth: Math.min(24, Math.max(1, strokeWidth ?? DEFAULT_STROKE_WIDTH)),
    points,
    ...(text ? { text } : {}),
    createdAt,
  }
}

export function normalizeAnnotationState(value: unknown): CanvasAnnotationState {
  const record = recordValue(value)
  const imageSizeRecord = recordValue(record.imageSize)
  const width = numberValue(imageSizeRecord.width)
  const height = numberValue(imageSizeRecord.height)
  const imageSize = width !== null && height !== null && width > 0 && height > 0
    ? { width, height }
    : undefined
  const items = Array.isArray(record.items)
    ? record.items.map(normalizeAnnotationItem).filter((item): item is CanvasAnnotationItem => Boolean(item))
    : []

  return {
    version: CANVAS_ANNOTATION_VERSION,
    updatedAt: stringValue(record.updatedAt) || new Date().toISOString(),
    ...(imageSize ? { imageSize } : {}),
    items,
  }
}

export function readAnnotationMetadata(metadataJson: unknown): CanvasAnnotationState {
  return normalizeAnnotationState(recordValue(metadataJson).annotations)
}

export function mergeAnnotationMetadata(args: {
  metadataJson: unknown
  annotations: CanvasAnnotationState
}): Record<string, unknown> & { annotations: CanvasAnnotationState } {
  return {
    ...recordValue(args.metadataJson),
    annotations: normalizeAnnotationState(args.annotations),
  }
}

export function appendAnnotationItem(
  state: CanvasAnnotationState,
  item: CanvasAnnotationItem,
  updatedAt = new Date().toISOString(),
): CanvasAnnotationState {
  return {
    ...normalizeAnnotationState(state),
    updatedAt,
    items: [...normalizeAnnotationState(state).items, item],
  }
}

export function undoAnnotationItem(
  state: CanvasAnnotationState,
  updatedAt = new Date().toISOString(),
): CanvasAnnotationState {
  const normalized = normalizeAnnotationState(state)
  return {
    ...normalized,
    updatedAt,
    items: normalized.items.slice(0, -1),
  }
}

export function clearAnnotationItems(
  state: CanvasAnnotationState,
  updatedAt = new Date().toISOString(),
): CanvasAnnotationState {
  return {
    ...normalizeAnnotationState(state),
    updatedAt,
    items: [],
  }
}

export function hasAnnotationItems(value: unknown) {
  return normalizeAnnotationState(value).items.length > 0
}
