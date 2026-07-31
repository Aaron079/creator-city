export const DEFAULT_CANVAS_E2E_BASE_URL = 'http://127.0.0.1:3000'

export type E2EEnvironment = Record<string, string | undefined>
export type RequestEvidence = { method: string; pathname: string }

const forbiddenMutationPrefixes = [
  '/api/generate/',
  '/api/payment/',
  '/api/billing/',
  '/api/credits/',
  '/api/wallet/',
  '/api/recharge/',
  '/api/checkout',
]

export function getCanvasE2EBaseUrl(env: E2EEnvironment): URL {
  return new URL(env.PLAYWRIGHT_BASE_URL ?? DEFAULT_CANVAS_E2E_BASE_URL)
}

export function isProductionCanvasUrl(value: string | URL): boolean {
  return new URL(value).hostname === 'creator-city-vert.vercel.app'
}

export function getSafePreviewFixture(env: E2EEnvironment) {
  const baseUrl = getCanvasE2EBaseUrl(env)
  const missing = [
    env.PLAYWRIGHT_SAFE_ENV !== 'preview' && 'PLAYWRIGHT_SAFE_ENV=preview',
    !env.PLAYWRIGHT_STORAGE_STATE && 'PLAYWRIGHT_STORAGE_STATE',
    !env.PLAYWRIGHT_SAFE_PROJECT_ID && 'PLAYWRIGHT_SAFE_PROJECT_ID',
    env.PLAYWRIGHT_ALLOW_SAFE_WRITES !== '1' && 'PLAYWRIGHT_ALLOW_SAFE_WRITES=1',
    isProductionCanvasUrl(baseUrl) && 'non-production PLAYWRIGHT_BASE_URL',
  ].filter(Boolean) as string[]

  return missing.length > 0
    ? { ready: false as const, reason: `Safe Preview fixture unavailable: ${missing.join(', ')}` }
    : {
        ready: true as const,
        baseUrl,
        projectId: env.PLAYWRIGHT_SAFE_PROJECT_ID!,
        storageState: env.PLAYWRIGHT_STORAGE_STATE!,
      }
}

export function findForbiddenMutationRequests(requests: readonly RequestEvidence[]) {
  return requests.filter(({ method, pathname }) => {
    const normalizedMethod = method.toUpperCase()
    return normalizedMethod !== 'GET'
      && normalizedMethod !== 'HEAD'
      && forbiddenMutationPrefixes.some((prefix) => pathname.startsWith(prefix))
  })
}
