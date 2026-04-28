// Generic HTTP adapter: bridges requests to a user-configured custom endpoint.
// Uses CUSTOM_PROVIDER_ENDPOINT + CUSTOM_PROVIDER_API_KEY.

import { getEnv, getTimeout } from '@/lib/providers/env'
import { PROVIDER_ERROR_CODES, ProviderError } from '@/lib/providers/errors'
import type { GenerateRequest, GenerateResponse, ProviderAdapter } from '@/lib/providers/types'

interface GenericHttpResponseShape {
  success?: boolean
  result?: {
    text?: string
    imageUrl?: string
    videoUrl?: string
    audioUrl?: string
    musicUrl?: string
    previewUrl?: string
  }
  message?: string
  jobId?: string
  status?: string
  // OpenAI-compatible fallback shapes
  choices?: Array<{ message?: { content?: string }; text?: string }>
  data?: Array<{ url?: string }>
  text?: string
}

function normalizeResponse(raw: GenericHttpResponseShape, request: GenerateRequest): GenerateResponse {
  if (raw.result) {
    return {
      success: raw.success !== false,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: raw.result,
      message: raw.message ?? 'Custom endpoint succeeded.',
      jobId: raw.jobId,
    }
  }

  // OpenAI-compatible chat completions
  if (raw.choices) {
    const text = raw.choices[0]?.message?.content ?? raw.choices[0]?.text ?? ''
    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { text },
      message: 'Custom endpoint succeeded (OpenAI-compatible).',
    }
  }

  // OpenAI-compatible image generation
  if (raw.data) {
    const imageUrl = raw.data[0]?.url ?? ''
    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { imageUrl, previewUrl: imageUrl },
      message: 'Custom endpoint image succeeded.',
    }
  }

  if (typeof raw.text === 'string') {
    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { text: raw.text },
      message: 'Custom endpoint succeeded.',
    }
  }

  return {
    success: raw.success !== false,
    providerId: request.providerId,
    mode: 'bridge',
    status: 'succeeded',
    message: raw.message ?? 'Custom endpoint returned unrecognized format.',
  }
}

async function callEndpoint(request: GenerateRequest): Promise<GenerateResponse> {
  const endpoint = getEnv('CUSTOM_PROVIDER_ENDPOINT')
  const apiKey = getEnv('CUSTOM_PROVIDER_API_KEY')
  if (!endpoint) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'CUSTOM_PROVIDER_ENDPOINT not set')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), getTimeout())

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
        `Custom endpoint HTTP ${response.status}: ${text.slice(0, 200)}`,
      )
    }

    const raw = await response.json() as GenericHttpResponseShape
    return normalizeResponse(raw, request)
  } finally {
    clearTimeout(timer)
  }
}

export const genericHttpAdapter: ProviderAdapter = {
  id: 'generic-http',

  async testConnection() {
    const endpoint = getEnv('CUSTOM_PROVIDER_ENDPOINT')
    if (!endpoint) return { ok: false, message: 'CUSTOM_PROVIDER_ENDPOINT not configured.' }

    try {
      const apiKey = getEnv('CUSTOM_PROVIDER_API_KEY')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      let response: Response
      try {
        const healthUrl = endpoint.endsWith('/') ? `${endpoint}health` : `${endpoint}/health`
        response = await fetch(healthUrl, { method: 'GET', headers, signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      return { ok: response.ok, message: response.ok ? 'Custom endpoint reachable.' : `HTTP ${response.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed'
      return { ok: false, message }
    }
  },

  async generateText(request) { return callEndpoint(request) },
  async generateImage(request) { return callEndpoint(request) },
  async generateVideo(request) { return callEndpoint(request) },
  async generateAudio(request) { return callEndpoint(request) },
  async generateMusic(request) { return callEndpoint(request) },
}
