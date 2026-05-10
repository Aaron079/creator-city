import type { OpenSourceToolHealth } from '../types'

export async function getWhisperHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const apiUrl = process.env.WHISPER_API_URL
  if (!apiUrl) {
    return { toolId: 'whisper-asr', status: 'disabled', message: 'WHISPER_API_URL not set', checkedAt: new Date().toISOString() }
  }
  try {
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) })
    return {
      toolId: 'whisper-asr',
      status: res.ok ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'whisper-asr', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
