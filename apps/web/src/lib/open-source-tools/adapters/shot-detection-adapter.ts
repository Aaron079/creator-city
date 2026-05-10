import type { OpenSourceToolHealth } from '../types'

export async function getShotDetectionHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const apiUrl = process.env.SHOT_DETECTION_API_URL
  if (!apiUrl) {
    return { toolId: 'pyscenedetect', status: 'disabled', message: 'SHOT_DETECTION_API_URL not set', checkedAt: new Date().toISOString() }
  }
  try {
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) })
    return {
      toolId: 'pyscenedetect',
      status: res.ok ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'pyscenedetect', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
