import type { OpenSourceToolHealth } from '../types'

export async function getLivekitHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  if (!url || !apiKey) {
    return { toolId: 'livekit', status: 'disabled', message: 'LIVEKIT_API_KEY or NEXT_PUBLIC_LIVEKIT_URL not set', checkedAt: new Date().toISOString() }
  }
  try {
    const httpUrl = url.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
    const res = await fetch(httpUrl, { signal: AbortSignal.timeout(5000) })
    return {
      toolId: 'livekit',
      status: res.status < 500 ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.status < 500 ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'livekit', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
