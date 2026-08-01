import {
  STORYBOARD_GRID_CORS_ERROR_MESSAGE,
  STORYBOARD_GRID_CROP_MIME_TYPE,
  STORYBOARD_GRID_CROP_QUALITY,
  STORYBOARD_GRID_MAX_DIMENSION,
} from './storyboardGridCrop'
import type {
  NormalizedReferenceCropBox,
  StoryboardReferenceExtractionMetadata,
} from './storyboardReferenceExtract'

type CanvasCropSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/png') return 'png'
  return 'png'
}

function sourceDimensions(image: CanvasCropSource) {
  const source = image as HTMLImageElement
  const width = typeof source.naturalWidth === 'number' ? source.naturalWidth : image.width
  const height = typeof source.naturalHeight === 'number' ? source.naturalHeight : image.height
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(STORYBOARD_GRID_CORS_ERROR_MESSAGE)
  }
  if (width > STORYBOARD_GRID_MAX_DIMENSION || height > STORYBOARD_GRID_MAX_DIMENSION) {
    throw new Error(`图片尺寸超过 ${STORYBOARD_GRID_MAX_DIMENSION}px，V1 暂不处理。`)
  }
  return { width, height }
}

function pixelCropBox(cropBox: NormalizedReferenceCropBox, image: CanvasCropSource) {
  const values = [cropBox.x, cropBox.y, cropBox.width, cropBox.height]
  if (
    values.some((value) => !Number.isFinite(value)) ||
    cropBox.x < 0 ||
    cropBox.y < 0 ||
    cropBox.width <= 0 ||
    cropBox.height <= 0 ||
    cropBox.x + cropBox.width > 1 ||
    cropBox.y + cropBox.height > 1
  ) {
    throw new RangeError('Reference crop box is invalid')
  }

  const { width, height } = sourceDimensions(image)
  return {
    x: cropBox.x * width,
    y: cropBox.y * height,
    width: cropBox.width * width,
    height: cropBox.height * height,
  }
}

export function cropStoryboardReferenceToBlob(
  image: CanvasCropSource,
  cropBox: NormalizedReferenceCropBox,
  mimeType = STORYBOARD_GRID_CROP_MIME_TYPE,
  quality = STORYBOARD_GRID_CROP_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const crop = pixelCropBox(cropBox, image)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(crop.width))
      canvas.height = Math.max(1, Math.round(crop.height))
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('浏览器不支持 Canvas 2D。'))
        return
      }
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error(STORYBOARD_GRID_CORS_ERROR_MESSAGE))
      }, mimeType, quality)
    } catch (error) {
      reject(error instanceof Error ? error : new Error(STORYBOARD_GRID_CORS_ERROR_MESSAGE))
    }
  })
}

export function buildStoryboardReferenceUploadFormData(args: {
  blob: Blob
  projectId: string
  workflowId?: string
  assetNodeId?: string
  title: string
  metadata: StoryboardReferenceExtractionMetadata
}): FormData {
  const formData = new FormData()
  const mimeType = args.blob.type || STORYBOARD_GRID_CROP_MIME_TYPE
  const file = new File([args.blob], `${args.title || 'storyboard-reference'}.${extensionForMimeType(mimeType)}`, { type: mimeType })
  formData.append('file', file)
  formData.append('projectId', args.projectId)
  formData.append('type', 'image')
  formData.append('title', args.title)
  if (args.workflowId) formData.append('workflowId', args.workflowId)
  if (args.assetNodeId) formData.append('nodeId', args.assetNodeId)
  formData.append('toolId', args.metadata.toolId)
  formData.append('parentAssetId', args.metadata.parentAssetId)
  formData.append('sourceAssetId', args.metadata.sourceAssetId)
  formData.append('sourceNodeId', args.metadata.sourceNodeId)
  formData.append('extractionSessionId', args.metadata.extractionSessionId)
  formData.append('index', String(args.metadata.index))
  formData.append('cropBox', JSON.stringify(args.metadata.cropBox))
  return formData
}
