export const STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID = 'storyboard-reference-extractor' as const

export type NormalizedReferenceCropBox = {
  x: number
  y: number
  width: number
  height: number
}

export type StoryboardReferenceExtractionMetadata = {
  version: 2
  toolId: typeof STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID
  sourceAssetId: string
  sourceNodeId: string
  parentAssetId: string
  extractionSessionId: string
  index: number
  cropBox: NormalizedReferenceCropBox
}

type ImageDimensions = {
  width: number
  height: number
}

type ReferenceCropBox = {
  x: number
  y: number
  width: number
  height: number
}

type StoryboardReferenceExtractionMetadataInput = {
  sourceAssetId: string
  sourceNodeId: string
  extractionSessionId: string
  index: number
  crop: ReferenceCropBox
  image: ImageDimensions
}

function assertFiniteValues(values: Record<string, number>) {
  if (Object.values(values).some((value) => !Number.isFinite(value))) {
    throw new RangeError('Reference extraction values must be finite')
  }
}

function roundToSixDecimals(value: number) {
  return Number(value.toFixed(6))
}

function normalizeCropAxis(start: number, size: number, dimension: number) {
  const normalizedStart = roundToSixDecimals(start / dimension)
  const normalizedSize = roundToSixDecimals(size / dimension)

  return {
    start: normalizedStart,
    size: Math.min(normalizedSize, roundToSixDecimals(1 - normalizedStart)),
  }
}

export function normalizeReferenceCropBox(crop: ReferenceCropBox, image: ImageDimensions): NormalizedReferenceCropBox {
  assertFiniteValues({
    imageWidth: image.width,
    imageHeight: image.height,
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height,
  })

  if (image.width <= 0 || image.height <= 0) {
    throw new RangeError('Reference extraction image dimensions must be positive')
  }
  if (crop.width <= 0 || crop.height <= 0) {
    throw new RangeError('Reference extraction requires a positive selection size')
  }
  if (crop.x < 0 || crop.y < 0) {
    throw new RangeError('Reference extraction selection cannot have negative coordinates')
  }
  if (crop.x + crop.width > image.width || crop.y + crop.height > image.height) {
    throw new RangeError('Reference extraction selection exceeds the image boundary')
  }

  const x = normalizeCropAxis(crop.x, crop.width, image.width)
  const y = normalizeCropAxis(crop.y, crop.height, image.height)

  return { x: x.start, y: y.start, width: x.size, height: y.size }
}

function assertNonBlankIdentifier(value: string, label: string) {
  if (value.trim().length === 0) {
    throw new RangeError(`${label} must not be blank`)
  }
}

export function buildStoryboardReferenceExtractionMetadata(
  args: StoryboardReferenceExtractionMetadataInput,
): StoryboardReferenceExtractionMetadata {
  assertNonBlankIdentifier(args.sourceAssetId, 'Source asset ID')
  assertNonBlankIdentifier(args.sourceNodeId, 'Source node ID')
  assertNonBlankIdentifier(args.extractionSessionId, 'Extraction session ID')
  assertFiniteValues({ index: args.index })
  if (!Number.isInteger(args.index) || args.index < 0) {
    throw new RangeError('Reference extraction index must be a non-negative integer')
  }

  return {
    version: 2,
    toolId: STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID,
    sourceAssetId: args.sourceAssetId,
    sourceNodeId: args.sourceNodeId,
    parentAssetId: args.sourceAssetId,
    extractionSessionId: args.extractionSessionId,
    index: args.index,
    cropBox: normalizeReferenceCropBox(args.crop, args.image),
  }
}
