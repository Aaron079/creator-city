export type CanvasResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type CanvasResizeRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasResizeBounds = {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

type CanvasResizeCorner = Extract<CanvasResizeHandle, 'nw' | 'ne' | 'se' | 'sw'>

type ResizeArgs<Handle extends CanvasResizeHandle> = {
  rect: CanvasResizeRect
  handle: Handle
  deltaX: number
  deltaY: number
  bounds?: CanvasResizeBounds
}

const nodeBounds: CanvasResizeBounds = {
  minWidth: 236,
  minHeight: 120,
  maxWidth: 760,
  maxHeight: 520,
}

const editorBounds: CanvasResizeBounds = {
  minWidth: 320,
  minHeight: 96,
  maxWidth: 1120,
  maxHeight: 720,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function round(value: number) {
  const rounded = Number(value.toFixed(1))
  return Object.is(rounded, -0) ? 0 : rounded
}

function roundedRect(rect: CanvasResizeRect): CanvasResizeRect {
  return {
    x: round(rect.x),
    y: round(rect.y),
    width: round(rect.width),
    height: round(rect.height),
  }
}

export function resizeNodeRect({
  rect,
  handle,
  deltaX,
  deltaY,
  bounds = nodeBounds,
}: ResizeArgs<CanvasResizeCorner>): CanvasResizeRect {
  const resizeFromWest = handle === 'nw' || handle === 'sw'
  const resizeFromNorth = handle === 'nw' || handle === 'ne'
  const horizontalMotionDominates = Math.abs(deltaX) >= Math.abs(deltaY)
  const aspectRatio = rect.width / rect.height
  const requestedWidth = horizontalMotionDominates
    ? rect.width + (resizeFromWest ? -deltaX : deltaX)
    : (rect.height + (resizeFromNorth ? -deltaY : deltaY)) * aspectRatio
  const minimumScale = Math.max(bounds.minWidth / rect.width, bounds.minHeight / rect.height)
  const maximumScale = Math.min(bounds.maxWidth / rect.width, bounds.maxHeight / rect.height)
  const scale = clamp(requestedWidth / rect.width, minimumScale, maximumScale)
  const width = rect.width * scale
  const height = rect.height * scale

  return roundedRect({
    x: resizeFromWest ? rect.x + rect.width - width : rect.x,
    y: resizeFromNorth ? rect.y + rect.height - height : rect.y,
    width,
    height,
  })
}

export function resizeEditorRect({
  rect,
  handle,
  deltaX,
  deltaY,
  bounds = editorBounds,
}: ResizeArgs<CanvasResizeHandle>): CanvasResizeRect {
  const resizeFromWest = handle === 'nw' || handle === 'w' || handle === 'sw'
  const resizeFromEast = handle === 'ne' || handle === 'e' || handle === 'se'
  const resizeFromNorth = handle === 'nw' || handle === 'n' || handle === 'ne'
  const resizeFromSouth = handle === 'sw' || handle === 's' || handle === 'se'
  const width = clamp(
    rect.width + (resizeFromWest ? -deltaX : resizeFromEast ? deltaX : 0),
    bounds.minWidth,
    bounds.maxWidth,
  )
  const height = clamp(
    rect.height + (resizeFromNorth ? -deltaY : resizeFromSouth ? deltaY : 0),
    bounds.minHeight,
    bounds.maxHeight,
  )

  return roundedRect({
    x: resizeFromWest ? rect.x + rect.width - width : rect.x,
    y: resizeFromNorth ? rect.y + rect.height - height : rect.y,
    width,
    height,
  })
}
