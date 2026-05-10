import type { OpenSourceToolHealth } from '../types'

export async function getCanvasHealth(): Promise<OpenSourceToolHealth> {
  // React Flow is a client-side library — no runtime service to ping.
  // Health is always enabled as long as the package is installed.
  return { toolId: 'react-flow', status: 'enabled', message: 'client-side library, always available', checkedAt: new Date().toISOString() }
}
