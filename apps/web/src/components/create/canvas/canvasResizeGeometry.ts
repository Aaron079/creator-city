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

const nodeHandles = new Set<CanvasResizeCorner>(['nw', 'ne', 'se', 'sw'])
const editorHandles = new Set<CanvasResizeHandle>(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'])

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function validateFinite(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`)
  }
}

function validatePositiveFinite(value: number, name: string) {
  validateFinite(value, name)
  if (value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero`)
  }
}

function validateRect(rect: CanvasResizeRect) {
  validateFinite(rect.x, 'rect.x')
  validateFinite(rect.y, 'rect.y')
  validatePositiveFinite(rect.width, 'rect.width')
  validatePositiveFinite(rect.height, 'rect.height')
}

function validateDeltas(deltaX: number, deltaY: number) {
  validateFinite(deltaX, 'deltaX')
  validateFinite(deltaY, 'deltaY')
}

function validateHandle(handle: string, allowedHandles: ReadonlySet<string>) {
  if (!allowedHandles.has(handle)) {
    throw new RangeError(`invalid resize handle: ${handle}`)
  }
}

function validateBounds(bounds: CanvasResizeBounds) {
  validatePositiveFinite(bounds.minWidth, 'bounds.minWidth')
  validatePositiveFinite(bounds.minHeight, 'bounds.minHeight')
  validatePositiveFinite(bounds.maxWidth, 'bounds.maxWidth')
  validatePositiveFinite(bounds.maxHeight, 'bounds.maxHeight')

  if (bounds.minWidth > bounds.maxWidth || bounds.minHeight > bounds.maxHeight) {
    throw new RangeError('bounds minimums must not exceed their maximums')
  }
}

export function resizeNodeRect({
  rect,
  handle,
  deltaX,
  deltaY,
  bounds = nodeBounds,
}: ResizeArgs<CanvasResizeCorner>): CanvasResizeRect {
  validateRect(rect)
  validateDeltas(deltaX, deltaY)
  validateBounds(bounds)
  validateHandle(handle, nodeHandles)

  const resizeFromWest = handle === 'nw' || handle === 'sw'
  const resizeFromNorth = handle === 'nw' || handle === 'ne'
  const horizontalMotionDominates = Math.abs(deltaX) >= Math.abs(deltaY)
  const aspectRatio = rect.width / rect.height
  const minimumScale = Math.max(bounds.minWidth / rect.width, bounds.minHeight / rect.height)
  const maximumScale = Math.min(bounds.maxWidth / rect.width, bounds.maxHeight / rect.height)
  if (minimumScale > maximumScale) {
    throw new RangeError('bounds cannot satisfy the node aspect ratio')
  }
  const requestedHeight = rect.height + (resizeFromNorth ? -deltaY : deltaY)
  const requestedWidth = horizontalMotionDominates
    ? rect.width + (resizeFromWest ? -deltaX : deltaX)
    : requestedHeight * aspectRatio
  const minimumWidth = Math.max(bounds.minWidth, bounds.minHeight * aspectRatio)
  const maximumWidth = Math.min(bounds.maxWidth, bounds.maxHeight * aspectRatio)
  const width = clamp(requestedWidth, minimumWidth, maximumWidth)
  const height = width / aspectRatio

  return {
    x: resizeFromWest ? rect.x + rect.width - width : rect.x,
    y: resizeFromNorth ? rect.y + rect.height - height : rect.y,
    width,
    height,
  }
}

export function resizeEditorRect({
  rect,
  handle,
  deltaX,
  deltaY,
  bounds = editorBounds,
}: ResizeArgs<CanvasResizeHandle>): CanvasResizeRect {
  validateRect(rect)
  validateDeltas(deltaX, deltaY)
  validateBounds(bounds)
  validateHandle(handle, editorHandles)

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

  return {
    x: resizeFromWest ? rect.x + rect.width - width : rect.x,
    y: resizeFromNorth ? rect.y + rect.height - height : rect.y,
    width,
    height,
  }
}
