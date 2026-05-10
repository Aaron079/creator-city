import type { OpenSourceToolHealth } from '../types'

export async function getStorageHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { toolId: 'supabase-storage', status: 'misconfigured', message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set', checkedAt: new Date().toISOString() }
  }
  try {
    const res = await fetch(`${url}/storage/v1/bucket`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      signal: AbortSignal.timeout(5000),
    })
    return {
      toolId: 'supabase-storage',
      status: res.ok ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'supabase-storage', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
