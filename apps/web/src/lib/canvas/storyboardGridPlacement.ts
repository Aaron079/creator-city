export type CanvasBounds = { x: number; y: number; width: number; height: number }
export type GridCellCoordinates = { row: number; col: number }

const GAP = 24
const SOURCE_GAP_X = 240
const COLUMN_GAP_X = 60
const ROW_GAP_Y = 25
const COLLISION_STEP_Y = 320
const FALLBACK_STEP_X = 120

function overlaps(left: CanvasBounds, right: CanvasBounds) {
  return !(
    left.x + left.width + GAP < right.x ||
    right.x + right.width + GAP < left.x ||
    left.y + left.height + GAP < right.y ||
    right.y + right.height + GAP < left.y
  )
}

export function resolveStoryboardGridCellPosition(input: {
  source: CanvasBounds
  cell: GridCellCoordinates
  size: Pick<CanvasBounds, 'width' | 'height'>
  occupied: CanvasBounds[]
}) {
  const candidate = {
    x: input.source.x + input.source.width + SOURCE_GAP_X + input.cell.col * (input.size.width + COLUMN_GAP_X),
    y: input.source.y + input.cell.row * (input.size.height + ROW_GAP_Y),
    width: input.size.width,
    height: input.size.height,
  }
  let next = { ...candidate }
  let guard = 0

  while (input.occupied.some((node) => overlaps(next, node)) && guard < 8) {
    next = { ...next, y: next.y + COLLISION_STEP_Y }
    guard += 1
  }

  if (input.occupied.some((node) => overlaps(next, node))) {
    next = { ...candidate, x: candidate.x + FALLBACK_STEP_X }
    guard = 0
    while (input.occupied.some((node) => overlaps(next, node)) && guard < 8) {
      next = { ...next, y: next.y + COLLISION_STEP_Y }
      guard += 1
    }
  }

  return { x: next.x, y: next.y }
}
