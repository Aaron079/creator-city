export type LocalImportKind = 'image' | 'video'

export const LOCAL_IMAGE_IMPORT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const LOCAL_VIDEO_IMPORT_ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const
export const LOCAL_IMPORT_ALLOWED_TYPES = [
  ...LOCAL_IMAGE_IMPORT_ALLOWED_TYPES,
  ...LOCAL_VIDEO_IMPORT_ALLOWED_TYPES,
] as const
export const LOCAL_IMPORT_MAX_SIZE_BYTES = 20 * 1024 * 1024
export const LOCAL_IMPORT_MAX_DIMENSION = 8192

export interface LocalRefEntry {
  inputId: string
  status: 'uploading' | 'done' | 'error'
  assetId?: string
  mediaUrl?: string
  originalFileName: string
  mimeType: string
  uploadedAt?: string
  errorMessage?: string
}

export interface LocalImportValidationError {
  file: File
  code: 'INVALID_TYPE' | 'TOO_LARGE' | 'DIMENSION_TOO_LARGE'
  message: string
}

export interface LocalImportValidation {
  ok: true
}

export interface LocalImportValidationFail {
  ok: false
  error: LocalImportValidationError
}

function validateLocalFile(
  file: File,
  allowedTypes: readonly string[],
  acceptedFormats: string,
): LocalImportValidation | LocalImportValidationFail {
  if (!allowedTypes.includes(file.type)) {
    return {
      ok: false,
      error: {
        file,
        code: 'INVALID_TYPE',
        message: `不支持的格式 ${file.type || '未知'}，仅支持 ${acceptedFormats}`,
      },
    }
  }
  if (file.size > LOCAL_IMPORT_MAX_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        file,
        code: 'TOO_LARGE',
        message: `文件 ${file.name} 超过 20MB 限制`,
      },
    }
  }
  return { ok: true }
}

export function validateLocalImageFile(file: File): LocalImportValidation | LocalImportValidationFail {
  return validateLocalFile(file, LOCAL_IMAGE_IMPORT_ALLOWED_TYPES, 'JPG / PNG / WebP')
}

export function validateLocalMediaFile(file: File): LocalImportValidation | LocalImportValidationFail {
  return validateLocalFile(file, LOCAL_IMPORT_ALLOWED_TYPES, 'JPG / PNG / WebP / MP4 / WebM / MOV')
}

export function getLocalImportKind(file: Pick<File, 'type'>): LocalImportKind | null {
  if ((LOCAL_IMAGE_IMPORT_ALLOWED_TYPES as readonly string[]).includes(file.type)) return 'image'
  if ((LOCAL_VIDEO_IMPORT_ALLOWED_TYPES as readonly string[]).includes(file.type)) return 'video'
  return null
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (
        img.naturalWidth > LOCAL_IMPORT_MAX_DIMENSION ||
        img.naturalHeight > LOCAL_IMPORT_MAX_DIMENSION
      ) {
        reject(
          new Error(
            `图片尺寸 ${img.naturalWidth}×${img.naturalHeight} 超过 ${LOCAL_IMPORT_MAX_DIMENSION}px 限制`,
          ),
        )
      } else {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取图片尺寸'))
    }
    img.src = url
  })
}

export function buildLocalImportMetadata(
  file: File,
  assetId: string,
  mediaKind: LocalImportKind = getLocalImportKind(file) ?? 'image',
): Record<string, unknown> {
  return {
    assetId,
    importedFromLocal: true,
    importSource: 'drag-drop',
    mediaKind,
    originalFileName: file.name,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
  }
}

export function getLocalImportDisplayUrl(asset: { id: string; url: string }) {
  return asset.url.startsWith('storage://')
    ? `/api/assets/${encodeURIComponent(asset.id)}/file`
    : asset.url
}

export function buildUploadFormData(
  file: File,
  projectId: string,
  workflowId?: string,
  nodeId?: string,
  mediaKind: LocalImportKind = getLocalImportKind(file) ?? 'image',
): FormData {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('projectId', projectId)
  fd.append('type', mediaKind)
  fd.append('title', getImportNodeTitle(file))
  if (workflowId) fd.append('workflowId', workflowId)
  if (nodeId) fd.append('nodeId', nodeId)
  return fd
}

export function getImportNodeTitle(file: File): string {
  const name = file.name
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function isDragEventWithImageFiles(e: DragEvent | React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

export async function uploadAssetWithTimeout(
  fd: FormData,
  timeoutMs = 60000,
): Promise<{ id: string; url: string; name: string }> {
  const controller = new AbortController()
  const timer = typeof window !== 'undefined'
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('/api/assets/upload', {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    })
    const json = await res.json() as {
      success: boolean
      asset?: { id: string; url: string; name: string }
      message?: string
    }
    if (!res.ok || !json.success || !json.asset?.url) {
      throw new Error(json.message ?? '上传失败')
    }
    return json.asset
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('UPLOAD_TIMEOUT')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Kept for existing image-only reference callers. Canvas drag-drop uses the media-neutral name.
export const uploadImageWithTimeout = uploadAssetWithTimeout
