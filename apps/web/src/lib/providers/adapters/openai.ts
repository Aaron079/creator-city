import { getEnv, getTimeout } from '@/lib/providers/env'
import { PROVIDER_ERROR_CODES, ProviderError } from '@/lib/providers/errors'
import type { GenerateRequest, GenerateResponse, ProviderAdapter } from '@/lib/providers/types'

const OPENAI_API_BASE = 'https://api.openai.com/v1'

function makeHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<{ response: Response; raw: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const raw = await response.text()
    return { response, raw }
  } finally {
    clearTimeout(timer)
  }
}

export const openaiTextAdapter: ProviderAdapter = {
  id: 'openai-text',

  async testConnection() {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) return { ok: false, message: 'OPENAI_API_KEY not configured.' }

    try {
      const { response, raw } = await fetchWithTimeout(
        `${OPENAI_API_BASE}/models`,
        { method: 'GET', headers: makeHeaders(apiKey) },
        10000,
      )
      if (response.ok) return { ok: true, message: 'OpenAI API key is valid.' }
      let body: { error?: { message?: string } } = {}
      try { body = JSON.parse(raw) } catch { /* Use the HTTP status for non-JSON errors. */ }
      return { ok: false, message: body.error?.message ?? `HTTP ${response.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed'
      return { ok: false, message }
    }
  },

  async generateText(request: GenerateRequest): Promise<GenerateResponse> {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'OPENAI_API_KEY not set')

    const model = getEnv('OPENAI_TEXT_MODEL') || 'gpt-4.1-mini'

    const { response, raw } = await fetchWithTimeout(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: makeHeaders(apiKey),
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: request.prompt }],
          max_tokens: 2048,
        }),
      },
      getTimeout(),
    )

    if (!response.ok) {
      let body: { error?: { message?: string; code?: string; type?: string } } = {}
      try { body = JSON.parse(raw) } catch { /* Use the HTTP status for non-JSON errors. */ }
      const msg = body.error?.message ?? `OpenAI HTTP ${response.status}`
      if (response.status === 429 && (body.error?.code === 'insufficient_quota' || body.error?.type === 'insufficient_quota')) {
        return { success: false, providerId: request.providerId, mode: 'unavailable', status: 'failed', errorCode: 'OPENAI_INSUFFICIENT_QUOTA', message: msg }
      }
      const code =
        response.status === 401 || response.status === 403 ? 'OPENAI_AUTH_FAILED'
        : response.status === 429 ? 'OPENAI_RATE_LIMITED'
        : response.status === 404 ? 'OPENAI_MODEL_NOT_FOUND'
        : PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED
      throw new ProviderError(code, msg)
    }

    let data: { choices?: Array<{ message?: { content?: string } }> } = {}
    try { data = JSON.parse(raw) } catch { throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED, `OpenAI 返回了无效响应`) }
    const text = data.choices?.[0]?.message?.content ?? ''

    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { text },
      message: `文本生成成功（${model}）`,
    }
  },
}

export const openaiImagesAdapter: ProviderAdapter = {
  id: 'openai-images',

  async testConnection() {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) return { ok: false, message: 'OPENAI_API_KEY not configured.' }

    try {
      const { response, raw } = await fetchWithTimeout(
        `${OPENAI_API_BASE}/models`,
        { method: 'GET', headers: makeHeaders(apiKey) },
        10000,
      )
      if (response.ok) return { ok: true, message: 'OpenAI API key is valid (images).' }
      let body: { error?: { message?: string } } = {}
      try { body = JSON.parse(raw) } catch { /* Use the HTTP status for non-JSON errors. */ }
      return { ok: false, message: body.error?.message ?? `HTTP ${response.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed'
      return { ok: false, message }
    }
  },

  async generateImage(request: GenerateRequest): Promise<GenerateResponse> {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'OPENAI_API_KEY not set')

    const model = getEnv('OPENAI_IMAGE_MODEL') || 'gpt-image-1'
    // gpt-image-1 returns b64_json by default; DALL-E models support response_format:'url'
    const isGptImage = model.startsWith('gpt-image')

    const size = request.params?.ratio === '1:1'
      ? '1024x1024'
      : request.params?.ratio === '9:16'
        ? (isGptImage ? '1024x1536' : '1024x1792')
        : (isGptImage ? '1536x1024' : '1792x1024')

    const payload: Record<string, unknown> = { model, prompt: request.prompt, n: 1, size }
    if (!isGptImage) payload.response_format = 'url'

    const { response, raw } = await fetchWithTimeout(
      `${OPENAI_API_BASE}/images/generations`,
      {
        method: 'POST',
        headers: makeHeaders(apiKey),
        body: JSON.stringify(payload),
      },
      getTimeout(),
    )

    if (!response.ok) {
      let body: { error?: { message?: string; code?: string; type?: string } } = {}
      try { body = JSON.parse(raw) } catch { /* Use the HTTP status for non-JSON errors. */ }
      const msg = body.error?.message ?? `OpenAI Images HTTP ${response.status}`
      if (response.status === 429 && (body.error?.code === 'insufficient_quota' || body.error?.type === 'insufficient_quota')) {
        return { success: false, providerId: request.providerId, mode: 'unavailable', status: 'failed', errorCode: 'OPENAI_INSUFFICIENT_QUOTA', message: msg }
      }
      const code =
        response.status === 401 || response.status === 403 ? 'OPENAI_AUTH_FAILED'
        : response.status === 429 ? 'OPENAI_RATE_LIMITED'
        : response.status === 404 ? 'OPENAI_MODEL_NOT_FOUND'
        : PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED
      throw new ProviderError(code, msg)
    }

    let data: { data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }> } = {}
    try { data = JSON.parse(raw) } catch { throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED, `OpenAI Images 返回了无效响应`) }
    const item = data.data?.[0]
    let imageUrl = item?.url ?? ''
    if (!imageUrl && item?.b64_json) {
      imageUrl = `data:image/png;base64,${item.b64_json}`
    }

    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { imageUrl, previewUrl: imageUrl },
      message: `图片生成成功（${model}）`,
    }
  },
}
