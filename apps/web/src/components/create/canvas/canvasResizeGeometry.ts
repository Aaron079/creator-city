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

export type CanvasResizePositionBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type CanvasResizeOffset = {
  x: number
  y: number
}

type CanvasResizeCorner = Extract<CanvasResizeHandle, 'nw' | 'ne' | 'se' | 'sw'>

type ResizeArgs<Handle extends CanvasResizeHandle> = {
  rect: CanvasResizeRect
  handle: Handle
  deltaX: number
  deltaY: number
  bounds?: CanvasResizeBounds
  positionBounds?: CanvasResizePositionBounds
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

function validatePositionBounds(bounds: CanvasResizePositionBounds) {
  validateFinite(bounds.minX, 'positionBounds.minX')
  validateFinite(bounds.minY, 'positionBounds.minY')
  validateFinite(bounds.maxX, 'positionBounds.maxX')
  validateFinite(bounds.maxY, 'positionBounds.maxY')
  if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
    throw new RangeError('position bounds minimums must not exceed their maximums')
  }
}

export function resizeNodeRect({
  rect,
  handle,
  deltaX,
  deltaY,
  bounds = nodeBounds,
  positionBounds,
}: ResizeArgs<CanvasResizeCorner>): CanvasResizeRect {
  validateRect(rect)
  validateDeltas(deltaX, deltaY)
  validateBounds(bounds)
  validateHandle(handle, nodeHandles)
  if (positionBounds) validatePositionBounds(positionBounds)

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
  const maximumWidth = Math.min(
    bounds.maxWidth,
    bounds.maxHeight * aspectRatio,
    positionBounds
      ? resizeFromWest
        ? rect.x + rect.width - positionBounds.minX
        : positionBounds.maxX - rect.x
      : Infinity,
    positionBounds
      ? resizeFromNorth
        ? (rect.y + rect.height - positionBounds.minY) * aspectRatio
        : (positionBounds.maxY - rect.y) * aspectRatio
      : Infinity,
    positionBounds
      ? positionBounds.maxX - positionBounds.minX
      : Infinity,
    positionBounds
      ? (positionBounds.maxY - positionBounds.minY) * aspectRatio
      : Infinity,
  )
  const constrainedMaximumWidth = Math.max(1, maximumWidth)
  const constrainedMinimumWidth = Math.min(minimumWidth, constrainedMaximumWidth)
  const width = clamp(requestedWidth, constrainedMinimumWidth, constrainedMaximumWidth)
  const height = width / aspectRatio
  const x = resizeFromWest ? rect.x + rect.width - width : rect.x
  const y = resizeFromNorth ? rect.y + rect.height - height : rect.y

  return {
    x: positionBounds ? clamp(x, positionBounds.minX, positionBounds.maxX - width) : x,
    y: positionBounds ? clamp(y, positionBounds.minY, positionBounds.maxY - height) : y,
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

export function getEditorResizeOffset({
  handle,
  offset,
  startSize,
  nextSize,
}: {
  handle: CanvasResizeHandle
  offset: CanvasResizeOffset
  startSize: Pick<CanvasResizeRect, 'width' | 'height'>
  nextSize: Pick<CanvasResizeRect, 'width' | 'height'>
}): CanvasResizeOffset {
  validateHandle(handle, editorHandles)
  validateFinite(offset.x, 'offset.x')
  validateFinite(offset.y, 'offset.y')
  validatePositiveFinite(startSize.width, 'startSize.width')
  validatePositiveFinite(startSize.height, 'startSize.height')
  validatePositiveFinite(nextSize.width, 'nextSize.width')
  validatePositiveFinite(nextSize.height, 'nextSize.height')

  const widthDelta = nextSize.width - startSize.width
  const heightDelta = nextSize.height - startSize.height
  const resizeFromWest = handle === 'nw' || handle === 'w' || handle === 'sw'
  const resizeFromEast = handle === 'ne' || handle === 'e' || handle === 'se'
  const resizeFromNorth = handle === 'nw' || handle === 'n' || handle === 'ne'
  const resizeFromSouth = handle === 'sw' || handle === 's' || handle === 'se'

  return {
    x: offset.x + (resizeFromWest ? -widthDelta / 2 : resizeFromEast ? widthDelta / 2 : 0),
    y: offset.y + (resizeFromNorth ? -heightDelta / 2 : resizeFromSouth ? heightDelta / 2 : 0),
  }
}
