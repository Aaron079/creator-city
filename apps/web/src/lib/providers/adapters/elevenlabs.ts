// ElevenLabs API adapter
// Docs: https://elevenlabs.io/docs/api-reference

import { getEnv, getTimeout } from '@/lib/providers/env'
import { PROVIDER_ERROR_CODES, ProviderError } from '@/lib/providers/errors'
import type { GenerateRequest, GenerateResponse, ProviderAdapter } from '@/lib/providers/types'

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel voice (stable public ID)
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export const elevenlabsAdapter: ProviderAdapter = {
  id: 'elevenlabs',

  async testConnection() {
    const apiKey = getEnv('ELEVENLABS_API_KEY')
    if (!apiKey) return { ok: false, message: 'ELEVENLABS_API_KEY not configured.' }

    try {
      const response = await fetchWithTimeout(
        `${ELEVENLABS_API_BASE}/user`,
        {
          method: 'GET',
          headers: { 'xi-api-key': apiKey },
        },
        10000,
      )
      if (response.ok) {
        const user = await response.json().catch(() => ({})) as { subscription?: { tier?: string } }
        const tier = user.subscription?.tier ?? 'unknown'
        return { ok: true, message: `ElevenLabs API key valid (tier: ${tier}).` }
      }
      const body = await response.json().catch(() => ({})) as { detail?: { message?: string } | string }
      const msg = typeof body.detail === 'string'
        ? body.detail
        : body.detail?.message ?? `HTTP ${response.status}`
      return { ok: false, message: msg }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed'
      return { ok: false, message }
    }
  },

  async generateAudio(request: GenerateRequest): Promise<GenerateResponse> {
    const apiKey = getEnv('ELEVENLABS_API_KEY')
    if (!apiKey) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'ELEVENLABS_API_KEY not set')

    const voiceId = (typeof request.params?.voiceId === 'string' && request.params.voiceId)
      ? request.params.voiceId
      : DEFAULT_VOICE_ID
    const modelId = (typeof request.params?.modelId === 'string' && request.params.modelId)
      ? request.params.modelId
      : DEFAULT_MODEL_ID

    const response = await fetchWithTimeout(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: request.prompt,
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
      getTimeout(),
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { detail?: { message?: string } | string }
      const msg = typeof body.detail === 'string'
        ? body.detail
        : body.detail?.message ?? `ElevenLabs HTTP ${response.status}`
      throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_REQUEST_FAILED, msg)
    }

    // Return as data URL for simple playback; in production, upload to storage instead
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const audioUrl = `data:audio/mpeg;base64,${base64}`

    return {
      success: true,
      providerId: request.providerId,
      mode: 'real',
      status: 'succeeded',
      result: { audioUrl, previewUrl: audioUrl },
      message: `ElevenLabs TTS succeeded (voice: ${voiceId}, model: ${modelId}).`,
    }
  },
}
