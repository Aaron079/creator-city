export const LOCAL_SCRIPT_ALLOWED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.fountain',
  '.csv',
  '.srt',
  '.vtt',
  '.json',
] as const

export const LOCAL_SCRIPT_ALLOWED_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/x-subrip',
  'text/vtt',
] as const

// MIME types that are definitively non-text — reject even if extension is unknown
const BLOCKED_MIME_PREFIXES = ['image/', 'video/', 'audio/']
const BLOCKED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/rtf',
  'application/zip',
  'application/x-zip-compressed',
])

// Extensions that should get a specific "export as text first" error message
const WORD_PDF_EXTENSIONS = new Set(['.doc', '.docx', '.pdf', '.rtf', '.odt', '.pages'])

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
  const dotIndex = lower.lastIndexOf('.')
  const ext = dotIndex >= 0 ? lower.slice(dotIndex) : ''

  const hasAllowedExt = (LOCAL_SCRIPT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)

  // Check for Word/PDF — give a specific actionable message
  if (WORD_PDF_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TYPE',
        message: '暂不支持 Word / PDF，请先导出为 TXT、Markdown 或 Fountain 文本格式。',
      },
    }
  }

  // Check if MIME is definitively non-text (only block, never allow on MIME alone)
  const mime = file.type || ''
  const mimeIsBlocked =
    BLOCKED_MIME_EXACT.has(mime) ||
    BLOCKED_MIME_PREFIXES.some((p) => mime.startsWith(p))

  if (mimeIsBlocked) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TYPE',
        message: '仅支持 TXT / Markdown / Fountain / CSV / SRT / VTT / JSON 文本文件。',
      },
    }
  }

  // Extension is the primary gate; empty MIME or text/* MIME is always allowed if extension matches
  if (!hasAllowedExt) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TYPE',
        message: '仅支持 TXT / Markdown / Fountain / CSV / SRT / VTT / JSON 文本文件。',
      },
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
