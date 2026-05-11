import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  type ChinaImageGenerationInput,
  type ChinaImageGenerationResult,
  type ChinaProviderConfig,
} from './types'

export const jimengProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: 'jimeng-image',
    envKeys: ['JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['JIMENG_BASE_URL', 'JIMENG_MODEL_IMAGE'],
    baseUrlEnvKey: 'JIMENG_BASE_URL',
    defaultModel: 'jimeng-image-4-0',
    modelEnvKey: 'JIMENG_MODEL_IMAGE',
  },
  {
    providerId: 'jimeng-video',
    envKeys: ['JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['JIMENG_BASE_URL', 'JIMENG_MODEL_VIDEO'],
    baseUrlEnvKey: 'JIMENG_BASE_URL',
    defaultModel: 'jimeng-video-3-0-pro',
    modelEnvKey: 'JIMENG_MODEL_VIDEO',
  },
]

export function getJimengStatus(providerId: 'jimeng-image' | 'jimeng-video') {
  const config = jimengProviderConfigs.find((item) => item.providerId === providerId)
  return config ? getChinaProviderStatus(config) : null
}

export function testJimengConnection(providerId: 'jimeng-image' | 'jimeng-video') {
  return getJimengStatus(providerId)
}

function imageSize(input: ChinaImageGenerationInput) {
  if (input.size) return input.size
  if (input.aspectRatio === '9:16') return '1024x1792'
  if (input.aspectRatio === '1:1') return '1024x1024'
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

export async function generateJimengImage(input: ChinaImageGenerationInput): Promise<ChinaImageGenerationResult> {
  const providerId = 'jimeng-image'
  const model = process.env.JIMENG_MODEL_IMAGE || 'jimeng-image-4-0'
  const baseUrl = process.env.JIMENG_BASE_URL
  const accessKey = process.env.JIMENG_ACCESS_KEY_ID
  const apiKey = process.env.JIMENG_API_KEY || process.env.JIMENG_SECRET_ACCESS_KEY

  if (!baseUrl || !apiKey) {
    return {
      success: false,
      providerId,
      model,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: 'JIMENG_BASE_URL 和 JIMENG_SECRET_ACCESS_KEY 未配置',
    }
  }

  const size = imageSize(input)
  const submittedInput = {
    providerId,
    model,
    endpoint: '/images/generations',
    promptChars: input.prompt.trim().length,
    aspectRatio: input.aspectRatio ?? null,
    size,
    referenceImageCount: input.referenceImages?.length ?? 0,
    hasReferenceImages: Boolean(input.referenceImages?.length),
    responseFormat: 'url',
    watermark: false,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
      size,
      response_format: 'url',
      n: 1,
      watermark: false,
    }
    if (input.referenceImages?.length) {
      body.image = input.referenceImages.length === 1 ? input.referenceImages[0] : input.referenceImages
      body.images = input.referenceImages
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    if (accessKey) headers['X-Access-Key'] = accessKey

    const response = await fetch(imageEndpoint(baseUrl), {
      method: 'POST',
      headers,
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
          errorCode: 'JIMENG_IMAGE_FAILED',
          message: 'Jimeng 返回了无效 JSON 响应。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 500),
          submittedInput,
          providerResponse: { parseError: 'invalid_json', rawSnippet: raw.slice(0, 500) },
        }
      }
    }

    if (!response.ok) {
      const error = data && typeof data === 'object' ? data as { error?: { message?: string; code?: string; request_id?: string }; message?: string; code?: string; request_id?: string } : {}
      const upstreamMessage = error.error?.message || error.message || `Jimeng HTTP ${response.status}`
      const haystack = `${error.error?.code || error.code || ''} ${upstreamMessage}`.toLowerCase()
      return {
        success: false,
        providerId,
        model,
        errorCode: /invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack) ? 'PROVIDER_INVALID_PARAMETER' : 'JIMENG_IMAGE_FAILED',
        message: upstreamMessage,
        upstreamStatus: response.status,
        upstreamMessage,
        rawCode: error.error?.code || error.code,
        requestId: error.error?.request_id || error.request_id,
        submittedInput,
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
        submittedInput,
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
        submittedInput,
      }
    }

    return {
      success: false,
      providerId,
      model,
      errorCode: 'JIMENG_IMAGE_EMPTY',
      message: 'Jimeng 未返回图片 URL 或 base64。',
      upstreamStatus: response.status,
      upstreamMessage: raw.slice(0, 500),
      submittedInput,
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
    return {
      success: false,
      providerId,
      model,
      errorCode: aborted ? 'JIMENG_IMAGE_TIMEOUT' : 'JIMENG_IMAGE_FAILED',
      message: aborted ? 'Jimeng 请求超时或被中断，请重试。' : error instanceof Error ? error.message : 'Jimeng 调用失败。',
      upstreamMessage: error instanceof Error ? error.message : undefined,
      submittedInput,
    }
  } finally {
    clearTimeout(timer)
  }
}

export const normalizeJimengError = normalizeChinaProviderError
