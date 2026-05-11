import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  type ChinaImageGenerationInput,
  type ChinaImageGenerationResult,
  type ChinaProviderConfig,
} from './types'

const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const VOLCENGINE_SEEDANCE_PROVIDER_ID = 'volcengine-seedance-video' as const

export const volcengineProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: VOLCENGINE_SEEDANCE_PROVIDER_ID,
    envKeys: ['VOLCENGINE_ARK_API_KEY', 'VOLCENGINE_SEEDANCE_MODEL'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL'],
    defaultBaseUrl: VOLCENGINE_ARK_DEFAULT_BASE_URL,
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    defaultModel: '',
    modelEnvKey: 'VOLCENGINE_SEEDANCE_MODEL',
  },
  {
    providerId: 'volcengine-seedream-image',
    envKeys: ['VOLCENGINE_ARK_API_KEY'],
    optionalEnvKeys: ['VOLCENGINE_SEEDREAM_MODEL', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_REGION'],
    defaultBaseUrl: VOLCENGINE_ARK_DEFAULT_BASE_URL,
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    defaultModel: '',
    modelEnvKey: 'VOLCENGINE_SEEDREAM_MODEL',
  },
]

export function getVolcengineStatus(providerId: 'volcengine-seedance-video' | 'volcengine-seedream-image') {
  const config = volcengineProviderConfigs.find((item) => item.providerId === providerId)
  return config ? getChinaProviderStatus(config) : null
}

export function testVolcengineConnection(providerId: 'volcengine-seedance-video' | 'volcengine-seedream-image') {
  return getVolcengineStatus(providerId)
}

function normalizeSeedreamSize(input?: string) {
  const value = String(input || '').toLowerCase()

  if (!value || value === '1080p' || value === '1920x1080' || value === '16:9') {
    return '2K'
  }

  if (value === '2k' || value === '2560x1440') {
    return '2K'
  }

  return input
}

function imageEndpoint(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/images\/generations$/i.test(base) ? base : `${base}/images/generations`
}

function seedanceTaskEndpoint(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/contents\/generations\/tasks$/i.test(base) ? base : `${base}/contents/generations/tasks`
}

function seedanceTaskStatusEndpoint(baseUrl: string, taskId: string) {
  const base = seedanceTaskEndpoint(baseUrl)
  return `${base}/${encodeURIComponent(taskId)}`
}

function findImageUrl(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) || value.startsWith('data:image/')) return value
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageUrl(item)
      if (found) return found
    }
    return null
  }
  if (typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['url', 'image_url', 'imageUrl', 'output_url', 'outputUrl']) {
    const found = findImageUrl(record[key])
    if (found) return found
  }
  for (const nested of Object.values(record)) {
    const found = findImageUrl(nested)
    if (found) return found
  }
  return null
}

function findBase64Image(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBase64Image(item)
      if (found) return found
    }
    return null
  }
  const record = value as Record<string, unknown>
  for (const key of ['b64_json', 'base64', 'image_base64', 'imageBase64']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.length > 64) {
      return candidate.startsWith('data:image/') ? candidate : `data:image/png;base64,${candidate}`
    }
  }
  for (const nested of Object.values(record)) {
    const found = findBase64Image(nested)
    if (found) return found
  }
  return null
}

function findTaskId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['task_id', 'taskId', 'id']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate) return candidate
  }
  for (const nested of Object.values(record)) {
    const found = findTaskId(nested)
    if (found) return found
  }
  return null
}

function findVideoUrl(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /\.(mp4|mov|m3u8|webm)(\?|#|$)/i.test(value)) return value
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item)
      if (found) return found
    }
    return null
  }
  if (typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['video_url', 'videoUrl', 'url', 'output_url', 'outputUrl', 'content_url', 'contentUrl']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate
    const found = findVideoUrl(candidate)
    if (found) return found
  }
  for (const nested of Object.values(record)) {
    const found = findVideoUrl(nested)
    if (found) return found
  }
  return null
}

function getRawError(data: unknown, fallback: string) {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const error = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : {}
  const message = typeof error.message === 'string'
    ? error.message
    : typeof record.message === 'string'
      ? record.message
      : fallback
  const code = typeof error.code === 'string'
    ? error.code
    : typeof record.code === 'string'
      ? record.code
      : typeof error.type === 'string'
        ? error.type
        : undefined
  const requestId = typeof error.request_id === 'string'
    ? error.request_id
    : typeof record.request_id === 'string'
      ? record.request_id
      : undefined
  return { message, code, requestId }
}

function normalizeProviderErrorCode(status: number, message: string, rawCode?: string) {
  const haystack = `${rawCode ?? ''} ${message}`.toLowerCase()
  if (/media download failed|download.*failed|failed to download|image.*download/.test(haystack)) return 'PROVIDER_MEDIA_DOWNLOAD_FAILED'
  if (/invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack)) return 'PROVIDER_INVALID_PARAMETER'
  if (/prompt.*reject|rejected|sensitive|违规|不合规|blocked/.test(haystack)) return 'PROMPT_REJECTED_OR_INVALID'
  if (status === 401 || status === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'PROVIDER_AUTH_ERROR'
  if (status === 402 || status === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'PROVIDER_QUOTA_OR_BILLING_ERROR'
  return 'SEEDANCE_TASK_CREATE_FAILED'
}

function normalizeSeedanceRatio(value?: string) {
  const ratio = String(value || '').trim().toLowerCase()
  if (ratio === '16:9' || ratio === '9:16' || ratio === '1:1' || ratio === '4:3' || ratio === '3:4' || ratio === '21:9' || ratio === 'adaptive') return ratio
  return '16:9'
}

function normalizeSeedanceDuration(value?: number) {
  if (!Number.isFinite(value)) return 5
  const rounded = Math.round(Number(value))
  return Math.min(10, Math.max(1, rounded))
}

function normalizeSeedanceResolution(value?: string) {
  const resolution = String(value || '').trim().toLowerCase()
  if (!resolution) return undefined
  if (resolution === '480p' || resolution === '720p' || resolution === '1080p') return resolution
  if (resolution.includes('1080')) return '1080p'
  if (resolution.includes('720')) return '720p'
  if (resolution.includes('480')) return '480p'
  return undefined
}

function providerResponseSummary(data: unknown) {
  const record = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const error = record.error && typeof record.error === 'object' && !Array.isArray(record.error) ? record.error as Record<string, unknown> : {}
  const content = record.content && typeof record.content === 'object' && !Array.isArray(record.content) ? record.content as Record<string, unknown> : {}
  return {
    id: typeof record.id === 'string' ? record.id : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    code: typeof record.code === 'string' ? record.code : typeof error.code === 'string' ? error.code : undefined,
    message: typeof record.message === 'string' ? record.message : typeof error.message === 'string' ? error.message : undefined,
    requestId: typeof record.request_id === 'string' ? record.request_id : typeof error.request_id === 'string' ? error.request_id : undefined,
    contentKeys: Object.keys(content).slice(0, 12),
    topLevelKeys: Object.keys(record).slice(0, 20),
  }
}

function upstreamMessage(data: unknown, raw: string, limit = 1000) {
  if (raw.trim()) return raw.slice(0, limit)
  try {
    return JSON.stringify(data).slice(0, limit)
  } catch {
    return ''
  }
}

function isModelNotFoundError(status: number, message: string) {
  const normalized = message.toLowerCase()
  return status === 404 && normalized.includes('model or endpoint') && normalized.includes('does not exist')
}

function normalizeTaskStatus(value: unknown): 'running' | 'done' | 'error' | null {
  const status = typeof value === 'string' ? value.toLowerCase() : ''
  if (['queued', 'pending', 'running', 'processing', 'submitted', 'created', 'in_progress'].includes(status)) return 'running'
  if (['succeeded', 'success', 'completed', 'complete', 'done'].includes(status)) return 'done'
  if (['failed', 'failure', 'error', 'cancelled', 'canceled', 'expired'].includes(status)) return 'error'
  return null
}

function findStatus(value: unknown): 'running' | 'done' | 'error' | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStatus(item)
      if (found) return found
    }
    return null
  }
  const record = value as Record<string, unknown>
  for (const key of ['status', 'state', 'task_status', 'taskStatus', 'phase']) {
    const status = normalizeTaskStatus(record[key])
    if (status) return status
  }
  for (const nested of Object.values(record)) {
    const found = findStatus(nested)
    if (found) return found
  }
  return null
}

export type SeedanceVideoInput = {
  prompt: string
  imageUrl?: string
  providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
  model?: string
  duration?: number
  aspectRatio?: string
  resolution?: string
  projectId?: string
  workflowId?: string
  nodeId?: string
}

export type SeedanceVideoResult =
  | {
      success: true
      async: true
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model: string
      taskId: string
      status: 'running'
      message: string
      upstream?: string
      submittedInput?: Record<string, unknown>
      providerResponse?: Record<string, unknown>
    }
  | {
      success: true
      async: false
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model: string
      videoUrl: string
      submittedInput?: Record<string, unknown>
      providerResponse?: Record<string, unknown>
    }
  | {
      success: false
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model?: string
      errorCode: string
      message: string
      upstreamStatus?: number
      upstreamMessage?: string
      rawCode?: string
      requestId?: string
      submittedInput?: Record<string, unknown>
      providerResponse?: Record<string, unknown>
    }

export type SeedanceVideoStatusResult =
  | {
      success: true
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model: string
      taskId: string
      status: 'running'
      message: string
      requestId?: string
      providerResponse?: Record<string, unknown>
      submittedInput?: Record<string, unknown>
    }
  | {
      success: true
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model: string
      taskId: string
      status: 'done'
      videoUrl: string
      message: string
      requestId?: string
      providerResponse?: Record<string, unknown>
      submittedInput?: Record<string, unknown>
    }
  | {
      success: false
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model?: string
      taskId: string
      status: 'error'
      errorCode: string
      message: string
      upstreamStatus?: number
      upstreamMessage?: string
      rawCode?: string
      requestId?: string
      providerResponse?: Record<string, unknown>
      submittedInput?: Record<string, unknown>
    }

export async function generateSeedanceVideo(input: SeedanceVideoInput): Promise<SeedanceVideoResult> {
  const providerId = VOLCENGINE_SEEDANCE_PROVIDER_ID
  const model = (input.model || process.env.VOLCENGINE_SEEDANCE_MODEL || '').trim()
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY
  const baseUrl = (process.env.VOLCENGINE_ARK_BASE_URL || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')

  if (!apiKey) {
    return {
      success: false,
      providerId,
      model,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: 'VOLCENGINE_ARK_API_KEY 未配置',
    }
  }
  if (!model) {
    return {
      success: false,
      providerId,
      model,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: '请在 Vercel 填写 VOLCENGINE_SEEDANCE_MODEL，值从火山方舟 Seedance 调用示例复制。',
    }
  }

  const content: Array<Record<string, unknown>> = []
  if (input.prompt.trim()) {
    content.push({ type: 'text', text: input.prompt.trim() })
  }
  if (input.imageUrl) {
    content.push({ type: 'image_url', image_url: { url: input.imageUrl } })
  }

  if (!content.length) {
    return {
      success: false,
      providerId,
      model,
      errorCode: 'PROMPT_REQUIRED',
      message: '请输入视频提示词，或连接一个上游图片作为 Seedance 输入。',
    }
  }

  const ratio = normalizeSeedanceRatio(input.aspectRatio)
  const duration = normalizeSeedanceDuration(input.duration)
  const resolution = normalizeSeedanceResolution(input.resolution)
  const body: Record<string, unknown> = {
    model,
    content,
    ratio,
    duration,
    watermark: false,
  }
  if (resolution) body.resolution = resolution
  if (input.projectId || input.workflowId || input.nodeId) {
    body.metadata = {
      projectId: input.projectId,
      workflowId: input.workflowId,
      nodeId: input.nodeId,
    }
  }
  const submittedInput = {
    providerId,
    model,
    endpoint: '/contents/generations/tasks',
    contentTypes: content.map((item) => item.type),
    promptChars: input.prompt.trim().length,
    hasImageUrl: Boolean(input.imageUrl),
    imageUrl: input.imageUrl,
    ratio,
    duration,
    resolution: resolution ?? null,
    watermark: false,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const response = await fetch(seedanceTaskEndpoint(baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    })
    const raw = await response.text()
    let data: unknown = {}
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as unknown
      } catch {
        return {
          success: false,
          providerId,
          model,
          errorCode: 'VOLCENGINE_SEEDANCE_FAILED',
          message: 'Volcengine Seedance 返回了无效 JSON 响应。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 500),
          submittedInput,
          providerResponse: { parseError: 'invalid_json', rawSnippet: raw.slice(0, 500) },
        }
      }
    }

    if (!response.ok) {
      const rawError = getRawError(data, `Volcengine Seedance HTTP ${response.status}`)
      const errorCode = normalizeProviderErrorCode(response.status, rawError.message, rawError.code)
      return {
        success: false,
        providerId,
        model,
        errorCode,
        message: rawError.message,
        upstreamStatus: response.status,
        upstreamMessage: upstreamMessage(data, raw) || rawError.message,
        rawCode: rawError.code,
        requestId: rawError.requestId ?? response.headers.get('x-request-id') ?? undefined,
        submittedInput,
        providerResponse: providerResponseSummary(data),
      }
    }

    const videoUrl = findVideoUrl(data)
    if (videoUrl) {
      return {
        success: true,
        async: false,
        providerId,
        model,
        videoUrl,
        submittedInput,
        providerResponse: providerResponseSummary(data),
      }
    }

    const taskId = findTaskId(data)
    if (taskId) {
      return {
        success: true,
        async: true,
        providerId,
        model,
        taskId,
        status: 'running',
        message: '视频任务已提交',
        upstream: upstreamMessage(data, raw),
        submittedInput,
        providerResponse: providerResponseSummary(data),
      }
    }

    return {
      success: false,
      providerId,
      model,
      errorCode: 'SEEDANCE_RESPONSE_UNRECOGNIZED',
      message: 'Seedance 创建任务返回结构无法识别，请查看 upstreamMessage。',
      upstreamStatus: response.status,
      upstreamMessage: upstreamMessage(data, raw),
      submittedInput,
      providerResponse: providerResponseSummary(data),
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
    return {
      success: false,
      providerId,
      model,
      errorCode: aborted ? 'VOLCENGINE_SEEDANCE_TIMEOUT' : 'VOLCENGINE_SEEDANCE_FAILED',
      message: aborted ? 'Volcengine Seedance 请求超时或被中断，请稍后查询任务或重试。' : error instanceof Error ? error.message : 'Volcengine Seedance 调用失败。',
      upstreamMessage: error instanceof Error ? error.message : undefined,
      submittedInput,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function getSeedanceVideoStatus(taskId: string): Promise<SeedanceVideoStatusResult> {
  const providerId = VOLCENGINE_SEEDANCE_PROVIDER_ID
  const model = process.env.VOLCENGINE_SEEDANCE_MODEL?.trim() || ''
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY
  const baseUrl = (process.env.VOLCENGINE_ARK_BASE_URL || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')

  if (!apiKey) {
    return {
      success: false,
      providerId,
      model,
      taskId,
      status: 'error',
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: 'VOLCENGINE_ARK_API_KEY 未配置',
    }
  }
  if (!model) {
    return {
      success: false,
      providerId,
      model,
      taskId,
      status: 'error',
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: '请在 Vercel 填写 VOLCENGINE_SEEDANCE_MODEL，值从火山方舟 Seedance 调用示例复制。',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(seedanceTaskStatusEndpoint(baseUrl, taskId), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    const raw = await response.text()
    let data: unknown = {}
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as unknown
      } catch {
        return {
          success: false,
          providerId,
          model,
          taskId,
          status: 'error',
          errorCode: 'SEEDANCE_TASK_STATUS_FAILED',
          message: 'Volcengine Seedance 查询任务返回了无效 JSON 响应。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 1000),
        }
      }
    }

    if (!response.ok) {
      const rawError = getRawError(data, `Volcengine Seedance status HTTP ${response.status}`)
      const errorCode = normalizeProviderErrorCode(response.status, rawError.message, rawError.code)
      return {
        success: false,
        providerId,
        model,
        taskId,
        status: 'error',
        errorCode,
        message: rawError.message,
        upstreamStatus: response.status,
        upstreamMessage: upstreamMessage(data, raw) || rawError.message,
        rawCode: rawError.code,
        requestId: rawError.requestId ?? response.headers.get('x-request-id') ?? undefined,
        providerResponse: providerResponseSummary(data),
      }
    }

    const videoUrl = findVideoUrl(data)
    const status = findStatus(data)
    if (videoUrl || status === 'done') {
      if (!videoUrl) {
        return {
          success: false,
          providerId,
          model,
        taskId,
        status: 'error',
        errorCode: 'PROVIDER_NO_DOWNLOAD_URL',
        message: '任务完成但未找到 videoUrl，请查看 upstreamMessage。',
        upstreamStatus: response.status,
        upstreamMessage: upstreamMessage(data, raw),
        requestId: response.headers.get('x-request-id') ?? undefined,
        providerResponse: providerResponseSummary(data),
      }
      }
      return {
        success: true,
        providerId,
        model,
        taskId,
        status: 'done',
        videoUrl,
        message: '视频生成完成',
        requestId: response.headers.get('x-request-id') ?? undefined,
        providerResponse: providerResponseSummary(data),
      }
    }

    if (status === 'error') {
      const rawError = getRawError(data, 'Seedance 视频任务失败。')
      const errorCode = normalizeProviderErrorCode(response.status, rawError.message, rawError.code)
      return {
        success: false,
        providerId,
        model,
        taskId,
        status: 'error',
        errorCode,
        message: rawError.message,
        upstreamStatus: response.status,
        upstreamMessage: upstreamMessage(data, raw),
        rawCode: rawError.code,
        requestId: rawError.requestId,
        providerResponse: providerResponseSummary(data),
      }
    }

    return {
      success: true,
      providerId,
      model,
      taskId,
      status: 'running',
      message: '视频任务已提交，正在生成中',
      requestId: response.headers.get('x-request-id') ?? undefined,
      providerResponse: providerResponseSummary(data),
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
    return {
      success: false,
      providerId,
      model,
      taskId,
      status: 'error',
      errorCode: aborted ? 'VOLCENGINE_SEEDANCE_STATUS_TIMEOUT' : 'VOLCENGINE_SEEDANCE_STATUS_FAILED',
      message: aborted ? 'Seedance 任务状态查询超时，请稍后重试。' : error instanceof Error ? error.message : 'Seedance 任务状态查询失败。',
      upstreamMessage: error instanceof Error ? error.message : undefined,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function generateSeedreamImage(input: ChinaImageGenerationInput): Promise<ChinaImageGenerationResult> {
  const providerId = 'volcengine-seedream-image'
  const model = process.env.VOLCENGINE_SEEDREAM_MODEL?.trim() || ''
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY
  const baseUrl = process.env.VOLCENGINE_ARK_BASE_URL || VOLCENGINE_ARK_DEFAULT_BASE_URL

  if (!apiKey) {
    return {
      success: false,
      providerId,
      model,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: 'VOLCENGINE_ARK_API_KEY 未配置',
    }
  }
  if (!model) {
    return {
      success: false,
      providerId,
      model,
      errorCode: 'VOLCENGINE_MODEL_REQUIRED',
      message: '请在火山方舟控制台复制真实 Model ID 或 Endpoint ID 到 VOLCENGINE_SEEDREAM_MODEL。',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const seedreamInput = input as ChinaImageGenerationInput & { resolution?: string; quality?: string }
    const seedreamSize = normalizeSeedreamSize(seedreamInput.size || seedreamInput.resolution || seedreamInput.quality || seedreamInput.aspectRatio)
    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
      size: seedreamSize || '2K',
      output_format: 'png',
      response_format: 'url',
      stream: false,
      watermark: false,
    }
    if (input.referenceImages?.length) {
      body.image = input.referenceImages.length === 1 ? input.referenceImages[0] : input.referenceImages
    }

    const response = await fetch(imageEndpoint(baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    })
    const raw = await response.text()
    let data: unknown = {}
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as unknown
      } catch {
        return {
          success: false,
          providerId,
          model,
          errorCode: 'VOLCENGINE_IMAGE_FAILED',
          message: 'Volcengine Seedream 返回了无效 JSON 响应。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 500),
        }
      }
    }

    if (!response.ok) {
      const rawError = getRawError(data, `Volcengine Seedream HTTP ${response.status}`)
      const upstreamMessage = rawError.message
      const requestId = rawError.requestId ?? response.headers.get('x-request-id') ?? undefined
      if (isModelNotFoundError(response.status, upstreamMessage)) {
        return {
          success: false,
          providerId,
          model,
          errorCode: 'VOLCENGINE_MODEL_NOT_FOUND',
          message: 'Seedream 模型或接入点不存在/未开通。请在火山方舟控制台复制真实 Model ID 或 Endpoint ID 到 VOLCENGINE_SEEDREAM_MODEL。',
          upstreamStatus: response.status,
          upstreamMessage,
          rawCode: rawError.code,
          requestId,
        }
      }
      return {
        success: false,
        providerId,
        model,
        errorCode: 'VOLCENGINE_IMAGE_FAILED',
        message: upstreamMessage,
        upstreamStatus: response.status,
        upstreamMessage,
        rawCode: rawError.code,
        requestId,
      }
    }

    const imageUrl = findImageUrl(data)
    const dataUrl = imageUrl?.startsWith('data:image/') ? imageUrl : findBase64Image(data) ?? undefined
    const finalUrl = imageUrl && !imageUrl.startsWith('data:image/') ? imageUrl : undefined
    if (finalUrl || dataUrl) {
      return {
        success: true,
        providerId,
        model,
        imageUrl: finalUrl ?? dataUrl,
        dataUrl,
        metadata: { responseFormat: finalUrl ? 'url' : 'b64_json' },
      }
    }

    const taskId = findTaskId(data)
    if (taskId) {
      return {
        success: false,
        providerId,
        model,
        errorCode: 'IMAGE_ASYNC_NOT_IMPLEMENTED',
        message: '该 Provider 返回异步任务，下一轮接入轮询。',
        upstreamStatus: response.status,
        upstreamMessage: JSON.stringify({ taskId }).slice(0, 500),
      }
    }

    return {
      success: false,
      providerId,
      model,
      errorCode: 'VOLCENGINE_IMAGE_EMPTY',
      message: 'Volcengine Seedream 未返回图片 URL 或 base64。',
      upstreamStatus: response.status,
      upstreamMessage: raw.slice(0, 500),
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
    return {
      success: false,
      providerId,
      model,
      errorCode: aborted ? 'VOLCENGINE_IMAGE_TIMEOUT' : 'VOLCENGINE_IMAGE_FAILED',
      message: aborted ? 'Volcengine Seedream 请求超时或被中断，请重试。' : error instanceof Error ? error.message : 'Volcengine Seedream 调用失败。',
      upstreamMessage: error instanceof Error ? error.message : undefined,
    }
  } finally {
    clearTimeout(timer)
  }
}

export const normalizeVolcengineError = normalizeChinaProviderError
