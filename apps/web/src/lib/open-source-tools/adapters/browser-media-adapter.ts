import type { OpenSourceToolHealth } from '../types'

export async function getBrowserMediaHealth(): Promise<OpenSourceToolHealth> {
  // Mediabunny is a WASM/browser-side library — no server endpoint to ping.
  // Enabled when the feature flag is set; no env keys required.
  const flagEnabled = process.env.NEXT_PUBLIC_ENABLE_BROWSER_MEDIA === 'true'
  return {
    toolId: 'mediabunny',
    status: flagEnabled ? 'enabled' : 'disabled',
    message: flagEnabled ? 'WASM library, health verified at client load time' : 'NEXT_PUBLIC_ENABLE_BROWSER_MEDIA not set to true',
    checkedAt: new Date().toISOString(),
  }
}
