import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  type ChinaImageGenerationInput,
  type ChinaImageGenerationResult,
  type ChinaProviderConfig,
} from './types'

const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const VOLCENGINE_SEEDANCE_PROVIDER_ID = 'volcengine-seedance-video' as const
const VOLCENGINE_SEEDANCE_DEFAULT_MODEL = 'seedance-2-0'

export const volcengineProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: VOLCENGINE_SEEDANCE_PROVIDER_ID,
    envKeys: ['VOLCENGINE_ARK_API_KEY'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_SEEDANCE_MODEL'],
    defaultBaseUrl: VOLCENGINE_ARK_DEFAULT_BASE_URL,
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    defaultModel: VOLCENGINE_SEEDANCE_DEFAULT_MODEL,
    modelEnvKey: 'VOLCENGINE_SEEDANCE_MODEL',
  },
  {
    providerId: 'volcengine-seedream-image',
    envKeys: ['VOLCENGINE_ARK_API_KEY'],
    optionalEnvKeys: ['VOLCENGINE_SEEDREAM_MODEL', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_REGION'],
    defaultBaseUrl: VOLCENGINE_ARK_DEFAULT_BASE_URL,
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    defaultModel: 'seedream-5-0-lite',
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

function imageSize(input: ChinaImageGenerationInput) {
  if (input.size) return input.size
  if (input.aspectRatio === '9:16') return '1024x1792'
  if (input.aspectRatio === '1:1') return '2048x2048'
  return '1792x1024'
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
  const data = record.data
  if (data && typeof data === 'object') return findTaskId(data)
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
    const found = findVideoUrl(record[key])
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
    }
  | {
      success: true
      async: false
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model: string
      videoUrl: string
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
    }

export type SeedanceVideoStatusResult =
  | {
      success: true
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model: string
      taskId: string
      status: 'running'
      message: string
    }
  | {
      success: true
      providerId: typeof VOLCENGINE_SEEDANCE_PROVIDER_ID
      model: string
      taskId: string
      status: 'done'
      videoUrl: string
      message: string
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
    }

export async function generateSeedanceVideo(input: SeedanceVideoInput): Promise<SeedanceVideoResult> {
  const providerId = VOLCENGINE_SEEDANCE_PROVIDER_ID
  const model = input.model || process.env.VOLCENGINE_SEEDANCE_MODEL || VOLCENGINE_SEEDANCE_DEFAULT_MODEL
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

  const content: Array<Record<string, unknown>> = []
  if (input.imageUrl) {
    content.push({ type: 'image_url', image_url: { url: input.imageUrl } })
  }
  if (input.prompt.trim()) {
    content.push({ type: 'text', text: input.prompt.trim() })
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

  const body: Record<string, unknown> = {
    model,
    content,
  }
  if (input.duration) body.duration = input.duration
  if (input.aspectRatio) body.ratio = input.aspectRatio
  if (input.projectId || input.workflowId || input.nodeId) {
    body.metadata = {
      projectId: input.projectId,
      workflowId: input.workflowId,
      nodeId: input.nodeId,
    }
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
        }
      }
    }

    if (!response.ok) {
      const rawError = getRawError(data, `Volcengine Seedance HTTP ${response.status}`)
      return {
        success: false,
        providerId,
        model,
        errorCode: 'VOLCENGINE_SEEDANCE_FAILED',
        message: rawError.message,
        upstreamStatus: response.status,
        upstreamMessage: rawError.message,
        rawCode: rawError.code,
        requestId: rawError.requestId ?? response.headers.get('x-request-id') ?? undefined,
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
      }
    }

    return {
      success: false,
      providerId,
      model,
      errorCode: 'SEEDANCE_API_MAPPING_REQUIRED',
      message: 'Seedance API 已配置，但请求字段/路径需要按火山官方文档确认。',
      upstreamStatus: response.status,
      upstreamMessage: raw.slice(0, 500),
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
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function getSeedanceVideoStatus(taskId: string): Promise<SeedanceVideoStatusResult> {
  const providerId = VOLCENGINE_SEEDANCE_PROVIDER_ID
  const model = process.env.VOLCENGINE_SEEDANCE_MODEL || VOLCENGINE_SEEDANCE_DEFAULT_MODEL
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY
  const baseUrl = process.env.VOLCENGINE_ARK_BASE_URL || VOLCENGINE_ARK_DEFAULT_BASE_URL

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
          errorCode: 'VOLCENGINE_SEEDANCE_STATUS_FAILED',
          message: 'Volcengine Seedance 查询任务返回了无效 JSON 响应。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 500),
        }
      }
    }

    if (!response.ok) {
      const rawError = getRawError(data, `Volcengine Seedance status HTTP ${response.status}`)
      return {
        success: false,
        providerId,
        model,
        taskId,
        status: 'error',
        errorCode: 'VOLCENGINE_SEEDANCE_STATUS_FAILED',
        message: rawError.message,
        upstreamStatus: response.status,
        upstreamMessage: rawError.message,
        rawCode: rawError.code,
        requestId: rawError.requestId ?? response.headers.get('x-request-id') ?? undefined,
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
          errorCode: 'VOLCENGINE_SEEDANCE_VIDEO_EMPTY',
          message: 'Seedance 任务已完成，但未返回视频 URL。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 500),
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
      }
    }

    if (status === 'error') {
      const rawError = getRawError(data, 'Seedance 视频任务失败。')
      return {
        success: false,
        providerId,
        model,
        taskId,
        status: 'error',
        errorCode: rawError.code || 'VOLCENGINE_SEEDANCE_TASK_FAILED',
        message: rawError.message,
        upstreamStatus: response.status,
        upstreamMessage: raw.slice(0, 500),
        rawCode: rawError.code,
        requestId: rawError.requestId,
      }
    }

    return {
      success: true,
      providerId,
      model,
      taskId,
      status: 'running',
      message: '视频任务已提交，正在生成中',
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
  const model = process.env.VOLCENGINE_SEEDREAM_MODEL || 'seedream-5-0-lite'
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

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
      size: imageSize(input),
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
      const error = data && typeof data === 'object' ? data as { error?: { message?: string; code?: string }; message?: string; code?: string } : {}
      const upstreamMessage = error.error?.message || error.message || `Volcengine Seedream HTTP ${response.status}`
      return {
        success: false,
        providerId,
        model,
        errorCode: 'VOLCENGINE_IMAGE_FAILED',
        message: upstreamMessage,
        upstreamStatus: response.status,
        upstreamMessage,
        rawCode: error.error?.code || error.code,
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
