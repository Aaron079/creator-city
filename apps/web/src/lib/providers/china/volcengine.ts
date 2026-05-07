import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  type ChinaImageGenerationInput,
  type ChinaImageGenerationResult,
  type ChinaProviderConfig,
} from './types'

export const volcengineProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: 'volcengine-seedance-video',
    envKeys: ['VOLCENGINE_ACCESS_KEY_ID', 'VOLCENGINE_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_SEEDANCE_MODEL'],
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    defaultModel: 'seedance-2-0',
    modelEnvKey: 'VOLCENGINE_SEEDANCE_MODEL',
  },
  {
    providerId: 'volcengine-seedream-image',
    envKeys: ['VOLCENGINE_ACCESS_KEY_ID', 'VOLCENGINE_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_SEEDREAM_MODEL'],
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

export async function generateSeedreamImage(input: ChinaImageGenerationInput): Promise<ChinaImageGenerationResult> {
  const providerId = 'volcengine-seedream-image'
  const model = process.env.VOLCENGINE_SEEDREAM_MODEL || 'seedream-5-0-lite'
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY
    || process.env.VOLCENGINE_API_KEY
    || process.env.VOLCENGINE_SECRET_ACCESS_KEY
  const baseUrl = process.env.VOLCENGINE_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'

  if (!apiKey) {
    return {
      success: false,
      providerId,
      model,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: 'VOLCENGINE_ARK_API_KEY 或 VOLCENGINE_SECRET_ACCESS_KEY 未配置',
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
