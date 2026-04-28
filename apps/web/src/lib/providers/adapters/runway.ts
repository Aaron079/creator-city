// Runway ML API adapter
// Based on official Runway API docs: https://docs.dev.runwayml.com
// Base URL: https://api.dev.runwayml.com/v1

import { getEnv, getTimeout } from '@/lib/providers/env'
import { PROVIDER_ERROR_CODES, ProviderError } from '@/lib/providers/errors'
import type { GenerateRequest, GenerateResponse, ProviderAdapter } from '@/lib/providers/types'

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1'
const RUNWAY_API_VERSION = '2024-11-06'

function makeHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Runway-Version': RUNWAY_API_VERSION,
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

// Maps our ratio format to Runway's ratio format
function mapRatio(ratio?: string | number | boolean): string {
  if (ratio === '16:9') return '1280:720'
  if (ratio === '9:16') return '720:1280'
  if (ratio === '1:1') return '1080:1080'
  if (ratio === '4:3') return '1024:768'
  if (ratio === '3:4') return '768:1024'
  return '1280:720'
}

function parseDuration(duration?: string | number | boolean): number {
  if (typeof duration === 'string') {
    const match = /^(\d+)s?$/.exec(duration)
    if (match) return Math.min(Math.max(parseInt(match[1] ?? '5', 10), 5), 10)
  }
  return 5
}

interface RunwayTask {
  id: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  output?: string[]
  failure?: string
  progress?: number
}

export const runwayAdapter: ProviderAdapter = {
  id: 'runway',

  async testConnection() {
    const apiKey = getEnv('RUNWAY_API_KEY')
    if (!apiKey) return { ok: false, message: 'RUNWAY_API_KEY not configured.' }

    try {
      const response = await fetchWithTimeout(
        `${RUNWAY_API_BASE}/organization`,
        { method: 'GET', headers: makeHeaders(apiKey) },
        10000,
      )
      if (response.ok) return { ok: true, message: 'Runway API key is valid.' }
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string }
      return { ok: false, message: body.message ?? body.error ?? `HTTP ${response.status}` }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed'
      return { ok: false, message }
    }
  },

  async generateVideo(request: GenerateRequest): Promise<GenerateResponse> {
    const apiKey = getEnv('RUNWAY_API_KEY')
    if (!apiKey) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'RUNWAY_API_KEY not set')

    const ratio = mapRatio(request.params?.ratio)
    const duration = parseDuration(request.params?.duration)

    // Use image-to-video if an input image is provided, otherwise text-to-video
    const inputImage = request.inputAssets?.find((a) => a.type === 'image')?.url
    const endpoint = inputImage ? `${RUNWAY_API_BASE}/image_to_video` : `${RUNWAY_API_BASE}/text_to_video`

    const body = inputImage
      ? { promptImage: [{ uri: inputImage, position: 'first' }], promptText: request.prompt, ratio, duration, model: 'gen4_turbo' }
      : { promptText: request.prompt, ratio, duration, model: 'gen4_turbo' }

    const response = await fetchWithTimeout(
      endpoint,
      { method: 'POST', headers: makeHeaders(apiKey), body: JSON.stringify(body) },
      getTimeout(),
    )

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as { error?: string; message?: string }
      throw new ProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
        errBody.message ?? errBody.error ?? `Runway HTTP ${response.status}`,
      )
    }

    const task = await response.json() as { id: string }

    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      jobId: `runway:${task.id}`,
      status: 'queued',
      message: `Runway video task queued (id: ${task.id}). Poll /api/generate/jobs/runway:${task.id} for status.`,
    }
  },

  async getJob(jobId: string): Promise<GenerateResponse> {
    const apiKey = getEnv('RUNWAY_API_KEY')
    if (!apiKey) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'RUNWAY_API_KEY not set')

    const taskId = jobId.startsWith('runway:') ? jobId.slice(7) : jobId

    const response = await fetchWithTimeout(
      `${RUNWAY_API_BASE}/tasks/${taskId}`,
      { method: 'GET', headers: makeHeaders(apiKey) },
      15000,
    )

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as { message?: string }
      throw new ProviderError(
        PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
        errBody.message ?? `Runway tasks HTTP ${response.status}`,
      )
    }

    const task = await response.json() as RunwayTask

    if (task.status === 'SUCCEEDED') {
      const videoUrl = task.output?.[0]
      return {
        success: true,
        providerId: 'runway',
        mode: 'real',
        jobId,
        status: 'succeeded',
        result: { videoUrl, previewUrl: videoUrl },
        message: 'Runway video generation succeeded.',
      }
    }

    if (task.status === 'FAILED' || task.status === 'CANCELLED') {
      return {
        success: false,
        providerId: 'runway',
        mode: 'real',
        jobId,
        status: 'failed',
        message: task.failure ?? 'Runway task failed.',
        errorCode: PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED,
      }
    }

    return {
      success: true,
      providerId: 'runway',
      mode: 'real',
      jobId,
      status: task.status === 'RUNNING' ? 'running' : 'queued',
      message: `Runway task ${task.status.toLowerCase()}${task.progress !== undefined ? ` (${Math.round(task.progress * 100)}%)` : ''}.`,
    }
  },

  async cancelJob(jobId: string): Promise<void> {
    const apiKey = getEnv('RUNWAY_API_KEY')
    if (!apiKey) return

    const taskId = jobId.startsWith('runway:') ? jobId.slice(7) : jobId
    await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: makeHeaders(apiKey),
    }).catch(() => undefined)
  },
}
