import type { OpenSourceToolHealth } from '../types'

export async function getQdrantHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const url = process.env.QDRANT_URL
  if (!url) {
    return { toolId: 'qdrant', status: 'disabled', message: 'QDRANT_URL not set', checkedAt: new Date().toISOString() }
  }
  try {
    const headers: Record<string, string> = {}
    if (process.env.QDRANT_API_KEY) headers['api-key'] = process.env.QDRANT_API_KEY
    const res = await fetch(`${url}/healthz`, { headers, signal: AbortSignal.timeout(5000) })
    return {
      toolId: 'qdrant',
      status: res.ok ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'qdrant', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
