export const STORYBOARD_GRID_SPLIT_TOOL_ID = 'storyboard-grid-split'

export const STORYBOARD_GRID_LAYOUTS = [
  { id: '1x2', rows: 1, cols: 2 },
  { id: '2x1', rows: 2, cols: 1 },
  { id: '2x2', rows: 2, cols: 2 },
  { id: '3x2', rows: 3, cols: 2 },
  { id: '2x3', rows: 2, cols: 3 },
  { id: '3x3', rows: 3, cols: 3 },
  { id: '4x3', rows: 4, cols: 3 },
] as const

export type StoryboardGridLayoutId = (typeof STORYBOARD_GRID_LAYOUTS)[number]['id']

export type StoryboardGridCell = {
  index: number
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
}

export type StoryboardGridCropMetadata = {
  version: 1
  toolId: typeof STORYBOARD_GRID_SPLIT_TOOL_ID
  sourceNodeId: string
  sourceAssetId: string
  parentAssetId: string
  gridSessionId: string
  cellIndex: number
  row: number
  col: number
  index: number
  cropBox: { x: number; y: number; width: number; height: number }
}

export type ImageDataLike = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type StoryboardGridSelectionMode = 'confirmed' | 'needs-confirmation' | 'manual'

export type StoryboardGridDetectionReason =
  | 'confirmed-grid'
  | 'ambiguous-grid'
  | 'manual-fallback'

export type StoryboardGridDetectionResult = {
  layoutId: StoryboardGridLayoutId | null
  confidence: number
  reason: StoryboardGridDetectionReason
  selectionMode: StoryboardGridSelectionMode
}

function round(value: number) {
  return Number(value.toFixed(6))
}

export function validateGridLayout(layoutId: string) {
  const layout = STORYBOARD_GRID_LAYOUTS.find((item) => item.id === layoutId)
  return layout
    ? { ok: true as const, layout }
    : { ok: false as const, error: 'INVALID_GRID_LAYOUT' }
}

export function buildGridCells(layoutId: StoryboardGridLayoutId | string, width: number, height: number): StoryboardGridCell[] {
  const validation = validateGridLayout(layoutId)
  if (!validation.ok) return []
  const { rows, cols } = validation.layout
  const cells: StoryboardGridCell[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = Math.round((col * width) / cols)
      const y = Math.round((row * height) / rows)
      const nextX = col === cols - 1 ? width : Math.round(((col + 1) * width) / cols)
      const nextY = row === rows - 1 ? height : Math.round(((row + 1) * height) / rows)
      cells.push({
        index: row * cols + col,
        row,
        col,
        x,
        y,
        width: nextX - x,
        height: nextY - y,
      })
    }
  }
  return cells
}

export function buildCropMetadata(args: {
  cell: StoryboardGridCell
  sourceWidth: number
  sourceHeight: number
  sourceNodeId: string
  sourceAssetId: string
  parentAssetId: string
  gridSessionId: string
}): StoryboardGridCropMetadata {
  const cropBox = {
    x: round(args.cell.x / args.sourceWidth),
    y: round(args.cell.y / args.sourceHeight),
    width: round(args.cell.width / args.sourceWidth),
    height: round(args.cell.height / args.sourceHeight),
  }
  return {
    version: 1,
    toolId: STORYBOARD_GRID_SPLIT_TOOL_ID,
    sourceNodeId: args.sourceNodeId,
    sourceAssetId: args.sourceAssetId,
    parentAssetId: args.parentAssetId,
    gridSessionId: args.gridSessionId,
    cellIndex: args.cell.index,
    row: args.cell.row,
    col: args.cell.col,
    index: args.cell.index,
    cropBox,
  }
}

const BOUNDARY_SAMPLE_COUNT = 24
const BOUNDARY_NEIGHBOR_OFFSET = 5
const MIN_BOUNDARY_PROMINENCE = 0.45
const MIN_BOUNDARY_COVERAGE = 0.9
const MIN_CONFIRMED_CONFIDENCE = 0.78
const MIN_CONFIRMATION_MARGIN = 0.015

type BoundaryEvidence = {
  prominence: number
  coverage: number
}

type LayoutEvidence = {
  layoutId: StoryboardGridLayoutId
  confidence: number
  expectedLines: number
  everyBoundaryReliable: boolean
  hasReliableBoundaryOnBothAxes: boolean
}

function clampCoordinate(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)))
}

function darknessAt(image: ImageDataLike, x: number, y: number) {
  const index = (y * image.width + x) * 4
  const brightness = ((image.data[index] ?? 255) + (image.data[index + 1] ?? 255) + (image.data[index + 2] ?? 255)) / 3
  return 1 - brightness / 255
}

function boundaryEvidence(image: ImageDataLike, axis: 'x' | 'y', position: number): BoundaryEvidence {
  const crossAxisMax = axis === 'x' ? image.height - 1 : image.width - 1
  const boundaryMax = axis === 'x' ? image.width - 1 : image.height - 1
  const boundary = clampCoordinate(position, boundaryMax)
  const before = clampCoordinate(boundary - BOUNDARY_NEIGHBOR_OFFSET, boundaryMax)
  const after = clampCoordinate(boundary + BOUNDARY_NEIGHBOR_OFFSET, boundaryMax)
  let prominenceTotal = 0
  let presentCount = 0

  for (let sample = 0; sample < BOUNDARY_SAMPLE_COUNT; sample += 1) {
    const crossAxisPosition = clampCoordinate(((sample + 0.5) * (crossAxisMax + 1)) / BOUNDARY_SAMPLE_COUNT, crossAxisMax)
    const lineDarkness = axis === 'x'
      ? darknessAt(image, boundary, crossAxisPosition)
      : darknessAt(image, crossAxisPosition, boundary)
    const neighborDarkness = axis === 'x'
      ? (darknessAt(image, before, crossAxisPosition) + darknessAt(image, after, crossAxisPosition)) / 2
      : (darknessAt(image, crossAxisPosition, before) + darknessAt(image, crossAxisPosition, after)) / 2
    const prominence = Math.max(0, lineDarkness - neighborDarkness)
    prominenceTotal += prominence
    if (prominence >= MIN_BOUNDARY_PROMINENCE) presentCount += 1
  }

  return {
    prominence: prominenceTotal / BOUNDARY_SAMPLE_COUNT,
    coverage: presentCount / BOUNDARY_SAMPLE_COUNT,
  }
}

function isReliableBoundary(evidence: BoundaryEvidence) {
  return evidence.prominence >= MIN_BOUNDARY_PROMINENCE && evidence.coverage >= MIN_BOUNDARY_COVERAGE
}

function scoreLayout(image: ImageDataLike, layoutId: StoryboardGridLayoutId): LayoutEvidence {
  const validation = validateGridLayout(layoutId)
  if (!validation.ok) {
    return {
      layoutId,
      confidence: 0,
      expectedLines: 0,
      everyBoundaryReliable: false,
      hasReliableBoundaryOnBothAxes: false,
    }
  }

  const { rows, cols } = validation.layout
  const vertical = Array.from({ length: cols - 1 }, (_, index) => boundaryEvidence(image, 'x', (image.width * (index + 1)) / cols))
  const horizontal = Array.from({ length: rows - 1 }, (_, index) => boundaryEvidence(image, 'y', (image.height * (index + 1)) / rows))
  const boundaries = [...vertical, ...horizontal]
  const expectedLines = boundaries.length
  const averageProminence = boundaries.reduce((total, evidence) => total + evidence.prominence, 0) / expectedLines
  const minimumCoverage = Math.min(...boundaries.map((evidence) => evidence.coverage))

  return {
    layoutId,
    confidence: averageProminence * minimumCoverage,
    expectedLines,
    everyBoundaryReliable: boundaries.every(isReliableBoundary),
    hasReliableBoundaryOnBothAxes: vertical.some(isReliableBoundary) && horizontal.some(isReliableBoundary),
  }
}

function rankedScore(evidence: LayoutEvidence) {
  return evidence.confidence + evidence.expectedLines * 0.01
}

function resolveDetection(candidates: LayoutEvidence[]): StoryboardGridDetectionResult {
  const ordered = [...candidates].sort((left, right) => rankedScore(right) - rankedScore(left))
  const best = ordered[0]
  if (!best || best.confidence < MIN_CONFIRMED_CONFIDENCE) {
    return { layoutId: null, confidence: best?.confidence ?? 0, reason: 'manual-fallback', selectionMode: 'manual' }
  }
  if (!best.everyBoundaryReliable || !best.hasReliableBoundaryOnBothAxes) {
    return { layoutId: best.layoutId, confidence: best.confidence, reason: 'ambiguous-grid', selectionMode: 'needs-confirmation' }
  }

  const nextReliableCandidate = ordered.find((candidate) => candidate !== best && candidate.hasReliableBoundaryOnBothAxes)
  if (nextReliableCandidate && rankedScore(best) - rankedScore(nextReliableCandidate) < MIN_CONFIRMATION_MARGIN) {
    return { layoutId: best.layoutId, confidence: best.confidence, reason: 'ambiguous-grid', selectionMode: 'needs-confirmation' }
  }

  return { layoutId: best.layoutId, confidence: best.confidence, reason: 'confirmed-grid', selectionMode: 'confirmed' }
}

export function detectGridLayoutFromImageData(image: ImageDataLike): StoryboardGridDetectionResult {
  return resolveDetection(STORYBOARD_GRID_LAYOUTS.map((layout) => scoreLayout(image, layout.id)))
}

export function detectGridLayout(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): StoryboardGridDetectionResult {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { layoutId: null, confidence: 0, reason: 'manual-fallback', selectionMode: 'manual' }
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return detectGridLayoutFromImageData(imageData)
}
