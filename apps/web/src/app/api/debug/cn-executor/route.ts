import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(request: NextRequest) {
  // Accept executor secret via query param for CLI/WebFetch access
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get('secret') ?? ''
  const headerSecret = request.headers.get('x-debug-secret') ?? ''
  const expectedSecret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''

  if (!expectedSecret || (querySecret !== expectedSecret && headerSecret !== expectedSecret)) {
    return NextResponse.json({ error: 'unauthorized — pass ?secret=<CREATOR_EXECUTOR_SHARED_SECRET>' }, { status: 401 })
  }

  const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  const secretConfigured = Boolean(expectedSecret)
  const secretLength = expectedSecret.length

  if (!cnBaseUrl) {
    return NextResponse.json({
      ok: false,
      error: 'CREATOR_CN_API_BASE_URL not set',
      cnBaseUrlConfigured: false,
      secretConfigured,
      secretLength,
    })
  }

  // Test /health (no auth required)
  let healthResult: unknown = null
  let healthStatus: number | null = null
  let healthError: string | null = null
  try {
    const resp = await fetch(`${cnBaseUrl}/health`, { signal: AbortSignal.timeout(8_000) })
    healthStatus = resp.status
    const text = await resp.text()
    try { healthResult = JSON.parse(text) } catch { healthResult = text.slice(0, 300) }
  } catch (err) {
    healthError = err instanceof Error ? err.message : String(err)
  }

  // Test auth: POST with empty body — expect 400 (bad request), NOT 401
  let authStatus: number | null = null
  let authResult: unknown = null
  let authError: string | null = null
  try {
    const resp = await fetch(`${cnBaseUrl}/api/jobs/run-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expectedSecret}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8_000),
    })
    authStatus = resp.status
    const text = await resp.text()
    try { authResult = JSON.parse(text) } catch { authResult = text.slice(0, 300) }
  } catch (err) {
    authError = err instanceof Error ? err.message : String(err)
  }

  const authOk = authStatus !== null && authStatus !== 401
  return NextResponse.json({
    ok: true,
    cnBaseUrlConfigured: true,
    cnBaseUrlLength: cnBaseUrl.length,
    secretConfigured,
    secretLength,
    health: { status: healthStatus, result: healthResult, error: healthError },
    authTest: {
      status: authStatus,
      result: authResult,
      error: authError,
      authOk,
      interpretation: authStatus === 401
        ? 'AUTH FAILED — secret mismatch or old cn-executor code without Bearer support'
        : authStatus === 400
          ? 'AUTH OK — cn-executor accepted Bearer token (400=missing generationJobId is expected)'
          : authStatus === 200
            ? 'AUTH OK — cn-executor processed request'
            : authStatus === null
              ? `NETWORK ERROR: ${authError}`
              : `unexpected HTTP ${authStatus}`,
    },
  })
}
