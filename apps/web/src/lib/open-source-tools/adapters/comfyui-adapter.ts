import type { OpenSourceToolHealth } from '../types'

export async function getComfyuiHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const baseUrl = process.env.COMFYUI_BASE_URL
  if (!baseUrl) {
    return { toolId: 'comfyui', status: 'misconfigured', message: 'COMFYUI_BASE_URL not set — ComfyUI must run as an isolated service', checkedAt: new Date().toISOString() }
  }
  try {
    const res = await fetch(`${baseUrl}/system_stats`, { signal: AbortSignal.timeout(5000) })
    return {
      toolId: 'comfyui',
      status: res.ok ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'comfyui', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
