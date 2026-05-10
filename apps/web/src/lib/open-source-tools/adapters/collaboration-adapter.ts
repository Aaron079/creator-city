import type { OpenSourceToolHealth } from '../types'

export async function getCollaborationHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const url = process.env.HOCUSPOCUS_URL
  if (!url) {
    return { toolId: 'yjs-hocuspocus', status: 'disabled', message: 'HOCUSPOCUS_URL not set', checkedAt: new Date().toISOString() }
  }
  try {
    const httpUrl = url.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
    const res = await fetch(httpUrl, { signal: AbortSignal.timeout(5000) })
    return {
      toolId: 'yjs-hocuspocus',
      status: res.status < 500 ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.status < 500 ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'yjs-hocuspocus', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
