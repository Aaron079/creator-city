import type { OpenSourceToolHealth } from '../types'

export async function getMcpHealth(): Promise<OpenSourceToolHealth> {
  const start = Date.now()
  const serverUrl = process.env.MCP_SERVER_URL
  if (!serverUrl) {
    return { toolId: 'mcp-servers', status: 'disabled', message: 'MCP_SERVER_URL not set', checkedAt: new Date().toISOString() }
  }
  try {
    const headers: Record<string, string> = {}
    if (process.env.MCP_API_KEY) headers['Authorization'] = `Bearer ${process.env.MCP_API_KEY}`
    const res = await fetch(`${serverUrl}/health`, { headers, signal: AbortSignal.timeout(5000) })
    return {
      toolId: 'mcp-servers',
      status: res.ok ? 'enabled' : 'error',
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { toolId: 'mcp-servers', status: 'error', latencyMs: Date.now() - start, message: err instanceof Error ? err.message : 'unreachable', checkedAt: new Date().toISOString() }
  }
}
