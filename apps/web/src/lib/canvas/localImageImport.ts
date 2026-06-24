export const LOCAL_IMPORT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const LOCAL_IMPORT_MAX_SIZE_BYTES = 20 * 1024 * 1024
export const LOCAL_IMPORT_MAX_DIMENSION = 8192

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

export function validateLocalImageFile(file: File): LocalImportValidation | LocalImportValidationFail {
  if (!(LOCAL_IMPORT_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: {
        file,
        code: 'INVALID_TYPE',
        message: `不支持的格式 ${file.type || '未知'}，仅支持 JPG / PNG / WebP`,
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

export function buildLocalImportMetadata(file: File, assetId: string): Record<string, unknown> {
  return {
    assetId,
    importedFromLocal: true,
    importSource: 'drag-drop',
    originalFileName: file.name,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
  }
}

export function buildUploadFormData(
  file: File,
  projectId: string,
  workflowId?: string,
  nodeId?: string,
): FormData {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('projectId', projectId)
  fd.append('type', 'image')
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
