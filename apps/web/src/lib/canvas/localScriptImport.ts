export const LOCAL_SCRIPT_ALLOWED_EXTENSIONS = ['.txt', '.md'] as const
export const LOCAL_SCRIPT_ALLOWED_TYPES = ['text/plain', 'text/markdown'] as const
export const LOCAL_SCRIPT_MAX_SIZE_BYTES = 2 * 1024 * 1024

export interface LocalScriptEntry {
  inputId: string
  fileName: string
  mimeType: string
  textPreview: string
  fullText: string
  importedAt: string
  charCount: number
}

export interface LocalScriptValidation {
  ok: true
}

export interface LocalScriptValidationFail {
  ok: false
  error: { code: 'INVALID_TYPE' | 'TOO_LARGE'; message: string }
}

export function validateLocalScriptFile(file: File): LocalScriptValidation | LocalScriptValidationFail {
  const lower = file.name.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))
  const hasAllowedExt = (LOCAL_SCRIPT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
  const hasAllowedType = (LOCAL_SCRIPT_ALLOWED_TYPES as readonly string[]).includes(file.type) || file.type === ''
  if (!hasAllowedExt && !hasAllowedType) {
    return {
      ok: false,
      error: { code: 'INVALID_TYPE', message: '仅支持 .txt / .md 文本文件' },
    }
  }
  if (file.size > LOCAL_SCRIPT_MAX_SIZE_BYTES) {
    return {
      ok: false,
      error: { code: 'TOO_LARGE', message: `文件 ${file.name} 超过 2MB 限制` },
    }
  }
  return { ok: true }
}

export function readScriptFile(file: File): Promise<LocalScriptEntry> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const fullText = typeof e.target?.result === 'string' ? e.target.result : ''
      const textPreview = fullText.split('\n').slice(0, 3).join('\n').slice(0, 200)
      resolve({
        inputId: `script-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        mimeType: file.type || 'text/plain',
        textPreview,
        fullText,
        importedAt: new Date().toISOString(),
        charCount: fullText.length,
      })
    }
    reader.onerror = () => reject(new Error('无法读取文件'))
    reader.readAsText(file, 'utf-8')
  })
}
