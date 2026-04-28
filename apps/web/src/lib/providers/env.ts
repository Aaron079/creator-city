// Server-only: reads process.env. Do not import from client components or pages with 'use client'.

export function checkEnvKeys(keys: string[]): { configured: boolean; missing: string[] } {
  const missing = keys.filter((k) => !process.env[k])
  return { configured: missing.length === 0, missing }
}

export function getEnv(key: string): string {
  return process.env[key] ?? ''
}

export function getTimeout(): number {
  const val = parseInt(process.env.PROVIDER_DEFAULT_TIMEOUT_MS ?? '30000', 10)
  return Number.isFinite(val) && val > 0 ? val : 30000
}
