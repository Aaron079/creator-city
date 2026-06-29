import {
  STORYBOARD_GRID_SPLIT_TOOL_ID,
  type StoryboardGridCell,
  type StoryboardGridCropMetadata,
} from './storyboardGridDetect'

export const STORYBOARD_GRID_MAX_DIMENSION = 8192
export const STORYBOARD_GRID_CORS_ERROR_MESSAGE = '无法读取图片像素，请先将图片导入资产库或使用平台图片。'

export function loadImageForCanvas(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (image.naturalWidth > STORYBOARD_GRID_MAX_DIMENSION || image.naturalHeight > STORYBOARD_GRID_MAX_DIMENSION) {
        reject(new Error(`图片尺寸超过 ${STORYBOARD_GRID_MAX_DIMENSION}px，V1 暂不处理。`))
        return
      }
      resolve(image)
    }
    image.onerror = () => reject(new Error(STORYBOARD_GRID_CORS_ERROR_MESSAGE))
    image.src = url
  })
}

export function cropImageCellToBlob(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  cell: StoryboardGridCell,
  mimeType = 'image/png',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = cell.width
      canvas.height = cell.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('浏览器不支持 Canvas 2D。'))
        return
      }
      ctx.drawImage(image, cell.x, cell.y, cell.width, cell.height, 0, 0, cell.width, cell.height)
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error(STORYBOARD_GRID_CORS_ERROR_MESSAGE))
        }
      }, mimeType)
    } catch {
      reject(new Error(STORYBOARD_GRID_CORS_ERROR_MESSAGE))
    }
  })
}

export function buildStoryboardGridUploadFormData(args: {
  blob: Blob
  projectId: string
  workflowId?: string
  sourceNodeId: string
  assetNodeId?: string
  title: string
  metadata: StoryboardGridCropMetadata
}): FormData {
  const fd = new FormData()
  const file = new File([args.blob], `${args.title || 'storyboard-cell'}.png`, { type: args.blob.type || 'image/png' })
  fd.append('file', file)
  fd.append('projectId', args.projectId)
  fd.append('type', 'image')
  fd.append('title', args.title)
  if (args.workflowId) fd.append('workflowId', args.workflowId)
  if (args.assetNodeId) fd.append('nodeId', args.assetNodeId)
  fd.append('toolId', STORYBOARD_GRID_SPLIT_TOOL_ID)
  fd.append('parentAssetId', args.metadata.parentAssetId)
  fd.append('sourceAssetId', args.metadata.sourceAssetId)
  fd.append('sourceNodeId', args.sourceNodeId)
  fd.append('gridSessionId', args.metadata.gridSessionId)
  fd.append('cropBox', JSON.stringify(args.metadata.cropBox))
  fd.append('row', String(args.metadata.row))
  fd.append('col', String(args.metadata.col))
  fd.append('index', String(args.metadata.index))
  return fd
}
