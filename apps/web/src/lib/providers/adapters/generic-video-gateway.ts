// Creator City custom video gateway adapter.
// Routes to CUSTOM_VIDEO_PROVIDER_ENDPOINT using CUSTOM_VIDEO_PROVIDER_API_KEY.
// If the endpoint is missing the generate call returns PROVIDER_NOT_CONFIGURED.

import { getEnv, getTimeout } from '@/lib/providers/env'
import { PROVIDER_ERROR_CODES, ProviderError } from '@/lib/providers/errors'
import type { GenerateRequest, GenerateResponse, ProviderAdapter } from '@/lib/providers/types'

interface GatewayResponseShape {
  // flat success
  status?: string
  videoUrl?: string
  previewUrl?: string
  jobId?: string
  // nested data
  data?: { videoUrl?: string; previewUrl?: string; metadata?: Record<string, unknown> }
  // nested result
  result?: { videoUrl?: string; previewUrl?: string; metadata?: Record<string, unknown> }
  // error fields
  message?: string
  error?: string
  errorCode?: string
}

function normalizeResponse(raw: GatewayResponseShape, providerId: string): GenerateResponse {
  const jobId = raw.jobId
  const isPending = raw.status === 'queued' || raw.status === 'running' || raw.status === 'pending'

  if (isPending && jobId) {
    return {
      success: true,
      providerId,
      mode: 'real',
      jobId: `custom-video-gateway:${jobId}`,
      status: raw.status === 'running' ? 'running' : 'queued',
      message: `Video generation queued (jobId: ${jobId}). Poll /api/generate/jobs/custom-video-gateway:${jobId}.`,
    }
  }

  // Flat shape: { status, videoUrl, previewUrl }
  if (raw.videoUrl) {
    return {
      success: true,
      providerId,
      mode: 'real',
      jobId,
      status: 'succeeded',
      result: { videoUrl: raw.videoUrl, previewUrl: raw.previewUrl ?? raw.videoUrl },
      message: 'Video generation succeeded.',
    }
  }

  // Nested data shape
  if (raw.data?.videoUrl) {
    return {
      success: true,
      providerId,
      mode: 'real',
      jobId,
      status: 'succeeded',
      result: { videoUrl: raw.data.videoUrl, previewUrl: raw.data.previewUrl ?? raw.data.videoUrl, metadata: raw.data.metadata },
      message: 'Video generation succeeded.',
    }
  }

  // Nested result shape
  if (raw.result?.videoUrl) {
    return {
      success: true,
      providerId,
      mode: 'real',
      jobId,
      status: 'succeeded',
      result: { videoUrl: raw.result.videoUrl, previewUrl: raw.result.previewUrl ?? raw.result.videoUrl, metadata: raw.result.metadata },
      message: 'Video generation succeeded.',
    }
  }

  // Unknown shape — let caller decide
  return {
    success: false,
    providerId,
    mode: 'real',
    status: 'failed',
    message: raw.message ?? raw.error ?? 'Custom video gateway returned unrecognized response format.',
    errorCode: raw.errorCode ?? PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_TIMEOUT, `Request to custom video gateway timed out after ${timeoutMs}ms.`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const genericVideoGatewayAdapter: ProviderAdapter = {
  id: 'custom-video-gateway',

  async testConnection() {
    const endpoint = getEnv('CUSTOM_VIDEO_PROVIDER_ENDPOINT')
    if (!endpoint) return { ok: false, message: 'CUSTOM_VIDEO_PROVIDER_ENDPOINT not configured.' }

    try {
      const apiKey = getEnv('CUSTOM_VIDEO_PROVIDER_API_KEY')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const healthUrl = endpoint.replace(/\/$/, '') + '/health'
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      let response: Response
      try {
        response = await fetch(healthUrl, { method: 'GET', headers, signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      return { ok: response.ok || response.status < 500, message: response.ok ? 'Custom video gateway reachable.' : `HTTP ${response.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { ok: false, message }
    }
  },

  async generateVideo(request: GenerateRequest): Promise<GenerateResponse> {
    const endpoint = getEnv('CUSTOM_VIDEO_PROVIDER_ENDPOINT')
    if (!endpoint) {
      throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'CUSTOM_VIDEO_PROVIDER_ENDPOINT not configured.')
    }

    const apiKey = getEnv('CUSTOM_VIDEO_PROVIDER_API_KEY')
    const timeoutMs = parseInt(getEnv('CUSTOM_VIDEO_PROVIDER_TIMEOUT_MS') || '0', 10) || getTimeout()
    const providerName = getEnv('CUSTOM_VIDEO_PROVIDER_NAME') || 'Creator Video Gateway'

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const body = {
      providerId: request.providerId,
      prompt: request.prompt,
      inputAssets: request.inputAssets ?? [],
      params: {
        ratio: request.params?.ratio,
        resolution: request.params?.resolution,
        duration: request.params?.duration,
        audio: request.params?.audio,
        generationMode: request.params?.generationMode ?? request.params?.stage,
      },
      nodeId: request.nodeId,
      projectId: request.projectId,
    }

    const response = await fetchWithTimeout(
      endpoint.replace(/\/$/, ''),
      { method: 'POST', headers, body: JSON.stringify(body) },
      timeoutMs,
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let parsed: GatewayResponseShape = {}
      try { parsed = JSON.parse(text) as GatewayResponseShape } catch { /* not json */ }
      throw new ProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
        parsed.message ?? parsed.error ?? `${providerName} returned HTTP ${response.status}: ${text.slice(0, 200)}`,
      )
    }

    const raw = await response.json() as GatewayResponseShape
    return normalizeResponse(raw, request.providerId)
  },

  async getJob(jobId: string): Promise<GenerateResponse> {
    const endpoint = getEnv('CUSTOM_VIDEO_PROVIDER_ENDPOINT')
    if (!endpoint) {
      throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'CUSTOM_VIDEO_PROVIDER_ENDPOINT not configured.')
    }

    const apiKey = getEnv('CUSTOM_VIDEO_PROVIDER_API_KEY')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    // rawId is the part after "custom-video-gateway:"
    const rawId = jobId.startsWith('custom-video-gateway:') ? jobId.slice(21) : jobId
    const jobUrl = `${endpoint.replace(/\/$/, '')}/jobs/${rawId}`

    const response = await fetchWithTimeout(jobUrl, { method: 'GET', headers }, 15000)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let parsed: GatewayResponseShape = {}
      try { parsed = JSON.parse(text) as GatewayResponseShape } catch { /* not json */ }
      throw new ProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
        parsed.message ?? `Job status HTTP ${response.status}`,
      )
    }

    const raw = await response.json() as GatewayResponseShape
    return normalizeResponse(raw, 'custom-video-gateway')
  },
}
