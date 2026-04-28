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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
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
      const response = await fetchWithTimeout(
        `${OPENAI_API_BASE}/models`,
        { method: 'GET', headers: makeHeaders(apiKey) },
        10000,
      )
      if (response.ok) return { ok: true, message: 'OpenAI API key is valid.' }
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      return { ok: false, message: body.error?.message ?? `HTTP ${response.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed'
      return { ok: false, message }
    }
  },

  async generateText(request: GenerateRequest): Promise<GenerateResponse> {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'OPENAI_API_KEY not set')

    const model = getEnv('OPENAI_TEXT_MODEL') || 'gpt-4o'

    const response = await fetchWithTimeout(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: makeHeaders(apiKey),
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: request.prompt }],
          max_tokens: 1024,
        }),
      },
      getTimeout(),
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new ProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
        body.error?.message ?? `OpenAI HTTP ${response.status}`,
      )
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    const text = data.choices[0]?.message?.content ?? ''

    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { text },
      message: `OpenAI text generation succeeded (model: ${model}).`,
    }
  },
}

export const openaiImagesAdapter: ProviderAdapter = {
  id: 'openai-images',

  async testConnection() {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) return { ok: false, message: 'OPENAI_API_KEY not configured.' }

    try {
      const response = await fetchWithTimeout(
        `${OPENAI_API_BASE}/models`,
        { method: 'GET', headers: makeHeaders(apiKey) },
        10000,
      )
      if (response.ok) return { ok: true, message: 'OpenAI API key is valid (images).' }
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      return { ok: false, message: body.error?.message ?? `HTTP ${response.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed'
      return { ok: false, message }
    }
  },

  async generateImage(request: GenerateRequest): Promise<GenerateResponse> {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'OPENAI_API_KEY not set')

    const model = getEnv('OPENAI_IMAGE_MODEL') || 'dall-e-3'
    const size = (request.params?.ratio === '1:1') ? '1024x1024'
      : (request.params?.ratio === '9:16') ? '1024x1792'
        : '1792x1024'

    const response = await fetchWithTimeout(
      `${OPENAI_API_BASE}/images/generations`,
      {
        method: 'POST',
        headers: makeHeaders(apiKey),
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          n: 1,
          size,
          response_format: 'url',
        }),
      },
      getTimeout(),
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new ProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
        body.error?.message ?? `OpenAI Images HTTP ${response.status}`,
      )
    }

    const data = await response.json() as { data: Array<{ url: string; revised_prompt?: string }> }
    const imageUrl = data.data[0]?.url ?? ''

    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { imageUrl, previewUrl: imageUrl },
      message: `OpenAI image generation succeeded (model: ${model}).`,
    }
  },
}
