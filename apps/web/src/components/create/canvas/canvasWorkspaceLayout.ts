import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

type CanvasSize = { width: number; height: number }

export type CanvasStageRect = { left: number; top: number; right: number; bottom: number }
export type CanvasNodeScreenRect = { left: number; top: number; width: number; height: number }
export type CanvasContextSurfaceLayout = {
  navigation: CanvasSize & { left: number; top: number }
  dialog: CanvasSize & { left: number; top: number }
  panDeltaY: number
  minimumStageHeight: number
  isVerticallyConstrained: boolean
}

const CONTEXT_NAVIGATION = { width: 350, height: 28, gap: 8 }
const CONTEXT_DIALOG = { width: 700, height: 210, gap: 8 }
const CONTEXT_STAGE_MARGIN = 16
const TASK_DIALOG_BASE_HEIGHT = 282
const TASK_DIALOG_PROMPT_BODY_HEIGHT = 58

export type CanvasTaskDialogSizing = {
  height: number
  maxHeight: number
  compactFixedControls: boolean
  promptBodyHeight: number
}

export type CanvasTaskDialogMeasurements = {
  fixedTopHeight: number
  fixedBottomHeight: number
  promptChromeHeight: number
}

function normalizeTaskDialogMeasurements(
  measurements: CanvasTaskDialogMeasurements,
): CanvasTaskDialogMeasurements {
  return {
    fixedTopHeight: Math.max(0, measurements.fixedTopHeight),
    fixedBottomHeight: Math.max(0, measurements.fixedBottomHeight),
    promptChromeHeight: Math.max(0, measurements.promptChromeHeight),
  }
}

function getCanvasTaskDialogSizingForMode({
  stageHeight,
  measurements,
  compactFixedControls,
}: {
  stageHeight: number
  measurements: CanvasTaskDialogMeasurements
  compactFixedControls: boolean
}): CanvasTaskDialogSizing {
  const maxHeight = Math.max(
    0,
    stageHeight
      - CONTEXT_STAGE_MARGIN * 2
      - CONTEXT_NAVIGATION.height
      - CONTEXT_NAVIGATION.gap,
  )
  const fixedHeight = compactFixedControls
    ? Math.max(measurements.fixedTopHeight, measurements.fixedBottomHeight)
      + measurements.promptChromeHeight
    : measurements.fixedTopHeight
      + measurements.fixedBottomHeight
      + measurements.promptChromeHeight
  const preferredHeight = Math.max(
    TASK_DIALOG_BASE_HEIGHT,
    fixedHeight + TASK_DIALOG_PROMPT_BODY_HEIGHT,
  )
  const height = Math.min(preferredHeight, maxHeight)

  return {
    height,
    maxHeight,
    compactFixedControls,
    promptBodyHeight: Math.max(0, height - fixedHeight),
  }
}

export function getCanvasTaskDialogSizing({
  stageHeight,
  fixedTopHeight,
  fixedBottomHeight,
  promptChromeHeight,
}: {
  stageHeight: number
  fixedTopHeight: number
  fixedBottomHeight: number
  promptChromeHeight: number
}): CanvasTaskDialogSizing {
  const measurements = normalizeTaskDialogMeasurements({
    fixedTopHeight,
    fixedBottomHeight,
    promptChromeHeight,
  })
  const maxHeight = Math.max(
    0,
    stageHeight
      - CONTEXT_STAGE_MARGIN * 2
      - CONTEXT_NAVIGATION.height
      - CONTEXT_NAVIGATION.gap,
  )
  const compactFixedControls = measurements.fixedTopHeight
    + measurements.fixedBottomHeight
    + measurements.promptChromeHeight
    + TASK_DIALOG_PROMPT_BODY_HEIGHT > maxHeight

  return getCanvasTaskDialogSizingForMode({
    stageHeight,
    measurements,
    compactFixedControls,
  })
}

export function stabilizeCanvasTaskDialogSizing({
  stageHeight,
  measurements,
  compactFixedControls,
  noncompactMeasurements,
}: {
  stageHeight: number
  measurements: CanvasTaskDialogMeasurements
  compactFixedControls: boolean
  noncompactMeasurements: CanvasTaskDialogMeasurements | null
}): CanvasTaskDialogSizing & {
  noncompactMeasurements: CanvasTaskDialogMeasurements | null
} {
  const currentMeasurements = normalizeTaskDialogMeasurements(measurements)
  const cachedNoncompactMeasurements = compactFixedControls
    ? noncompactMeasurements
    : currentMeasurements
  const noncompactBasis = cachedNoncompactMeasurements
    ? {
      fixedTopHeight: Math.max(
        currentMeasurements.fixedTopHeight,
        cachedNoncompactMeasurements.fixedTopHeight,
      ),
      fixedBottomHeight: Math.max(
        currentMeasurements.fixedBottomHeight,
        cachedNoncompactMeasurements.fixedBottomHeight,
      ),
      promptChromeHeight: Math.max(
        currentMeasurements.promptChromeHeight,
        cachedNoncompactMeasurements.promptChromeHeight,
      ),
    }
    : currentMeasurements
  const shouldUseCompactControls = getCanvasTaskDialogSizing({
    stageHeight,
    ...noncompactBasis,
  }).compactFixedControls
  const sizing = getCanvasTaskDialogSizingForMode({
    stageHeight,
    measurements: shouldUseCompactControls ? currentMeasurements : noncompactBasis,
    compactFixedControls: shouldUseCompactControls,
  })

  return {
    ...sizing,
    noncompactMeasurements: cachedNoncompactMeasurements,
  }
}

const COMPACT_NODE_SIZES: Record<VisualCanvasNodeKind, CanvasSize> = {
  text: { width: 236, height: 208 },
  image: { width: 248, height: 220 },
  video: { width: 248, height: 220 },
  audio: { width: 236, height: 190 },
  asset: { width: 236, height: 200 },
  template: { width: 236, height: 200 },
  delivery: { width: 236, height: 200 },
  world: { width: 248, height: 220 },
  upload: { width: 236, height: 200 },
}

const LEGACY_NODE_SIZES: Record<VisualCanvasNodeKind, CanvasSize> = {
  text: { width: 360, height: 300 },
  image: { width: 380, height: 320 },
  video: { width: 380, height: 320 },
  audio: { width: 360, height: 260 },
  asset: { width: 360, height: 280 },
  template: { width: 360, height: 280 },
  delivery: { width: 360, height: 280 },
  world: { width: 380, height: 320 },
  upload: { width: 360, height: 280 },
}

export function getCanvasNodeSize(kind: VisualCanvasNodeKind): CanvasSize {
  return COMPACT_NODE_SIZES[kind] ?? COMPACT_NODE_SIZES.text
}

export function normalizeLegacyCanvasNodeSize<
  T extends { kind: VisualCanvasNodeKind; width: number; height: number },
>(node: T): T {
  const legacySize = LEGACY_NODE_SIZES[node.kind]
  if (node.width !== legacySize.width || node.height !== legacySize.height) return node

  return {
    ...node,
    ...getCanvasNodeSize(node.kind),
  }
}

export function getCanvasNodeDialogSize(viewportWidth: number, viewportHeight: number): CanvasSize {
  const viewportMargin = 16
  const width = Math.min(480, Math.max(0, viewportWidth - viewportMargin * 2))
  const preferredHeight = viewportWidth <= 900 ? 320 : 420

  return {
    width,
    height: Math.min(preferredHeight, Math.max(0, viewportHeight - viewportMargin * 2)),
  }
}

export function clampCanvasDialogLeftToStage(
  left: number,
  dialogWidth: number,
  stageLeft: number,
  stageRight: number,
  margin: number,
) {
  const minimumLeft = stageLeft + margin
  const maximumLeft = stageRight - dialogWidth - margin

  return Math.max(minimumLeft, Math.min(left, maximumLeft))
}

export function clampCanvasDialogTopToStage(
  top: number,
  dialogHeight: number,
  stageTop: number,
  stageBottom: number,
  margin: number,
) {
  const minimumTop = stageTop + margin
  const maximumTop = stageBottom - dialogHeight - margin

  return Math.max(minimumTop, Math.min(top, maximumTop))
}

export function getCanvasNodeContextSurfaceLayout({
  node,
  stage,
  dialogHeight = CONTEXT_DIALOG.height,
}: {
  node: CanvasNodeScreenRect
  stage: CanvasStageRect
  dialogHeight?: number
}): CanvasContextSurfaceLayout {
  const stageWidth = Math.max(0, stage.right - stage.left)
  const maxSurfaceWidth = Math.max(0, stageWidth - CONTEXT_STAGE_MARGIN * 2)
  const navigationWidth = Math.min(CONTEXT_NAVIGATION.width, maxSurfaceWidth)
  const dialogWidth = Math.min(CONTEXT_DIALOG.width, maxSurfaceWidth)
  const nodeCenter = node.left + node.width / 2
  const navigationTop = node.top - CONTEXT_NAVIGATION.height - CONTEXT_NAVIGATION.gap
  const dialogTop = node.top + node.height + CONTEXT_DIALOG.gap
  const minimumStageHeight = CONTEXT_STAGE_MARGIN * 2
    + CONTEXT_NAVIGATION.height
    + CONTEXT_NAVIGATION.gap
    + node.height
    + CONTEXT_DIALOG.gap
    + dialogHeight
  const stageHeight = Math.max(0, stage.bottom - stage.top)
  const isVerticallyConstrained = stageHeight < minimumStageHeight
  let panDeltaY = 0

  if (isVerticallyConstrained) {
    const constrainedDialogTop = clampCanvasDialogTopToStage(
      dialogTop,
      dialogHeight,
      stage.top,
      stage.bottom,
      CONTEXT_STAGE_MARGIN,
    )
    panDeltaY = constrainedDialogTop - dialogTop
  } else {
    const minimumStackTop = stage.top + CONTEXT_STAGE_MARGIN
    const maximumStackBottom = stage.bottom - CONTEXT_STAGE_MARGIN
    if (navigationTop < minimumStackTop) {
      panDeltaY = minimumStackTop - navigationTop
    } else if (dialogTop + dialogHeight > maximumStackBottom) {
      panDeltaY = maximumStackBottom - dialogTop - dialogHeight
    }
  }

  return {
    navigation: {
      left: clampCanvasDialogLeftToStage(
        nodeCenter - navigationWidth / 2,
        navigationWidth,
        stage.left,
        stage.right,
        CONTEXT_STAGE_MARGIN,
      ),
      top: navigationTop,
      width: navigationWidth,
      height: CONTEXT_NAVIGATION.height,
    },
    dialog: {
      left: clampCanvasDialogLeftToStage(
        nodeCenter - dialogWidth / 2,
        dialogWidth,
        stage.left,
        stage.right,
        CONTEXT_STAGE_MARGIN,
      ),
      top: dialogTop,
      width: dialogWidth,
      height: dialogHeight,
    },
    panDeltaY,
    minimumStageHeight,
    isVerticallyConstrained,
  }
}
