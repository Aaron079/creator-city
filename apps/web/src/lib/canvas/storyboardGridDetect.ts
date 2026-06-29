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

function darknessAtColumn(image: ImageDataLike, x: number) {
  let total = 0
  for (let y = 0; y < image.height; y += 1) {
    const idx = (y * image.width + x) * 4
    const brightness = ((image.data[idx] ?? 255) + (image.data[idx + 1] ?? 255) + (image.data[idx + 2] ?? 255)) / 3
    total += 1 - brightness / 255
  }
  return total / image.height
}

function darknessAtRow(image: ImageDataLike, y: number) {
  let total = 0
  for (let x = 0; x < image.width; x += 1) {
    const idx = (y * image.width + x) * 4
    const brightness = ((image.data[idx] ?? 255) + (image.data[idx + 1] ?? 255) + (image.data[idx + 2] ?? 255)) / 3
    total += 1 - brightness / 255
  }
  return total / image.width
}

function boundaryScore(image: ImageDataLike, axis: 'x' | 'y', pos: number) {
  const max = axis === 'x' ? image.width - 1 : image.height - 1
  let best = 0
  for (let offset = -3; offset <= 3; offset += 1) {
    const line = Math.max(0, Math.min(max, Math.round(pos + offset)))
    best = Math.max(best, axis === 'x' ? darknessAtColumn(image, line) : darknessAtRow(image, line))
  }
  return best
}

function scoreLayout(image: ImageDataLike, layoutId: StoryboardGridLayoutId) {
  const validation = validateGridLayout(layoutId)
  if (!validation.ok) return 0
  const { rows, cols } = validation.layout
  const scores: number[] = []
  for (let col = 1; col < cols; col += 1) {
    scores.push(boundaryScore(image, 'x', (image.width * col) / cols))
  }
  for (let row = 1; row < rows; row += 1) {
    scores.push(boundaryScore(image, 'y', (image.height * row) / rows))
  }
  if (!scores.length) return 0
  return scores.reduce((sum, value) => sum + value, 0) / scores.length
}

export function detectGridLayoutFromImageData(image: ImageDataLike) {
  let best: { layoutId: StoryboardGridLayoutId; confidence: number; expectedLines: number } | null = null
  for (const layout of STORYBOARD_GRID_LAYOUTS) {
    const confidence = scoreLayout(image, layout.id)
    const expectedLines = (layout.rows - 1) + (layout.cols - 1)
    if (
      !best ||
      confidence > best.confidence ||
      (Math.abs(confidence - best.confidence) < 0.0001 && expectedLines > best.expectedLines)
    ) {
      best = { layoutId: layout.id, confidence, expectedLines }
    }
  }
  const confidence = best?.confidence ?? 0
  return confidence >= 0.7
    ? { layoutId: best?.layoutId ?? null, confidence, reason: 'detected-grid-lines' as const }
    : { layoutId: null, confidence, reason: 'manual-fallback' as const }
}

export function detectGridLayout(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { layoutId: null, confidence: 0, reason: 'manual-fallback' as const }
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return detectGridLayoutFromImageData(imageData)
}
